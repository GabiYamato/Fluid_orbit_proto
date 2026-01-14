'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface EmailUpdatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onVerify: (newEmail: string, otp: string, password: string) => Promise<boolean>;
  onSendOTP: (newEmail: string) => Promise<boolean>;
}

export default function EmailUpdatePopup({
  isOpen,
  onClose,
  currentEmail,
  onVerify,
  onSendOTP,
}: EmailUpdatePopupProps) {
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setNewEmail('');
      setOtp(['', '', '', '', '', '']);
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  const handleSendOTP = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (newEmail === currentEmail) {
      setError('New email must be different from current email');
      return;
    }

    console.log('📧 Frontend: Sending OTP to:', newEmail);

    setLoading(true);
    setError('');

    try {
      const success = await onSendOTP(newEmail);
      if (success) {
        console.log('✅ Frontend: OTP sent successfully');
        setStep('otp');
        // Clear OTP inputs when sending new OTP
        setOtp(['', '', '', '', '', '']);
      } else {
        console.log('❌ Frontend: Failed to send OTP');
        setError('Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Frontend: Send OTP error:', err);
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter complete OTP');
      return;
    }

    console.log('🔐 Frontend: Verifying OTP');
    console.log('   Email:', newEmail);
    console.log('   OTP:', otpString);

    setLoading(true);
    setError('');

    try {
      // Verify OTP with backend (but don't delete it yet)
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, otp: otpString, skipDelete: true }),
      });
      const data = await response.json();

      if (data.success) {
        console.log('✅ Frontend: OTP verified, now need password');
        // OTP verified, now ask for password
        setStep('password');
      } else {
        console.log('❌ Frontend: OTP verification failed');
        setError(data.message || 'Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Frontend: Verification error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!password || password.length < 8) {
      setError('Please enter your password');
      return;
    }

    console.log('🔐 Frontend: Updating email with password');

    setLoading(true);
    setError('');

    try {
      // Final OTP verification (this time it will delete the OTP)
      const verifyResponse = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, otp: otp.join(''), skipDelete: false }),
      });
      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        setError(verifyData.message || 'OTP verification failed');
        return;
      }

      // Now update email in Appwrite
      const success = await onVerify(newEmail, otp.join(''), password);
      if (success) {
        console.log('✅ Frontend: Email updated successfully');
        onClose();
      } else {
        console.log('❌ Frontend: Email update failed');
        setError('Failed to update email. Please check your password.');
      }
    } catch (err: any) {
      console.error('❌ Frontend: Update error:', err);
      setError(err.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      setLoading(true);
      setError('');

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const username = localStorage.getItem('user_custom_name') || '';
      const userEmail = localStorage.getItem('user_email') || '';

      const response = await fetch(`${API_URL}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          username: username
        }),
      });

      if (response.ok) {
        alert('Password reset code sent! Please check your email.');
        onClose();
      } else {
        setError('Failed to send password reset email');
      }
    } catch (err: any) {
      console.error('❌ Forgot password error:', err);
      setError('Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md pointer-events-auto">
              {step === 'password' ? (
                <>
                  <h2 className="text-2xl font-bold text-black mb-2">Confirm Password</h2>
                  <p className="text-gray-600 mb-6">
                    Enter your current password to update your email to <strong>{newEmail}</strong>
                  </p>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateEmail();
                        }
                      }}
                    />
                  </div>

                  <div className="mb-6 text-right">
                    <button
                      onClick={handleForgotPassword}
                      className="text-sm text-gray-600 hover:text-black transition-colors underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('otp')}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleUpdateEmail}
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : 'Update Email'}
                    </button>
                  </div>
                </>
              ) : step === 'email' ? (
                <>
                  <h2 className="text-2xl font-bold text-black mb-2">Update Email</h2>
                  <p className="text-gray-600 mb-6">
                    Enter your new email address. We'll send a verification code.
                  </p>

                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Email
                    </label>
                    <input
                      type="email"
                      value={currentEmail}
                      readOnly
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Email Address
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter new email"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendOTP}
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Sending...' : 'Send OTP'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-black mb-2">Verify Email</h2>
                  <p className="text-gray-600 mb-6">
                    Enter the 6-digit code sent to <strong>{newEmail}</strong>
                  </p>

                  <div className="flex gap-2 mb-6 justify-center">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      />
                    ))}
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => setStep('email')}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleVerifyOTP}
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>

                  <button
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="w-full text-sm text-gray-600 hover:text-black transition-colors"
                  >
                    Didn't receive code? Resend
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
