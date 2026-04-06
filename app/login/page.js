'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}


function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t, locale, changeLanguage } = useTranslation();

    const GOOGLE_ERROR_MESSAGES = {
        google_denied: t('login.googleErrors.denied'),
        google_no_code: t('login.googleErrors.noCode'),
        google_no_token: t('login.googleErrors.noToken'),
        google_no_email: t('login.googleErrors.noEmail'),
        google_db_error: t('login.googleErrors.dbError'),
        google_server_error: t('login.googleErrors.serverError'),
    };

    useEffect(() => {
        const registered = searchParams.get('registered');
        const verified = searchParams.get('verified');
        const googleError = searchParams.get('error');

        if (registered === 'true') {
            setSuccess(t('login.successRegistered'));
        }
        if (verified === 'true') {
            setSuccess(t('login.successVerified'));
        }
        if (googleError && GOOGLE_ERROR_MESSAGES[googleError]) {
            setError(GOOGLE_ERROR_MESSAGES[googleError]);
        }
    }, [searchParams, t]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (data.success) {
                router.push('/');
                router.refresh();
            } else {
                setError(data.error || t('login.errorDefault'));
            }
        } catch (err) {
            setError(t('login.errorOccurred'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        window.location.href = '/api/auth/google';
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
            <div className="max-w-md w-full p-8 rounded-2xl bg-white shadow-2xl border border-gray-200 backdrop-blur-sm">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {t('login.title')}
                    </h1>
                    <p className="text-gray-500 mt-2">{t('login.subtitle')}</p>
                </div>

                <div className="mb-8 space-y-4">
                    <p className="text-sm text-gray-600 leading-relaxed text-center">
                        {t('login.description')}
                    </p>
                    
                    <div className="p-3 bg-blue-100 border border-blue-200 rounded-xl">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{t('login.demoTitle')}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                            {t('login.demoDescription')}
                            <br />
                            <span className="text-gray-600 font-mono mt-1 block">User: <b className="text-blue-300">demo</b> / Pass: <b className="text-blue-300">demo123</b></span>
                        </p>
                    </div>
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

                {/* Google Sign-In Button */}
                <button
                    id="btn-google-signin"
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl transition-all shadow-lg mb-6 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <GoogleIcon />
                    {t('login.googleSignIn')}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-slate-700" />
                    <span className="text-slate-500 text-sm">{t('login.divider')}</span>
                    <div className="flex-1 h-px bg-slate-700" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">{t('login.username')}</label>
                        <input
                            id="input-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                            placeholder={t('login.placeholderUsername')}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">{t('login.password')}</label>
                        <input
                            id="input-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                            placeholder={t('login.placeholderPassword')}
                            required
                        />
                    </div>

                    <button
                        id="btn-signin"
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-slate-900 font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading ? t('login.signingIn') : t('login.signIn')}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500 space-y-3">
                    <div>
                        {t('login.noAccount')}{' '}
                        <a href="/register" className="text-blue-600 hover:text-blue-300 transition-colors">
                            {t('login.register')}
                        </a>
                    </div>
                    <div>
                        <a href="/forgot-password" id="link-forgot-password" className="text-slate-500 hover:text-gray-600 transition-colors">
                            {t('login.forgotPassword')}
                        </a>
                    </div>
                    <div>
                        <a href="/forgot-username" id="link-forgot-username-recovery" className="text-slate-500 hover:text-gray-600 transition-colors text-xs opacity-80">
                            {t('login.forgotUsername')}
                        </a>
                    </div>

                    {/* Language Switcher on Login Page */}
                    <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => changeLanguage('en')}
                            className={`text-xs font-bold transition-all ${locale === 'en' ? 'text-blue-600 bg-blue-100 px-2 py-1 rounded' : 'text-slate-500 hover:text-gray-600'}`}
                        >
                            ENGLISH
                        </button>
                        <button
                            onClick={() => changeLanguage('pt-br')}
                            className={`text-xs font-bold transition-all ${locale === 'pt-br' ? 'text-blue-600 bg-blue-100 px-2 py-1 rounded' : 'text-slate-500 hover:text-gray-600'}`}
                        >
                            PORTUGUÊS
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LoadingContent() {
    const { t } = useTranslation();
    return <>{t('common.loading')}</>;
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
                <LoadingContent />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
