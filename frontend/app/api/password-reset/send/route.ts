import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { otpStore } from '@/lib/otpStore';

// Generate secure reset token
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email, username } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Generate reset token
    const resetToken = generateResetToken();
    const expiresIn = 30 * 60 * 1000; // 30 minutes

    console.log(`🔐 Generated reset token for ${normalizedEmail}`);

    // Store reset token (reusing OTP store structure)
    otpStore.set(`reset_${normalizedEmail}`, {
      otp: resetToken,
      expires: Date.now() + expiresIn,
      attempts: 0,
    });

    // Get first name from username
    const firstName = username && username.trim() !== '' ? username.split(' ')[0] : 'User';

    // Create reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"ENUID" <${process.env.SMTP_USER}>`,
      to: normalizedEmail,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: Arial, Helvetica, sans-serif; 
              line-height: 1.6; 
              color: #000000; 
              margin: 0;
              padding: 0;
              background-color: #ffffff;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 40px 20px;
            }
            .content { 
              padding: 0;
            }
            .greeting {
              font-size: 16px;
              font-weight: normal;
              color: #000000;
              margin-bottom: 20px;
            }
            .message {
              color: #000000;
              margin-bottom: 20px;
              font-size: 15px;
              line-height: 1.6;
            }
            .button-section {
              margin: 30px 0;
              text-align: center;
            }
            .reset-button {
              display: inline-block;
              padding: 15px 40px;
              background-color: #000000;
              color: #ffffff;
              text-decoration: none;
              border-radius: 5px;
              font-weight: bold;
              font-size: 16px;
            }
            .warning {
              margin: 20px 0;
              padding: 15px;
              border: 1px solid #000000;
              font-size: 14px;
              color: #000000;
            }
            .footer { 
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #000000;
              color: #000000; 
              font-size: 12px;
            }
            .team-signature {
              margin-top: 30px;
              font-size: 15px;
              color: #000000;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <div class="greeting">Hello ${firstName},</div>
              
              <p class="message">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              
              <div class="button-section">
                <a href="${resetUrl}" class="reset-button">Reset Password</a>
              </div>
              
              <div class="warning">
                This link will expire in 30 minutes.
              </div>
              
              <p class="message">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              
              <div class="team-signature">
                Thank you,<br>
                Team ENUID
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} ENUID. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${firstName},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 30 minutes.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

Thank you,
Team ENUID

---
This is an automated message, please do not reply.
© ${new Date().getFullYear()} ENUID. All rights reserved.
      `.trim(),
    });

    console.log('✅ Password reset email sent to:', normalizedEmail);

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent successfully',
    });
  } catch (error: any) {
    console.error('❌ Send password reset error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send password reset email' },
      { status: 500 }
    );
  }
}
