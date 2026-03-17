'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VerifyEmailPage() {
    const [status, setStatus] = useState('verifying');
    const [error, setError] = useState('');
    const params = useParams();
    const router = useRouter();
    const token = params.token;

    useEffect(() => {
        const verify = async () => {
            if (!token) return;

            try {
                const res = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (data.success) {
                    setStatus('success');
                    setTimeout(() => {
                        router.push('/login?verified=true');
                    }, 3000);
                } else {
                    setStatus('error');
                    setError(data.error || 'Verification failed');
                }
            } catch (err) {
                setStatus('error');
                setError('An unexpected error occurred');
            }
        };

        verify();
    }, [token, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
            <div className="max-w-md w-full p-8 rounded-2xl bg-[#1e293b] shadow-2xl border border-slate-700 backdrop-blur-sm text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-6">
                    TravelAccess
                </h1>

                {status === 'verifying' && (
                    <div className="space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-slate-300">Verifying your email address...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-4">
                        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                            ✓
                        </div>
                        <h2 className="text-2xl font-semibold text-green-400">Email Verified!</h2>
                        <p className="text-slate-400">Your account is now active. Redirecting to login...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-4">
                        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                            ✕
                        </div>
                        <h2 className="text-2xl font-semibold text-red-400">Verification Failed</h2>
                        <p className="text-slate-400">{error}</p>
                        <a href="/login" className="inline-block mt-4 text-blue-400 hover:text-blue-300 transition-colors">
                            Back to Login
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
