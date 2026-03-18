'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function ForgotUsernamePage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { t, changeLanguage, locale } = useTranslation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/auth/forgot-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (data.success) {
                // User requirement: always say sending, and do not show the email address
                setSuccess(t('forgotUsername.successMessage'));
                setEmail(''); // Clear the email for privacy
            } else {
                setError(data.error || t('forgotUsername.errorMessage'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white relative">
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

            <div className="max-w-md w-full p-8 rounded-2xl bg-[#1e293b] shadow-2xl border border-slate-700 backdrop-blur-sm">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        TravelAccess
                    </h1>
                    <p className="text-slate-400 mt-2">{t('forgotUsername.title')}</p>
                </div>

                <div className="mb-8 font-light text-slate-300 text-sm leading-relaxed text-center">
                    {t('forgotUsername.description')}
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

                {!success && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">{t('forgotUsername.email')}</label>
                            <input
                                id="input-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                                placeholder={t('forgotUsername.emailPlaceholder')}
                                required
                            />
                        </div>

                        <button
                            id="btn-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? t('forgotUsername.sendingButton') : t('forgotUsername.sendButton')}
                        </button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-slate-700 text-center text-sm text-slate-400">
                    <a href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                        {t('forgotUsername.backToLogin')}
                    </a>
                </div>
            </div>
        </div>
    );
}
