'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Sparkles, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await api.signup(email, password);
            // Use window.location for full page reload to ensure auth state updates
            window.location.href = '/';
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Signup failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            {/* Brand Side */}
            <div className="auth-brand">
                <div className="auth-brand-logo">
                    <div className="auth-brand-icon">
                        <Sparkles size={20} />
                    </div>
                    <span>ShopGPT</span>
                </div>
            </div>

            {/* Form Side */}
            <div className="auth-form-side">
                <div className="auth-card">
                    <h1 className="auth-title">Create an account</h1>
                    <p className="auth-subtitle">Join and Shop Anything.</p>

                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '12px 16px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 16,
                            color: 'var(--error)',
                            fontSize: 14,
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label">Your email</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Create password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input"
                                    placeholder="Min 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{ paddingRight: 44 }}
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--gray-400)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Confirm the password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    className="input"
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    style={{ paddingRight: 44 }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--gray-400)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <label className="auth-remember">
                            <input type="checkbox" />
                            Remember me
                        </label>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: 8 }}
                            disabled={isLoading}
                        >
                            {isLoading ? <div className="spinner" /> : 'Create Account'}
                        </button>
                    </form>

                    <div className="auth-divider">or continue with</div>

                    <button
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                        onClick={() => alert('Google OAuth requires configuration. See .env.example')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign-in with Google
                    </button>

                    <p className="auth-footer">
                        Already have an account? <Link href="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
