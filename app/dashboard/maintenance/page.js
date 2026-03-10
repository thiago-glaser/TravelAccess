'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

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

    const fileInputRef = useRef(null);

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
            setError('Failed to fetch maintenance entries');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setReceiptFile(file);
            setReceiptPreview(URL.createObjectURL(file));
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
            setError('Please fill in all mandatory fields');
            setSubmitting(false);
            return;
        }

        try {
            const dateObj = new Date(maintenanceDate);
            if (isNaN(dateObj.getTime())) {
                setError('Invalid date/time selected');
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
                setSuccess('Maintenance entry added successfully!');
                setMaintenanceDate('');
                setAmount('');
                setDescription('');
                setReceiptFile(null);
                setReceiptPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                fetchMaintenance();
            } else {
                setError(data.error || 'Failed to add maintenance entry');
            }
        } catch (err) {
            setError('An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveMaintenance = async (id) => {
        if (!confirm(`Are you sure you want to remove this maintenance entry?`)) return;

        try {
            const res = await fetch(`/api/user/maintenance?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Maintenance entry removed successfully');
                fetchMaintenance();
            } else {
                setError(data.error || 'Failed to remove maintenance entry');
            }
        } catch (err) {
            setError('An error occurred');
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                        Manage Maintenance
                    </h1>
                    <p className="text-slate-400 mt-2">Track maintenance, services, and associated receipts for your cars.</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Maintenance Form */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">Add Maintenance Entry</h2>

                        {cars.length === 0 && !loading && (
                            <div className="mb-4 text-orange-400 bg-orange-400/10 p-3 rounded-xl text-sm border border-orange-400/20">
                                You need to add a car first before logging maintenance. <Link href="/dashboard/cars" className="underline font-bold">Manage Cars</Link>
                            </div>
                        )}

                        <form onSubmit={handleAddMaintenance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-400 font-medium">Car *</label>
                                <select
                                    value={selectedCarId}
                                    onChange={(e) => setSelectedCarId(e.target.value)}
                                    className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
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
                                <label className="text-sm text-slate-400 font-medium">Date & Time *</label>
                                <input
                                    type="datetime-local"
                                    step="1"
                                    value={maintenanceDate}
                                    onChange={(e) => setMaintenanceDate(e.target.value)}
                                    className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all w-full [color-scheme:dark]"
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
                                        className="w-full pl-8 pr-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-slate-600"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-sm text-slate-400 font-medium">Description *</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Maintenance details..."
                                    maxLength="1000"
                                    className="w-full px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-slate-600 min-h-[100px]"
                                    required
                                />
                                <div className="text-right text-xs text-slate-500 mt-1">{description.length}/1000 characters</div>
                            </div>

                            <div className="md:col-span-2 flex flex-col gap-2 mt-2">
                                <label className="text-sm text-slate-400 font-medium">Receipt Image (Optional)</label>
                                <div className="flex flex-col items-start gap-4 p-4 border border-dashed border-slate-600 rounded-xl bg-slate-800/30">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-colors file:cursor-pointer"
                                    />
                                    {receiptPreview && (
                                        <div className="relative group">
                                            <img src={receiptPreview} alt="Receipt Preview" className="h-32 rounded-lg border border-slate-700 object-contain bg-slate-900" />
                                            <button
                                                type="button"
                                                onClick={() => { setReceiptFile(null); setReceiptPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-transform active:scale-95"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || cars.length === 0}
                                className="md:col-span-2 mt-4 py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold transition-all shadow-lg shadow-purple-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                            >
                                {submitting ? 'Saving...' : 'Add Maintenance Log'}
                            </button>
                        </form>

                        {error && <p className="mt-4 text-red-400 text-sm font-medium">{error}</p>}
                        {success && <p className="mt-4 text-green-400 text-sm font-medium">{success}</p>}
                    </div>

                    {/* Maintenance List */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/20">
                            <h2 className="text-xl font-semibold">Maintenance Logs</h2>
                            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">{maintenanceEntries.length} Total</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">Loading maintenance logs...</div>
                            ) : maintenanceEntries.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">No maintenance logged yet</div>
                            ) : (
                                maintenanceEntries.map((entry) => {
                                    const rawDate = new Date(entry.maintenanceDate);
                                    const localDate = rawDate.toLocaleString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    });

                                    return (
                                        <div key={entry.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                                <div className="flex-1">

                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                                                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-slate-200">
                                                                ${parseFloat(entry.amount).toFixed(2)}
                                                            </div>
                                                            <div className="text-sm font-medium text-purple-400">
                                                                {entry.carDescription || entry.carLicensePlate || `Car #${entry.carId}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">Date</span>
                                                            <div className="text-slate-300">{localDate}</div>
                                                        </div>
                                                        <div className="sm:col-span-2">
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">Description</span>
                                                            <div className="text-slate-300 whitespace-pre-wrap">{entry.description}</div>
                                                        </div>
                                                    </div>

                                                </div>

                                                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6">
                                                    {entry.hasReceipt ? (
                                                        <a
                                                            href={`/api/user/maintenance/${entry.id}/receipt`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-col items-center gap-1 group text-slate-400 hover:text-purple-400 transition-colors"
                                                            title="View Receipt"
                                                        >
                                                            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-700 group-hover:border-purple-400/50 transition-colors">
                                                                <img
                                                                    src={`/api/user/maintenance/${entry.id}/receipt`}
                                                                    alt="Receipt Preview"
                                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">Receipt</span>
                                                        </a>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1 text-slate-600" title="No Receipt">
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-dashed border-slate-700">
                                                                <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">No Rec</span>
                                                        </div>
                                                    )}

                                                    <div className="w-px h-10 bg-slate-700 hidden md:block"></div>

                                                    <button
                                                        onClick={() => handleRemoveMaintenance(entry.id)}
                                                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg border border-transparent hover:border-red-400/20 transition-all uppercase tracking-widest"
                                                        disabled={submitting}
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
                    <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-purple-400 transition-colors font-medium">
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
