import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { otpStore } from '@/lib/otpStore';

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    // Rate limiting check - only allow new OTP if existing one has less than 1 minute left
    const existing = otpStore.get(normalizedEmail);
    if (existing && existing.expires > Date.now() + 1 * 60 * 1000) {
      const remainingTime = Math.ceil((existing.expires - Date.now()) / 1000);
      console.log(`⏱️ Rate limit hit for ${normalizedEmail}. ${remainingTime}s remaining`);
      return NextResponse.json(
        { 
          success: false, 
          message: `Please wait ${Math.ceil(remainingTime / 60)} more minute(s) before requesting another OTP` 
        },
        { status: 429 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresIn = 10 * 60 * 1000; // 10 minutes

    console.log(`🔐 Generated OTP for ${normalizedEmail}: ${otp}`);
    console.log(`   OTP type: ${typeof otp}, length: ${otp.length}`);

    // Cleanup expired OTPs first
    otpStore.cleanup();

    // Store OTP
    otpStore.set(normalizedEmail, {
      otp,
      expires: Date.now() + expiresIn,
      attempts: 0,
    });

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Get first name from username (or use "User" as fallback)
    const firstName = username && username.trim() !== '' ? username.split(' ')[0] : 'User';

    // Send email
    await transporter.sendMail({
      from: `"ENUID" <${process.env.SMTP_USER}>`,
      to: normalizedEmail,
      subject: 'Action Required: Verify your Email Address',
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
            .otp-section {
              margin: 30px 0;
              padding: 20px;
              border: 1px solid #000000;
              text-align: center;
            }
            .otp-label {
              font-size: 14px;
              color: #000000;
              margin-bottom: 15px;
              font-weight: normal;
            }
            .otp-code { 
              font-size: 32px; 
              font-weight: bold; 
              letter-spacing: 8px; 
              color: #000000;
              font-family: 'Courier New', monospace;
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
                We received a request to update your email address. To confirm it's really you, 
                please enter the verification code below:
              </p>
              
              <div class="otp-section">
                <div class="otp-label">Your verification code:</div>
                <div class="otp-code">${otp}</div>
              </div>
              
              <div class="warning">
                This code will expire in 10 minutes.
              </div>
              
              <p class="message">
                If you didn't request this change, you can safely ignore this email.
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

We received a request to update your email address. To confirm it's really you, please enter the verification code below:

Your verification code: ${otp}

This code will expire in 10 minutes.

If you didn't request this change, you can safely ignore this email.

Thank you,
Team ENUID

---
This is an automated message, please do not reply.
© ${new Date().getFullYear()} ENUID. All rights reserved.
      `.trim(),
    });

    console.log('✅ OTP sent to:', normalizedEmail);

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error: any) {
    console.error('❌ Send OTP error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
