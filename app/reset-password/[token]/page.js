'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const params = useParams();
    const token = params.token;
    const { t, changeLanguage, locale } = useTranslation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError(t('resetPassword.passwordsDoNotMatch'));
            return;
        }

        if (password.length < 6) {
            setError(t('resetPassword.passwordTooShort'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(t('resetPassword.successMessage'));
                setTimeout(() => {
                    router.push('/login');
                }, 3000);
            } else {
                setError(data.error || t('resetPassword.invalidToken'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 relative">
            {/* Language Switcher */}
            <div className="absolute top-4 right-4 z-20">
                <div className="flex items-center gap-2 bg-gray-100 backdrop-blur-sm p-1 rounded-lg border border-gray-200">
                    <button
                        onClick={() => changeLanguage('en')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${locale === 'en' ? 'bg-blue-600 text-slate-900 shadow-lg' : 'text-gray-500 hover:text-slate-900'}`}
                    >
                        EN
                    </button>
                    <button
                        onClick={() => changeLanguage('pt-br')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${locale === 'pt-br' ? 'bg-blue-600 text-slate-900 shadow-lg' : 'text-gray-500 hover:text-slate-900'}`}
                    >
                        PT
                    </button>
                </div>
            </div>

            <div className="max-w-md w-full p-8 rounded-2xl bg-white shadow-2xl border border-gray-200 backdrop-blur-sm">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        TravelAccess
                    </h1>
                    <p className="text-gray-500 mt-2">{t('resetPassword.title')}</p>
                </div>

                {success && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-600 text-sm">
                        {success}
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {!success && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">{t('resetPassword.password')}</label>
                            <input
                                id="input-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                                placeholder={t('resetPassword.passwordPlaceholder')}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">{t('resetPassword.confirmPassword')}</label>
                            <input
                                id="input-confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                                placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                                required
                            />
                        </div>

                        <button
                            id="btn-reset"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-slate-900 font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? t('resetPassword.resettingButton') : t('resetPassword.resetButton')}
                        </button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                    <a href="/login" className="text-blue-600 hover:text-blue-300 transition-colors">
                        {t('resetPassword.backToLogin')}
                    </a>
                </div>
            </div>
        </div>
    );
}
