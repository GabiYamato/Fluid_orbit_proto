/**
 * Send OTP via API route (uses nodemailer on backend)
 */
export async function sendOTP(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/otp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return {
      success: false,
      message: 'Failed to send OTP',
    };
  }
}

/**
 * Verify OTP via API route
 */
export async function verifyOTP(email: string, otp: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/otp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return {
      success: false,
      message: 'Verification failed',
    };
  }
}
