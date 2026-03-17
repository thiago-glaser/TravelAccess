'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (data.success) {
                setSuccess('If an account exists with that email, a password reset link has been sent.');
            } else {
                setError(data.error || 'Something went wrong. Please try again.');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
            <div className="max-w-md w-full p-8 rounded-2xl bg-[#1e293b] shadow-2xl border border-slate-700 backdrop-blur-sm">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        TravelAccess
                    </h1>
                    <p className="text-slate-400 mt-2">Reset your password</p>
                </div>

                <div className="mb-8 font-light text-slate-300 text-sm leading-relaxed text-center">
                    Enter the email address associated with your account and we'll send you a link to reset your password.
                </div>

                {success && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">
                        {success}
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                        <input
                            id="input-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <button
                        id="btn-submit"
                        type="submit"
                        disabled={loading || success}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading ? 'Sending link...' : 'Send Reset Link'}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-700 text-center text-sm text-slate-400">
                    <a href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                        Back to Login
                    </a>
                </div>
            </div>
        </div>
    );
}
