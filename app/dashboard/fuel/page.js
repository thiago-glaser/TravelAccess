'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ManageFuelPage() {
    const [fuelEntries, setFuelEntries] = useState([]);
    const [cars, setCars] = useState([]);

    // Form fields
    const [selectedCarId, setSelectedCarId] = useState('');
    const [timestamp, setTimestamp] = useState(''); // local time string
    const [totalValue, setTotalValue] = useState('');
    const [liters, setLiters] = useState('');
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchCars().then(() => fetchFuel());
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

    const fetchFuel = async () => {
        try {
            const res = await fetch('/api/user/fuel');
            const data = await res.json();
            if (data.success) {
                setFuelEntries(data.fuel);
            }
        } catch (err) {
            console.error('Failed to fetch fuel entries', err);
            setError('Failed to fetch fuel entries');
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

    const handleAddFuel = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        if (!selectedCarId || !timestamp || !totalValue || !liters) {
            setError('Please fill in all mandatory fields');
            setSubmitting(false);
            return;
        }

        try {
            const dateObj = new Date(timestamp);
            if (isNaN(dateObj.getTime())) {
                setError('Invalid date/time selected');
                setSubmitting(false);
                return;
            }

            const formData = new FormData();
            formData.append('carId', selectedCarId);
            formData.append('timestampIso', dateObj.toISOString());
            formData.append('totalValue', totalValue);
            formData.append('liters', liters);
            if (receiptFile) {
                formData.append('receipt', receiptFile);
            }

            const res = await fetch('/api/user/fuel', {
                method: 'POST',
                body: formData, // fetch will auto-set multipart/form-data with boundary
            });

            const data = await res.json();
            if (data.success) {
                setSuccess('Fuel entry added successfully!');
                setTimestamp('');
                setTotalValue('');
                setLiters('');
                setReceiptFile(null);
                setReceiptPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                fetchFuel();
            } else {
                setError(data.error || 'Failed to add fuel entry');
            }
        } catch (err) {
            setError('An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveFuel = async (id) => {
        if (!confirm(`Are you sure you want to remove this fuel entry?`)) return;

        try {
            const res = await fetch(`/api/user/fuel?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Fuel entry removed successfully');
                fetchFuel();
            } else {
                setError(data.error || 'Failed to remove fuel entry');
            }
        } catch (err) {
            setError('An error occurred');
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                        Manage Fuel Logs
                    </h1>
                    <p className="text-slate-400 mt-2">Track fuel expenses and associate receipts to your cars.</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Fuel Form */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">Add Fuel Entry</h2>

                        {cars.length === 0 && !loading && (
                            <div className="mb-4 text-orange-400 bg-orange-400/10 p-3 rounded-xl text-sm border border-orange-400/20">
                                You need to add a car first before logging fuel. <Link href="/dashboard/cars" className="underline font-bold">Manage Cars</Link>
                            </div>
                        )}

                        <form onSubmit={handleAddFuel} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-400 font-medium">Car *</label>
                                <select
                                    value={selectedCarId}
                                    onChange={(e) => setSelectedCarId(e.target.value)}
                                    className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
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
                                    value={timestamp}
                                    onChange={(e) => setTimestamp(e.target.value)}
                                    className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all w-full [color-scheme:dark]"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-400 font-medium">Total Value *</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={totalValue}
                                        onChange={(e) => setTotalValue(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all placeholder-slate-600"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-400 font-medium">Liters *</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        value={liters}
                                        onChange={(e) => setLiters(e.target.value)}
                                        placeholder="0.000"
                                        className="w-full pr-10 pl-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all placeholder-slate-600"
                                        required
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">L</span>
                                </div>
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
                                        className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-colors file:cursor-pointer"
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
                                className="md:col-span-2 mt-4 py-4 bg-green-600 hover:bg-green-500 rounded-xl font-semibold transition-all shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                            >
                                {submitting ? 'Saving...' : 'Add Fuel Log'}
                            </button>
                        </form>

                        {error && <p className="mt-4 text-red-400 text-sm font-medium">{error}</p>}
                        {success && <p className="mt-4 text-green-400 text-sm font-medium">{success}</p>}
                    </div>

                    {/* Fuel List */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/20">
                            <h2 className="text-xl font-semibold">Fuel Logs</h2>
                            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">{fuelEntries.length} Total</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">Loading fuel logs...</div>
                            ) : fuelEntries.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">No fuel logged yet</div>
                            ) : (
                                fuelEntries.map((entry) => {
                                    const rawDate = new Date(entry.timestampUtc); // utc
                                    // Make it local: Note: if timestampUtc comes as string without 'Z', it might be parsed wrong. We assume DB sends with 'Z' or we display local representation of the internal UTC.
                                    // Usually Next API sends ISO string e.g. "2023-11-05T10:30:00.000Z"
                                    const localDate = rawDate.toLocaleString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    });

                                    return (
                                        <div key={entry.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex-1">

                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
                                                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-slate-200">
                                                                ${parseFloat(entry.totalValue).toFixed(2)}
                                                            </div>
                                                            <div className="text-sm font-medium text-emerald-400">
                                                                {parseFloat(entry.liters).toFixed(3)} Liters
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-4">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">Date</span>
                                                            <div className="text-sm text-slate-300">{localDate}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">Car</span>
                                                            <div className="text-sm text-slate-300 font-medium">
                                                                {entry.carDescription || entry.carLicensePlate || `Car #${entry.carId}`}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">Total KM</span>
                                                            <div className="text-sm text-slate-300 font-medium">
                                                                {parseFloat(entry.totalKilometers || 0).toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">KM / L</span>
                                                            <div className="text-sm text-slate-300 font-medium">
                                                                {parseFloat(entry.kilometerPerLiter || 0).toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">Price / KM</span>
                                                            <div className="text-sm text-slate-300 font-medium">
                                                                ${parseFloat(entry.pricePerKilometer || 0).toFixed(4)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>

                                                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6">
                                                    {entry.hasReceipt ? (
                                                        <a
                                                            href={`/api/user/fuel/${entry.id}/receipt`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-col items-center gap-1 group text-slate-400 hover:text-green-400 transition-colors"
                                                            title="View Receipt"
                                                        >
                                                            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-green-400/10 transition-colors">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
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
                                                        onClick={() => handleRemoveFuel(entry.id)}
                                                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg border border-transparent hover:border-red-400/20 transition-all uppercase tracking-widest"
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
