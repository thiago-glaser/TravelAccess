import nodemailer from 'nodemailer';

/**
 * Sends an email using Gmail provider.
 * Requires GMAIL_USER and GMAIL_APP_PASSWORD (not normal password) in environment variables.
 * @param {Object} options 
 * @param {string} options.to 
 * @param {string} options.subject 
 * @param {string} options.text 
 * @param {string} options.html 
 */
export async function sendEmail({ to, subject, text, html }) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    const mailOptions = {
        from: `"TravelAccess Support" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        text,
        html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email Sent] Message ID: ${info.messageId} to ${to}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[Email Error] Failed to send email:', error);
        throw error;
    }
}
