'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function ManageInsurancePage() {
    const [insurances, setInsurances] = useState([]);
    const [cars, setCars] = useState([]);

    // Form fields
    const [selectedCarId, setSelectedCarId] = useState('');
    const [paymentDate, setPaymentDate] = useState(''); // local time string
    const [period, setPeriod] = useState('');
    const [amount, setAmount] = useState('');

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [userProfile, setUserProfile] = useState(null);
    const { t } = useTranslation();

    // Fetch user profile on mount
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user) {
                    setUserProfile(data.user);
                }
            })
            .catch(err => console.error('Failed to load user profile:', err));
    }, []);

    useEffect(() => {
        fetchCars().then(() => fetchInsurances());
    }, []);

    const fetchCars = async () => {
        try {
            const res = await fetch('/api/user/cars');
            const data = await res.json();
            if (data.success) {
                setCars(data.cars);
                if (data.cars.length > 0) {
                    setSelectedCarId(data.cars[0].ID.toString());
                }
            }
        } catch (err) {
            console.error('Failed to fetch cars', err);
        }
    };

    const fetchInsurances = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/user/insurance');
            const data = await res.json();
            if (data.success) {
                setInsurances(data.insurances);
            }
        } catch (err) {
            console.error('Failed to fetch insurances', err);
            setError(t('insurance.loadingFailed') || 'Failed to fetch insurance entries');
        } finally {
            setLoading(false);
        }
    };

    const handleAddInsurance = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        if (!selectedCarId || !paymentDate || !period || !amount) {
            setError(t('common.fillAllFields'));
            setSubmitting(false);
            return;
        }

        try {
            const dateObj = new Date(paymentDate);
            if (isNaN(dateObj.getTime())) {
                setError(t('insurance.invalidDate'));
                setSubmitting(false);
                return;
            }

            let finalPeriod = period;
            if (period && period.includes('-')) {
                const [year, monthStr] = period.split('-');
                const monthIndex = parseInt(monthStr, 10) - 1;
                const d = new Date(year, monthIndex);
                finalPeriod = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            }

            const res = await fetch('/api/user/insurance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    carId: selectedCarId,
                    paymentDate: dateObj.toISOString(),
                    period: finalPeriod,
                    amount: parseFloat(amount)
                }),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess(t('insurance.addSuccess'));
                setPaymentDate('');
                setPeriod('');
                setAmount('');
                fetchInsurances();
            } else {
                setError(data.error || t('insurance.addFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveInsurance = async (id) => {
        if (!confirm(t('insurance.removeConfirm'))) return;

        try {
            const res = await fetch(`/api/user/insurance?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(t('insurance.removeSuccess'));
                fetchInsurances();
            } else {
                setError(data.error || t('insurance.removeFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 text-slate-900 p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {t('insurance.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 mt-2">{t('insurance.subtitle')}</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Form */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">{t('insurance.addEntry')}</h2>

                        {cars.length === 0 && !loading && (
                            <div className="mb-4 text-orange-600 bg-orange-400/10 p-3 rounded-xl text-sm border border-orange-400/20">
                                {t('insurance.noCarWarning')} <Link href="/dashboard/cars" className="underline font-bold">{t('insurance.manageCars')}</Link>
                            </div>
                        )}

                        <form onSubmit={handleAddInsurance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('insurance.carLabel')}</label>
                                <select
                                    value={selectedCarId}
                                    onChange={(e) => setSelectedCarId(e.target.value)}
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    required
                                    disabled={cars.length === 0}
                                >
                                    <option value="" disabled>{t('insurance.selectCar')}</option>
                                    {cars.map(c => (
                                        <option key={c.ID} value={c.ID}>
                                            {c.DESCRIPTION ? `${c.DESCRIPTION} (${c.LICENSE_PLATE || 'N/A'})` : (c.LICENSE_PLATE || `Car #${c.ID}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('insurance.paymentDateLabel')}</label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full [color-scheme:light]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('insurance.periodLabel')}</label>
                                <input
                                    type="month"
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all [color-scheme:light]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('insurance.amountLabel')}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || cars.length === 0 || userProfile?.isDemo}
                                className="md:col-span-2 mt-4 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                            >
                                {userProfile?.isDemo ? t('insurance.viewOnly') : (submitting ? t('insurance.saving') : t('insurance.addBtn'))}
                            </button>
                        </form>

                        {error && <p className="mt-4 text-red-600 text-sm font-medium">{error}</p>}
                        {success && <p className="mt-4 text-green-600 text-sm font-medium">{success}</p>}
                    </div>

                    {/* List */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
                            <h2 className="text-xl font-semibold">{t('insurance.entriesTitle')}</h2>
                            <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700">{insurances.length} {t('insurance.total')}</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">{t('insurance.loading')}</div>
                            ) : insurances.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">{t('insurance.noEntries')}</div>
                            ) : (
                                insurances.map((entry) => {
                                    const rawDate = new Date(entry.paymentDate);
                                    const localDate = rawDate.toLocaleDateString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                    });

                                    return (
                                        <div key={entry.id} className="p-6 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex-1">

                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center border border-blue-200">
                                                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-gray-700 dark:text-slate-300">
                                                                ${parseFloat(entry.amount).toFixed(2)}
                                                            </div>
                                                            <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                                {t('insurance.period')}: {entry.period}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">{t('insurance.paymentDate')}</span>
                                                            <div className="text-sm text-gray-600 dark:text-slate-400">{localDate}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">{t('insurance.car')}</span>
                                                            <div className="text-sm text-gray-600 dark:text-slate-400 font-medium">
                                                                {entry.carDescription || entry.carLicensePlate || `Car #${entry.carId}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>

                                                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 pt-4 md:pt-0 md:pl-6">
                                                    <button
                                                        onClick={() => handleRemoveInsurance(entry.id)}
                                                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                                                        disabled={submitting || userProfile?.isDemo}
                                                    >
                                                        {t('insurance.delete')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 dark:text-blue-400 transition-colors font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t('insurance.backToDashboard')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
