/**
 * Email notification service using Resend.
 *
 * Set RESEND_API_KEY in .env to enable sending.
 * When not configured, emails are logged to console.
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

let resendClient: any = null;

async function getClient() {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const { Resend } = await import('resend');
  resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const client = await getClient();

  if (!client) {
    console.log(`[Email] (dev mode) To: ${options.to}, Subject: ${options.subject}`);
    return true;
  }

  try {
    await client.emails.send({
      from: process.env.EMAIL_FROM || 'Casper <noreply@casperwriter.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendExportNotification(email: string, bookTitle: string, downloadUrl: string) {
  return sendEmail({
    to: email,
    subject: `Your export of "${bookTitle}" is ready`,
    html: `
      <h2>Your export is ready!</h2>
      <p>Your DOCX export of <strong>${bookTitle}</strong> has been generated.</p>
      <p><a href="${downloadUrl}">Download your file</a></p>
      <p>This link will expire in 24 hours.</p>
      <br/>
      <p style="color: #666; font-size: 12px;">- Casper, your AI writing assistant</p>
    `,
  });
}

export async function sendWelcomeEmail(email: string, name?: string) {
  return sendEmail({
    to: email,
    subject: 'Welcome to Casper!',
    html: `
      <h2>Welcome to Casper${name ? `, ${name}` : ''}!</h2>
      <p>You're all set to start writing your next book with AI assistance.</p>
      <h3>Getting Started:</h3>
      <ol>
        <li>Create a new book project</li>
        <li>Build your outline</li>
        <li>Upload source materials for context</li>
        <li>Start writing with Casper's AI assistance</li>
      </ol>
      <p>Happy writing!</p>
      <br/>
      <p style="color: #666; font-size: 12px;">- The Casper Team</p>
    `,
  });
}
