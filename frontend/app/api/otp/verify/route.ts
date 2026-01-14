import { NextRequest, NextResponse } from 'next/server';
import { otpStore } from '@/lib/otpStore';

export async function POST(request: NextRequest) {
  try {
    const { email, otp, skipDelete } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, message: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Trim and normalize inputs
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.toString().trim();
    
    console.log(`🔍 Verifying OTP for ${normalizedEmail}: "${normalizedOtp}"`);
    console.log(`   OTP type: ${typeof normalizedOtp}, length: ${normalizedOtp.length}`);
    console.log(`   Skip delete: ${skipDelete}`);
    
    const stored = otpStore.get(normalizedEmail);

    if (!stored) {
      console.log(`❌ No OTP found for ${normalizedEmail}`);
      console.log(`   Available emails in store:`, Array.from(otpStore.store.keys()));
      return NextResponse.json(
        { success: false, message: 'No OTP found. Please request a new one.' },
        { status: 404 }
      );
    }

    console.log(`📋 Stored OTP: "${stored.otp}" (type: ${typeof stored.otp}, length: ${stored.otp.length})`);
    console.log(`📋 Received OTP: "${normalizedOtp}" (type: ${typeof normalizedOtp}, length: ${normalizedOtp.length})`);
    console.log(`📋 Comparison: "${stored.otp}" === "${normalizedOtp}" = ${stored.otp === normalizedOtp}`);

    // Check expiration
    if (Date.now() > stored.expires) {
      console.log(`⏰ OTP expired for ${normalizedEmail}`);
      otpStore.delete(normalizedEmail);
      return NextResponse.json(
        { success: false, message: 'OTP has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    // Check attempts
    if (stored.attempts >= 5) {
      console.log(`🚫 Too many attempts for ${normalizedEmail}`);
      otpStore.delete(normalizedEmail);
      return NextResponse.json(
        { success: false, message: 'Too many failed attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // Verify OTP
    if (stored.otp === normalizedOtp) {
      console.log(`✅ OTP verified successfully for ${normalizedEmail}`);
      
      // Only delete if not skipping (final verification)
      if (!skipDelete) {
        otpStore.delete(normalizedEmail);
        console.log(`🗑️ OTP deleted after final verification`);
      } else {
        console.log(`⏸️ OTP kept in store for password step`);
      }
      
      return NextResponse.json({
        success: true,
        message: 'OTP verified successfully',
      });
    }

    // Increment attempts
    stored.attempts++;
    otpStore.set(normalizedEmail, stored);

    console.log(`❌ Invalid OTP for ${normalizedEmail}. Attempts: ${stored.attempts}/5`);

    return NextResponse.json(
      {
        success: false,
        message: `Invalid OTP. ${5 - stored.attempts} attempts remaining.`,
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('❌ Verify OTP error:', error);
    return NextResponse.json(
      { success: false, message: 'Verification failed' },
      { status: 500 }
    );
  }
}
