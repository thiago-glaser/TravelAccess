'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function VerifyEmailPage() {
    const [status, setStatus] = useState('verifying');
    const [error, setError] = useState('');
    const params = useParams();
    const router = useRouter();
    const token = params.token;
    const { t, changeLanguage, locale } = useTranslation();

    useEffect(() => {
        const verify = async () => {
            if (!token) return;

            try {
                console.log('Verifying token...', { token });
                const res = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();
                console.log('Verification response:', data);

                if (data.success) {
                    setStatus('success');
                    setTimeout(() => {
                        router.push('/login?verified=true');
                    }, 3000);
                } else {
                    setStatus('error');
                    setError(data.error || t('verifyEmail.errorDefault'));
                }
            } catch (err) {
                setStatus('error');
                setError(t('common.errorOccurred'));
            }
        };

        verify();
    }, [token, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 text-slate-900 relative">
            {/* Language Switcher */}
            <div className="absolute top-4 right-4 z-20">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 backdrop-blur-sm p-1 rounded-lg border border-gray-200 dark:border-slate-700">
                    <button
                        onClick={() => changeLanguage('en')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${locale === 'en' ? 'bg-blue-600 text-slate-900 shadow-lg' : 'text-gray-500 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                        EN
                    </button>
                    <button
                        onClick={() => changeLanguage('pt-br')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${locale === 'pt-br' ? 'bg-blue-600 text-slate-900 shadow-lg' : 'text-gray-500 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                        PT
                    </button>
                </div>
            </div>

            <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700 backdrop-blur-sm text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6">
                    TravelAccess
                </h1>

                {status === 'verifying' && (
                    <div className="space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-gray-600 dark:text-slate-400">{t('verifyEmail.verifying')}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-4">
                        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                            ✓
                        </div>
                        <h2 className="text-gray-900xl font-semibold text-green-600">{t('verifyEmail.successTitle')}</h2>
                        <p className="text-gray-500 dark:text-slate-400">{t('verifyEmail.successMessage')}</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-4">
                        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                            ✕
                        </div>
                        <h2 className="text-gray-900xl font-semibold text-red-600">{t('verifyEmail.errorTitle')}</h2>
                        <p className="text-gray-500 dark:text-slate-400">{error}</p>
                        <a href="/login" className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-300 transition-colors">
                            {t('verifyEmail.backToLogin')}
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
