import { NextRequest, NextResponse } from 'next/server';
import { otpStore } from '@/lib/otpStore';

export async function GET(request: NextRequest) {
  const allOtps: any = {};
  
  // @ts-ignore - accessing store for debugging
  for (const [email, data] of otpStore.store.entries()) {
    allOtps[email] = {
      otp: data.otp,
      expiresIn: Math.round((data.expires - Date.now()) / 1000) + 's',
      attempts: data.attempts,
    };
  }

  return NextResponse.json({
    count: otpStore.store.size,
    otps: allOtps,
  });
}
