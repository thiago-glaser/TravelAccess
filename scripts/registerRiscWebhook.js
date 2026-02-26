const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Make sure to put the downloaded JSON file from Google Cloud inside the project root
// and rename it exactly to 'risc-service-account.json'
const KEYFILE_PATH = path.join(__dirname, '../risc-service-account.json');

// The public URL of your TravelAccess RISC webhook
const WEBHOOK_URL = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/risc-webhook`
    : 'https://thiagoglaser.ddns.net/api/auth/google/risc-webhook';

async function registerRiscEndpoint() {
    console.log(`\nAttempting to register Google RISC webhook: ${WEBHOOK_URL}`);
    console.log(`Looking for Service Account key file at: ${KEYFILE_PATH}\n`);

    try {
        // Create an authenticated client to talk to Google APIs using the downloaded key
        const auth = new google.auth.GoogleAuth({
            keyFile: KEYFILE_PATH,
            // The RISC API requires this exact scope
            scopes: ['https://www.googleapis.com/auth/risc'],
        });

        const authClient = await auth.getClient();

        // The URL for the RISC configuration update endpoint
        const riscConfigUrl = 'https://risc.googleapis.com/v1beta/stream:update';

        // The payload defining where Google should send security events
        const updatePayload = {
            delivery: {
                deliveryMethod: 'https://schemas.openid.net/secevent/risc/delivery-method/push',
                receiverUrl: WEBHOOK_URL,
            },
            eventsRequested: [
                'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
                'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
                'https://schemas.openid.net/secevent/risc/event-type/account-hijacked',
                'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required'
            ],
        };

        // Execute the POST request
        console.log('Sending registration request to Google RISC API...');
        const response = await authClient.request({
            url: riscConfigUrl,
            method: 'POST',
            data: updatePayload,
        });

        if (response.status === 200) {
            console.log('✅ SUCCESS! Your webhook has been registered.');
            console.log(`Google will now actively push security events to: ${WEBHOOK_URL}`);
        } else {
            console.log('⚠️ Request completed, but with unexpected status:', response.status);
            console.log(response.data);
        }

    } catch (error) {
        console.error('❌ FAILED to register RISC Endpoint.');
        console.error('Error Details:');

        if (error.code && error.code === 'ENOENT') {
            console.error(`\n   File Not Found! You must place the JSON Service Account Key inside the TravelAccess project root folder.`);
            console.error(`   Rename it exactly to: risc-service-account.json\n`);
        } else {
            console.error(error.message);
            if (error.response && error.response.data) {
                console.error(JSON.stringify(error.response.data, null, 2));
            }
        }
        process.exit(1);
    }
}

registerRiscEndpoint();
