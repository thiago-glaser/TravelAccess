'use client';

import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function ManageMaintenancePage() {
    const [maintenanceEntries, setMaintenanceEntries] = useState([]);
    const [cars, setCars] = useState([]);

    // Form fields
    const [selectedCarId, setSelectedCarId] = useState('');
    const [maintenanceDate, setMaintenanceDate] = useState(''); // local time string
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
        fetchCars().then(() => fetchMaintenance());
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

    const fetchMaintenance = async () => {
        try {
            const res = await fetch('/api/user/maintenance');
            const data = await res.json();
            if (data.success) {
                setMaintenanceEntries(data.maintenance);
            }
        } catch (err) {
            console.error('Failed to fetch maintenance entries', err);
            setError(t('maintenance.loading').replace('Loading', 'Failed to fetch')); // fallback-ish
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
                setReceiptPreview('pdf'); // Special flag for PDF
            } else {
                setReceiptPreview(null);
            }
        } else {
            setReceiptFile(null);
            setReceiptPreview(null);
        }
    };

    const handleAddMaintenance = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        if (!selectedCarId || !maintenanceDate || !amount || !description) {
            setError(t('maintenance.fillMandatory'));
            setSubmitting(false);
            return;
        }

        try {
            const dateObj = new Date(maintenanceDate);
            if (isNaN(dateObj.getTime())) {
                setError(t('maintenance.invalidDate'));
                setSubmitting(false);
                return;
            }

            const formData = new FormData();
            formData.append('carId', selectedCarId);
            formData.append('maintenanceDateIso', dateObj.toISOString());
            formData.append('amount', amount);
            formData.append('description', description);
            if (receiptFile) {
                formData.append('receipt', receiptFile);
            }

            const res = await fetch('/api/user/maintenance', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                setSuccess(t('maintenance.addSuccess'));
                setMaintenanceDate('');
                setAmount('');
                setDescription('');
                setReceiptFile(null);
                setReceiptPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                fetchMaintenance();
            } else {
                setError(data.error || t('maintenance.addFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveMaintenance = async (id) => {
        const result = await Swal.fire({ title: 'Confirmation', text: String(t('maintenance.removeConfirm')), icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33' });
        if (!result.isConfirmed) return;

        try {
            const res = await fetch(`/api/user/maintenance?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(t('maintenance.removeSuccess'));
                fetchMaintenance();
            } else {
                setError(data.error || t('maintenance.removeFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-slate-900 p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                        {t('maintenance.title')}
                    </h1>
                    <p className="text-gray-500 mt-2">{t('maintenance.subtitle')}</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Maintenance Form */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">{t('maintenance.addEntry')}</h2>

                        {cars.length === 0 && !loading && (
                            <div className="mb-4 text-orange-600 bg-orange-400/10 p-3 rounded-xl text-sm border border-orange-400/20">
                                {t('maintenance.noCarWarning')} <Link href="/dashboard/cars" className="underline font-bold">{t('maintenance.manageCars')}</Link>
                            </div>
                        )}

                        <form onSubmit={handleAddMaintenance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 font-medium">{t('maintenance.carLabel')}</label>
                                <select
                                    value={selectedCarId}
                                    onChange={(e) => setSelectedCarId(e.target.value)}
                                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    required
                                    disabled={cars.length === 0}
                                >
                                    <option value="" disabled>{t('maintenance.selectCar')}</option>
                                    {cars.map(c => (
                                        <option key={c.ID} value={c.ID}>
                                            {c.DESCRIPTION ? `${c.DESCRIPTION} (${c.LICENSE_PLATE || 'N/A'})` : (c.LICENSE_PLATE || `Car #${c.ID}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 font-medium">{t('maintenance.dateTimeLabel')}</label>
                                <input
                                    type="datetime-local"
                                    step="1"
                                    value={maintenanceDate}
                                    onChange={(e) => setMaintenanceDate(e.target.value)}
                                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all w-full [color-scheme:light]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 font-medium">{t('maintenance.amountLabel')}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-gray-400"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-sm text-gray-500 font-medium">{t('maintenance.descriptionLabel')}</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t('maintenance.descriptionPlaceholder')}
                                    maxLength="1000"
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-gray-400 min-h-[100px]"
                                    required
                                />
                                <div className="text-right text-xs text-slate-500 mt-1">{description.length}/1000 {t('maintenance.characters')}</div>
                            </div>

                            <div className="md:col-span-2 flex flex-col gap-2 mt-2">
                                <label className="text-sm text-gray-500 font-medium">{t('maintenance.receiptLabel')}</label>
                                <div className="flex flex-col items-start gap-4 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        capture="environment"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-colors file:cursor-pointer"
                                    />
                                    {receiptPreview && (
                                        <div className="relative group">
                                            {receiptPreview === 'pdf' ? (
                                                <div className="h-32 w-24 rounded-lg border border-gray-200 bg-gray-100 flex flex-col items-center justify-center p-2 text-red-500">
                                                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="text-[10px] uppercase font-bold mt-1 text-gray-500">{t('maintenance.pdfDocument')}</span>
                                                </div>
                                            ) : (
                                                <img src={receiptPreview} alt={t('maintenance.receiptPreviewAlt')} className="h-32 rounded-lg border border-gray-200 object-contain bg-gray-100" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setReceiptFile(null); setReceiptPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-slate-900 rounded-full p-1 shadow-lg hover:bg-red-600 transition-transform active:scale-95"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || cars.length === 0 || userProfile?.isDemo}
                                className="md:col-span-2 mt-4 py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold transition-all shadow-lg shadow-purple-600/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                            >
                                {userProfile?.isDemo ? t('maintenance.viewOnly') : (submitting ? t('maintenance.saving') : t('maintenance.addLog'))}
                            </button>
                        </form>

                        {error && <p className="mt-4 text-red-600 text-sm font-medium">{error}</p>}
                        {success && <p className="mt-4 text-green-600 text-sm font-medium">{success}</p>}
                    </div>

                    {/* Maintenance List */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-semibold">{t('maintenance.logsTitle')}</h2>
                            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200">{maintenanceEntries.length} {t('maintenance.total')}</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">{t('maintenance.loading')}</div>
                            ) : maintenanceEntries.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">{t('maintenance.noLogs')}</div>
                            ) : (
                                maintenanceEntries.map((entry) => {
                                    const rawDate = new Date(entry.maintenanceDate);
                                    const localDate = rawDate.toLocaleString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    });

                                    return (
                                        <div key={entry.id} className="p-6 hover:bg-gray-50 transition-colors">
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                                <div className="flex-1">

                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center border border-purple-200 flex-shrink-0">
                                                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-gray-700">
                                                                ${parseFloat(entry.amount).toFixed(2)}
                                                            </div>
                                                            <div className="text-sm font-medium text-purple-600">
                                                                {entry.carDescription || entry.carLicensePlate || `Car #${entry.carId}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">{t('maintenance.date')}</span>
                                                            <div className="text-gray-600">{localDate}</div>
                                                        </div>
                                                        <div className="sm:col-span-2">
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">{t('maintenance.description')}</span>
                                                            <div className="text-gray-600 whitespace-pre-wrap">{entry.description}</div>
                                                        </div>
                                                    </div>

                                                </div>

                                                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6">
                                                    {entry.hasReceipt ? (
                                                        <a
                                                            href={`/api/user/maintenance/${entry.id}/receipt`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-col items-center gap-1 group text-gray-500 hover:text-purple-600 transition-colors"
                                                            title={t('maintenance.viewReceipt')}
                                                        >
                                                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden border border-gray-200 group-hover:border-purple-400/50 transition-colors">
                                                                {entry.receiptMime === 'application/pdf' ? (
                                                                    <div className="flex flex-col items-center justify-center text-red-500">
                                                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <span className="text-[8px] font-bold">PDF</span>
                                                                    </div>
                                                                ) : (
                                                                    <img
                                                                        src={`/api/user/maintenance/${entry.id}/receipt`}
                                                                        alt={t('maintenance.receiptAlt')}
                                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                                    />
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">{entry.receiptMime === 'application/pdf' ? 'PDF' : t('maintenance.receipt')}</span>
                                                        </a>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1 text-slate-600" title={t('maintenance.noRec')}>
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-dashed border-gray-200">
                                                                <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">{t('maintenance.noRec')}</span>
                                                        </div>
                                                    )}

                                                    <div className="w-px h-10 bg-slate-700 hidden md:block"></div>

                                                    <button
                                                        onClick={() => handleRemoveMaintenance(entry.id)}
                                                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                                                        disabled={submitting || userProfile?.isDemo}
                                                    >
                                                        {t('maintenance.delete')}
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
                    <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-purple-600 transition-colors font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t('maintenance.backToDashboard')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
