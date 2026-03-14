'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
    const [success, setSuccess] = useState('');
    const [userProfile, setUserProfile] = useState(null);

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
            setError('Failed to fetch insurance entries');
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
            setError('Please fill in all mandatory fields');
            setSubmitting(false);
            return;
        }

        try {
            const dateObj = new Date(paymentDate);
            if (isNaN(dateObj.getTime())) {
                setError('Invalid date selected');
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
                setSuccess('Insurance entry added successfully!');
                setPaymentDate('');
                setPeriod('');
                setAmount('');
                fetchInsurances();
            } else {
                setError(data.error || 'Failed to add insurance entry');
            }
        } catch (err) {
            setError('An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveInsurance = async (id) => {
        if (!confirm(`Are you sure you want to remove this insurance entry?`)) return;

        try {
            const res = await fetch(`/api/user/insurance?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Insurance entry removed successfully');
                fetchInsurances();
            } else {
                setError(data.error || 'Failed to remove insurance entry');
            }
        } catch (err) {
            setError('An error occurred');
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Manage Insurance
                    </h1>
                    <p className="text-slate-400 mt-2">Track insurance expenses and coverage periods for your cars.</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Form */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">Add Insurance Entry</h2>

                        {cars.length === 0 && !loading && (
                            <div className="mb-4 text-orange-400 bg-orange-400/10 p-3 rounded-xl text-sm border border-orange-400/20">
                                You need to add a car first before logging insurance. <Link href="/dashboard/cars" className="underline font-bold">Manage Cars</Link>
                            </div>
                        )}

                        <form onSubmit={handleAddInsurance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-400 font-medium">Car *</label>
                                <select
                                    value={selectedCarId}
                                    onChange={(e) => setSelectedCarId(e.target.value)}
                                    className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    required
                                    disabled={cars.length === 0}
                                >
                                    <option value="" disabled>Select a Car</option>
                                    {cars.map(c => (
                                        <option key={c.ID} value={c.ID}>
                                            {c.DESCRIPTION ? `${c.DESCRIPTION} (${c.LICENSE_PLATE || 'N/A'})` : (c.LICENSE_PLATE || `Car #${c.ID}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-400 font-medium">Payment Date *</label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full [color-scheme:dark]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-400 font-medium">Period (Month/Year) *</label>
                                <input
                                    type="month"
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all [color-scheme:dark]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-400 font-medium">Amount *</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || cars.length === 0 || userProfile?.isDemo}
                                className="md:col-span-2 mt-4 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                            >
                                {userProfile?.isDemo ? 'View Only Mode' : (submitting ? 'Saving...' : 'Add Insurance')}
                            </button>
                        </form>

                        {error && <p className="mt-4 text-red-400 text-sm font-medium">{error}</p>}
                        {success && <p className="mt-4 text-green-400 text-sm font-medium">{success}</p>}
                    </div>

                    {/* List */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/20">
                            <h2 className="text-xl font-semibold">Insurance Entries</h2>
                            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">{insurances.length} Total</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">Loading insurance entries...</div>
                            ) : insurances.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">No insurance logged yet</div>
                            ) : (
                                insurances.map((entry) => {
                                    const rawDate = new Date(entry.paymentDate);
                                    const localDate = rawDate.toLocaleDateString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                    });

                                    return (
                                        <div key={entry.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex-1">

                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                                                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-slate-200">
                                                                ${parseFloat(entry.amount).toFixed(2)}
                                                            </div>
                                                            <div className="text-sm font-medium text-blue-400">
                                                                Period: {entry.period}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">Payment Date</span>
                                                            <div className="text-sm text-slate-300">{localDate}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">Car</span>
                                                            <div className="text-sm text-slate-300 font-medium">
                                                                {entry.carDescription || entry.carLicensePlate || `Car #${entry.carId}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>

                                                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6">
                                                    <button
                                                        onClick={() => handleRemoveInsurance(entry.id)}
                                                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg border border-transparent hover:border-red-400/20 transition-all uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                                                        disabled={submitting || userProfile?.isDemo}
                                                    >
                                                        Delete
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
                    <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-400 transition-colors font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
