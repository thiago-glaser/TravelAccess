'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LanguageContext';

function DeleteAccountConfirm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const { t, changeLanguage, locale } = useTranslation();

    const [status, setStatus] = useState('verifying'); // 'verifying', 'confirming', 'success', 'error'
    const [message, setMessage] = useState(t('deleteAccount.verifying'));

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage(t('deleteAccount.invalidLink'));
        }
    }, [token]);

    const handleConfirm = async () => {
        setStatus('confirming');
        setMessage(t('deleteAccount.processing'));

        try {
            const res = await fetch('/api/auth/delete-account/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            const data = await res.json();

            if (data.success) {
                setStatus('success');
                setMessage(data.message);
                setTimeout(() => {
                    router.push('/login');
                }, 5000);
            } else {
                setStatus('error');
                setMessage(data.error || t('deleteAccount.failed'));
            }
        } catch (err) {
            setStatus('error');
            setMessage(t('common.errorOccurred'));
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative">
            {/* Language Switcher */}
            <div className="absolute top-4 right-4 z-20">
                <div className="flex items-center gap-2 bg-slate-800/50 backdrop-blur-sm p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => changeLanguage('en')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${locale === 'en' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        EN
                    </button>
                    <button
                        onClick={() => changeLanguage('pt-br')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${locale === 'pt-br' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        PT
                    </button>
                </div>
            </div>

            <div className="max-w-md w-full bg-[#1e293b] rounded-2xl shadow-2xl border border-slate-700 p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="mb-6">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                        status === 'success' ? 'bg-green-500/20 text-green-400' : 
                        status === 'error' ? 'bg-red-500/20 text-red-400' : 
                        'bg-red-500/20 text-red-500 animate-pulse'
                    }`}>
                        {status === 'success' ? (
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {status === 'success' ? t('deleteAccount.successTitle') : t('deleteAccount.deletionTitle')}
                    </h2>
                    <p className="text-slate-400">
                        {message}
                    </p>
                </div>

                {status === 'verifying' && token && (
                    <button
                        onClick={handleConfirm}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/40 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {t('deleteAccount.confirmButton')}
                    </button>
                )}

                {status === 'success' && (
                    <div className="mt-6 text-sm text-slate-500 italic">
                        {t('deleteAccount.redirecting')}
                    </div>
                )}

                {(status === 'error' || !token) && (
                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all"
                    >
                        {t('deleteAccount.backToHome')}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function DeleteAccountPage() {
    const { t } = useTranslation();
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
                <div className="text-white">{t('common.loading')}</div>
            </div>
        }>
            <DeleteAccountConfirm />
        </Suspense>
    );
}
