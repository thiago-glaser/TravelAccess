const crypto = require('crypto');
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const KEYFILE_PATH = path.join(__dirname, '../risc-service-account.json');

const WEBHOOK_URL = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/risc-webhook`
    : 'https://thiagoglaser.ddns.net/api/auth/google/risc-webhook';

async function registerRiscEndpoint() {
    console.log(`\nAttempting to register Google RISC webhook: ${WEBHOOK_URL}`);
    console.log(`Looking for Service Account key file at: ${KEYFILE_PATH}\n`);

    let sa;
    try {
        sa = require(KEYFILE_PATH);
    } catch (e) {
        console.error(`\n❌ FAILED: File Not Found or Invalid JSON!\n   You must place the JSON Service Account Key inside the TravelAccess project root folder.\n   Rename it exactly to: risc-service-account.json\n`);
        process.exit(1);
    }

    try {
        // Create a self-signed JWT for the RISC API
        const headerObj = { alg: 'RS256', typ: 'JWT' };
        const header = Buffer.from(JSON.stringify(headerObj))
            .toString('base64url').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const now = Math.floor(Date.now() / 1000);
        const claimObj = {
            iss: sa.client_email,
            sub: sa.client_email,
            aud: 'https://risc.googleapis.com/',
            exp: now + 3600,
            iat: now
        };
        const claim = Buffer.from(JSON.stringify(claimObj))
            .toString('base64url').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const sig = crypto.createSign('RSA-SHA256').update(header + '.' + claim)
            .sign(sa.private_key, 'base64url').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const jwt = `${header}.${claim}.${sig}`;

        // The URL for the RISC configuration update endpoint
        const riscConfigHost = 'risc.googleapis.com';
        const riscConfigPath = '/v1beta/stream:update';

        // The payload defining where Google should send security events
        const updatePayload = JSON.stringify({
            delivery: {
                delivery_method: 'https://schemas.openid.net/secevent/risc/delivery-method/push',
                url: WEBHOOK_URL,
            },
            events_requested: [
                'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
                'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
                'https://schemas.openid.net/secevent/risc/event-type/account-hijacked',
                'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required'
            ],
        });

        // Execute the POST request
        console.log('Sending registration request to Google RISC API...');

        const req = https.request({
            hostname: riscConfigHost,
            path: riscConfigPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            }
        });

        req.on('response', res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ SUCCESS! Your webhook has been registered.');
                    console.log(`Google will now actively push security events to: ${WEBHOOK_URL}`);
                } else {
                    console.error('❌ FAILED to register RISC Endpoint.');
                    console.error('Status:', res.statusCode);
                    try {
                        console.error('Error Details:', JSON.stringify(JSON.parse(body), null, 2));
                    } catch (e) {
                        console.error('Error Details:', body);
                    }
                    process.exit(1);
                }
            });
        });

        req.on('error', error => {
            console.error('❌ Network Error while reaching Google RISC API:', error.message);
            process.exit(1);
        });

        req.write(updatePayload);
        req.end();

    } catch (error) {
        console.error('❌ Unexpected Error:', error.message);
        process.exit(1);
    }
}

registerRiscEndpoint();
