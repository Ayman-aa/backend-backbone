import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();


export function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // Always 6 digits
}

export const send2FACode = async (to: string, code: string) => {
  // Debug logging
  console.log('SMTP_USER from env:', process.env.SMTP_USER);
  console.log('SMTP_PASS exists:', !!process.env.SMTP_PASS);
  
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  try {
    console.log(`[Email Service] Attempting to send 2FA code to: ${to}`);

    const info = await transporter.sendMail({
      from: '"Bounce Auth" <abkabex4749@gmail.com>',
      to,
      subject: 'Your 2FA Code 🔐',
      html: `
            <div style="font-family:sans-serif; font-size:15px;">
              <p>Hello 👋,</p>
              <p>Your <strong>2FA code</strong> is:</p>
              <h2 style="letter-spacing:3px;">${code}</h2>
              <p>This code is valid for 5 minutes. Do not share it with anyone.</p>
              <br/>
              <p style="font-size:12px; color:gray;">— Bounce Security System</p>
            </div>
          ` 
    });

    console.log('[Email Service] Email sent successfully! Message ID:', info.messageId);
    console.log('[Email Service] Full response:', info);

  } catch (error) {
    console.error('[Email Service] FAILED TO SEND EMAIL:', error);
  }
};
