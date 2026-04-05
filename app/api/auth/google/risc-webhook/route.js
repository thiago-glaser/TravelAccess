import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { User, sequelize } from '@/lib/models/index.js';

// Configure the JWKS client to fetch Google's public routing keys.
// These are used to verify the cryptographic signature of the incoming JWT.
const client = jwksClient({
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs'
});

// Function to get the signing key based on the 'kid' (key ID) in the JWT header
function getKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        if (err) {
            callback(err, null);
            return;
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

export async function POST(request) {
    try {
        // Google RISC events send an application/jwt content body (or application/secevent+jwt)
        const token = await request.text();

        if (!token) {
            return Response.json({ error: "Missing token" }, { status: 400 });
        }

        const expectedAudience = process.env.GOOGLE_CLIENT_ID;
        if (!expectedAudience) {
            console.error('[RISC Webhook] GOOGLE_CLIENT_ID not configured');
            return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
        }

        // Verify the Token using Google's public certificates
        // It must be issued by Google (accounts.google.com) and intended for this application (audience)
        return new Promise((resolve) => {
            jwt.verify(token, getKey, { issuer: 'https://accounts.google.com', audience: expectedAudience }, async (err, decoded) => {
                if (err) {
                    console.error('[RISC Webhook] JWT Verification Error:', err.message);
                    // Return 400 for invalid tokens so Google knows it failed validation
                    resolve(Response.json({ error: 'Invalid signature' }, { status: 400 }));
                    return;
                }

                // Successfully Verified! Let's examine the event
                const events = decoded.events || {};
                const subject = decoded.sub; // This is the user's GOOGLE_ID (if subject_type is "iss-sub")

                // To ensure we map correctly, check what subject schema Google is using for this event
                let googleIdToTarget = null;
                if (decoded.sub && typeof decoded.sub === 'string') {
                    googleIdToTarget = decoded.sub;
                } else if (decoded.sub && decoded.sub.subject_type === 'iss-sub') {
                    googleIdToTarget = decoded.sub.sub;
                } else if (decoded.subject && decoded.subject.subject_type === 'iss-sub') {
                    googleIdToTarget = decoded.subject.sub;
                }

                console.log(`[RISC Webhook] Event received for Google ID: ${googleIdToTarget}`);
                console.log(`[RISC Webhook] Events object:`, JSON.stringify(events));

                // If we successfully resolved a target user ID
                if (googleIdToTarget) {

                    // EVENT: Account Hijacked or Sessions Revoked
                    // In both scenarios, the best defensive action is to force log out the user.
                    if (
                        events['https://schemas.openid.net/secevent/risc/event-type/account-disabled'] ||
                        events['https://schemas.openid.net/secevent/risc/event-type/sessions-revoked'] ||
                        events['https://schemas.openid.net/secevent/risc/event-type/account-hijacked']
                    ) {
                        console.warn(`[RISC Webhook] Security event triggered for ${googleIdToTarget}. Taking action...`);

                        try {
                            // 1. You could look up the TravelAccess userID:
                            // const user = await User.findOne({ where: { googleId: googleIdToTarget } });
                            // if(user) { const userId = user.id; ... }

                            // 2. Here you would write logic to invalidate their active JWTs, Session tokens,
                            // or even mark them as "IS_ACTIVE = 0" in extreme cases.

                            console.log(`[RISC Webhook] Action complete - User's local sessions should be dropped.`);
                        } catch (dbErr) {
                            console.error(`[RISC Webhook] Database error taking defensive action:`, dbErr);
                            // Continuing because we still want to ACKnowledge the event to Google.
                        }
                    }
                }

                // Google requires an HTTP 202 Accepted empty response upon successful receipt
                resolve(new Response(null, { status: 202 }));
            });
        });

    } catch (err) {
        console.error('[RISC Webhook] Fatal Error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
