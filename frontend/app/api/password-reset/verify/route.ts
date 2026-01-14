import { NextRequest, NextResponse } from 'next/server';
import { otpStore } from '@/lib/otpStore';

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { success: false, message: 'Email and token are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const stored = otpStore.get(`reset_${normalizedEmail}`);

    if (!stored) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired reset link' },
        { status: 404 }
      );
    }

    // Check expiration
    if (Date.now() > stored.expires) {
      otpStore.delete(`reset_${normalizedEmail}`);
      return NextResponse.json(
        { success: false, message: 'Reset link has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    // Verify token
    if (stored.otp === token) {
      // Don't delete yet - will delete after password is actually changed
      return NextResponse.json({
        success: true,
        message: 'Token verified successfully',
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid reset link' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('❌ Verify reset token error:', error);
    return NextResponse.json(
      { success: false, message: 'Verification failed' },
      { status: 500 }
    );
  }
}
