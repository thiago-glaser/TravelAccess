'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function ManageOtherExpensesPage() {
    const [expenses, setExpenses] = useState([]);
    const [cars, setCars] = useState([]);
    const [expenseTypes, setExpenseTypes] = useState([]);

    // Form fields
    const [selectedCarId, setSelectedCarId] = useState('');
    const [selectedTypeId, setSelectedTypeId] = useState('');
    const [expenseDate, setExpenseDate] = useState(''); 
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [userProfile, setUserProfile] = useState(null);
    const { t } = useTranslation();

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user) {
                    setUserProfile(data.user);
                }
            })
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        Promise.all([fetchCars(), fetchTypes()]).then(() => fetchExpenses());
    }, []);

    const fetchCars = async () => {
        try {
            const res = await fetch('/api/user/cars');
            const data = await res.json();
            if (data.success) {
                setCars(data.cars);
                if (data.cars.length > 0) setSelectedCarId(data.cars[0].ID.toString());
            }
        } catch (err) {
            console.error('Failed to fetch cars', err);
        }
    };

    const fetchTypes = async () => {
        try {
            const res = await fetch('/api/user/expense-types');
            const data = await res.json();
            if (data.success) {
                setExpenseTypes(data.types);
                if (data.types.length > 0) setSelectedTypeId(data.types[0].id.toString());
            }
        } catch (err) {
            console.error('Failed to fetch types', err);
        }
    };

    const fetchExpenses = async () => {
        try {
            const res = await fetch('/api/user/other-expenses');
            const data = await res.json();
            if (data.success) {
                setExpenses(data.expenses);
            }
        } catch (err) {
            console.error('Failed to fetch expenses', err);
            setError(t('expenses.loadingFailed') || 'Failed to fetch expenses');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setReceiptFile(file);
            if (file.type.startsWith('image/')) {
                setReceiptPreview(URL.createObjectURL(file));
            } else if (file.type === 'application/pdf') {
                setReceiptPreview('pdf'); 
            } else {
                setReceiptPreview(null);
            }
        } else {
            setReceiptFile(null);
            setReceiptPreview(null);
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        if (!selectedCarId || !selectedTypeId || !expenseDate || !amount || !description) {
            setError(t('expenses.fillMandatory') || 'Please fill all mandatory fields');
            setSubmitting(false);
            return;
        }

        try {
            const dateObj = new Date(expenseDate);
            if (isNaN(dateObj.getTime())) {
                setError(t('expenses.invalidDate') || 'Invalid date');
                setSubmitting(false);
                return;
            }

            const formData = new FormData();
            formData.append('carId', selectedCarId);
            formData.append('expenseTypeId', selectedTypeId);
            formData.append('expenseDateIso', dateObj.toISOString());
            formData.append('amount', amount);
            formData.append('description', description);
            if (receiptFile) formData.append('receipt', receiptFile);

            const res = await fetch('/api/user/other-expenses', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                setSuccess(t('expenses.addSuccess') || 'Added successfully');
                setExpenseDate('');
                setAmount('');
                setDescription('');
                setReceiptFile(null);
                setReceiptPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                fetchExpenses();
            } else {
                setError(data.error || 'Failed to add expense');
            }
        } catch (err) {
            setError(t('common.errorOccurred') || 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveExpense = async (id) => {
        if (!confirm(t('expenses.removeConfirm') || 'Delete this expense?')) return;

        try {
            const res = await fetch(`/api/user/other-expenses?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setSuccess(t('expenses.removeSuccess') || 'Removed successfully');
                fetchExpenses();
            } else {
                setError(data.error || 'Failed to remove');
            }
        } catch (err) {
            setError(t('common.errorOccurred') || 'Error occurred');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 text-slate-900 p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            {t('expenses.title') || 'Other Expenses'}
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 mt-2">{t('expenses.subtitle') || 'Manage trackable expenses for your vehicles'}</p>
                    </div>
                </header>

                <div className="grid gap-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">{t('expenses.addEntry') || 'Add Expense Entry'}</h2>
                            <Link href="/dashboard/expense-types" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-200 font-bold hover:bg-blue-100 transition-colors">
                                {t('expenses.manageTypesBtn') || 'Manage Types'}
                            </Link>
                        </div>

                        {cars.length === 0 && !loading && (
                            <div className="mb-4 text-orange-600 bg-orange-50 p-3 rounded-xl text-sm border border-orange-200">
                                {t('expenses.noCarWarning') || 'You need a car to add an expense.'} <Link href="/dashboard/cars" className="underline font-bold">Manage Cars</Link>
                            </div>
                        )}
                        {expenseTypes.length === 0 && !loading && (
                            <div className="mb-4 text-orange-600 bg-orange-50 p-3 rounded-xl text-sm border border-orange-200">
                                {t('expenses.noTypeWarning') || 'You need an expense type to add an expense.'} <Link href="/dashboard/expense-types" className="underline font-bold">Manage Types</Link>
                            </div>
                        )}

                        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('expenses.carLabel') || 'Car'}</label>
                                <select
                                    value={selectedCarId}
                                    onChange={(e) => setSelectedCarId(e.target.value)}
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    required
                                    disabled={cars.length === 0}
                                >
                                    <option value="" disabled>{t('expenses.selectCar') || 'Select a Car'}</option>
                                    {cars.map(c => (
                                        <option key={c.ID} value={c.ID}>
                                            {c.DESCRIPTION ? `${c.DESCRIPTION} (${c.LICENSE_PLATE || 'N/A'})` : (c.LICENSE_PLATE || `Car #${c.ID}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('expenses.typeLabel') || 'Expense Type'}</label>
                                <select
                                    value={selectedTypeId}
                                    onChange={(e) => setSelectedTypeId(e.target.value)}
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    required
                                    disabled={expenseTypes.length === 0}
                                >
                                    <option value="" disabled>{t('expenses.selectType') || 'Select Type'}</option>
                                    {expenseTypes.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('expenses.dateTimeLabel') || 'Date & Time'}</label>
                                <input
                                    type="datetime-local"
                                    step="1"
                                    value={expenseDate}
                                    onChange={(e) => setExpenseDate(e.target.value)}
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full [color-scheme:light]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('expenses.amountLabel') || 'Amount'}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 font-bold">$</span>
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
                            
                            <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('expenses.descriptionLabel') || 'Description'}</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t('expenses.descriptionPlaceholder') || 'Enter details...'}
                                    maxLength="1000"
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400 min-h-[100px]"
                                    required
                                />
                                <div className="text-right text-xs text-gray-400 dark:text-slate-500 mt-1">{description.length}/1000</div>
                            </div>

                            <div className="md:col-span-2 flex flex-col gap-2 mt-2">
                                <label className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('expenses.receiptLabel') || 'Receipt (Optional)'}</label>
                                <div className="flex flex-col items-start gap-4 p-4 border border-dashed border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        capture="environment"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="text-sm text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:bg-blue-900/30 file:text-blue-700 hover:file:bg-blue-100 transition-colors file:cursor-pointer"
                                    />
                                    {receiptPreview && (
                                        <div className="relative group">
                                            {receiptPreview === 'pdf' ? (
                                                <div className="h-32 w-24 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 flex flex-col items-center justify-center p-2 text-red-500">
                                                    <span className="text-[10px] uppercase font-bold mt-1">PDF</span>
                                                </div>
                                            ) : (
                                                <img src={receiptPreview} alt="Receipt Preview" className="h-32 rounded-lg border border-gray-200 dark:border-slate-700 object-contain bg-gray-100 dark:bg-slate-800" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setReceiptFile(null); setReceiptPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-transform active:scale-95"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || cars.length === 0 || expenseTypes.length === 0 || userProfile?.isDemo}
                                className="md:col-span-2 mt-4 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50 text-lg"
                            >
                                {submitting ? 'Saving...' : 'Add Expense'}
                            </button>
                        </form>
                        {error && <p className="mt-4 text-red-600 text-sm font-medium">{error}</p>}
                        {success && <p className="mt-4 text-green-600 text-sm font-medium">{success}</p>}
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
                            <h2 className="text-xl font-semibold">{t('expenses.logsTitle') || 'Log'}</h2>
                            <span className="text-xs bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 px-3 py-1 rounded-full">{expenses.length} total</span>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {loading ? (
                                <div className="p-10 text-center text-gray-500 dark:text-slate-400">Loading...</div>
                            ) : expenses.length === 0 ? (
                                <div className="p-10 text-center text-gray-500 dark:text-slate-400 font-medium italic">No expenses added yet.</div>
                            ) : (
                                expenses.map((entry) => {
                                    const rawDate = new Date(entry.expenseDate);
                                    const localDate = rawDate.toLocaleString();

                                    return (
                                        <div key={entry.id} className="p-6 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors">
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center border border-blue-200 flex-shrink-0 text-blue-600 dark:text-blue-400 font-bold">$</div>
                                                        <div>
                                                            <div className="text-lg font-bold text-slate-800">
                                                                ${parseFloat(entry.amount).toFixed(2)}
                                                            </div>
                                                            <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                                {entry.expenseTypeName} • {entry.carDescription || entry.carLicensePlate || `Car #${entry.carId}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase block mb-1">Date</span>
                                                            <div className="text-gray-700 dark:text-slate-300">{localDate}</div>
                                                        </div>
                                                        <div className="sm:col-span-2">
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase block mb-1">Description</span>
                                                            <div className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{entry.description}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 md:pl-6">
                                                    {entry.hasReceipt ? (
                                                        <a
                                                            href={`/api/user/other-expenses/${entry.id}/receipt`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-col items-center gap-1 group text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:text-blue-400"
                                                        >
                                                            <div className="w-12 h-12 bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-gray-200 dark:border-slate-700">
                                                                <span className="text-[10px] font-bold uppercase">Open</span>
                                                            </div>
                                                        </a>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1 text-gray-400 dark:text-slate-500">
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-dashed border-gray-300 dark:border-slate-600">
                                                                <span className="text-[10px] font-bold uppercase">No Rec</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="w-px h-10 bg-gray-200 dark:bg-slate-700 hidden md:block"></div>

                                                    <button
                                                        onClick={() => handleRemoveExpense(entry.id)}
                                                        className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all uppercase disabled:opacity-30"
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
                    <Link href="/" className="inline-flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:text-blue-400 font-medium">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
