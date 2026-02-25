'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ManageCarsPage() {
    const [cars, setCars] = useState([]);
    const [newLicensePlate, setNewLicensePlate] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editDescription, setEditDescription] = useState('');
    const [editLicensePlate, setEditLicensePlate] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchCars();
    }, []);

    const fetchCars = async () => {
        try {
            const res = await fetch('/api/user/cars');
            const data = await res.json();
            if (data.success) {
                setCars(data.cars);
            }
        } catch (err) {
            console.error('Failed to fetch cars');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCar = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/user/cars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: newLicensePlate,
                    description: newDescription
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Car added successfully!');
                setNewLicensePlate('');
                setNewDescription('');
                fetchCars();
            } else {
                setError(data.error || 'Failed to add car');
            }
        } catch (err) {
            setError('An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const startEditing = (car) => {
        setEditingId(car.ID);
        setEditDescription(car.DESCRIPTION || '');
        setEditLicensePlate(car.LICENSE_PLATE || '');
    };

    const handleSaveCar = async (carId) => {
        try {
            const res = await fetch('/api/user/cars', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    carId,
                    description: editDescription,
                    licensePlate: editLicensePlate
                }),
            });
            const data = await res.json();
            if (data.success) {
                setEditingId(null);
                fetchCars();
            } else {
                setError(data.error || 'Failed to update car');
            }
        } catch (err) {
            setError('An error occurred');
        }
    };

    const handleRemoveCar = async (carId) => {
        if (!confirm(`Are you sure you want to remove this car?`)) return;

        try {
            const res = await fetch(`/api/user/cars?carId=${carId}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Car removed successfully');
                fetchCars();
            } else {
                setError(data.error || 'Failed to remove car');
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
                        Manage Your Cars
                    </h1>
                    <p className="text-slate-400 mt-2">Associate cars with your account by adding descriptions and license plates.</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Car Form */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">Add Car</h2>
                        <form onSubmit={handleAddCar} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                value={newLicensePlate}
                                onChange={(e) => setNewLicensePlate(e.target.value)}
                                placeholder="License Plate (e.g. ABC-1234)"
                                className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600 font-mono uppercase"
                            />
                            <input
                                type="text"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder="Description (e.g. BMW X5)"
                                className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                            />
                            <button
                                type="submit"
                                disabled={submitting || (!newLicensePlate && !newDescription)}
                                className="md:col-span-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? 'Adding...' : 'Add Car'}
                            </button>
                        </form>

                        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
                        {success && <p className="mt-3 text-green-400 text-sm">{success}</p>}
                    </div>

                    {/* Cars List */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/20">
                            <h2 className="text-xl font-semibold">Your Cars</h2>
                            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">{cars.length} Total</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">Loading cars...</div>
                            ) : cars.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">No cars added yet</div>
                            ) : (
                                cars.map((car) => (
                                    <div key={car.ID} className="p-6 hover:bg-slate-800/30 transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex-1">
                                                {editingId === car.ID ? (
                                                    <div className="grid gap-3">
                                                        <input
                                                            type="text"
                                                            value={editLicensePlate}
                                                            onChange={(e) => setEditLicensePlate(e.target.value)}
                                                            placeholder="License Plate"
                                                            className="flex-1 px-3 py-2 bg-[#0f172a] border border-blue-500/50 rounded-lg text-sm outline-none ring-2 ring-blue-500/20 font-mono uppercase"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editDescription}
                                                            onChange={(e) => setEditDescription(e.target.value)}
                                                            placeholder="Description"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveCar(car.ID);
                                                                if (e.key === 'Escape') setEditingId(null);
                                                            }}
                                                            className="flex-1 px-3 py-2 bg-[#0f172a] border border-blue-500/50 rounded-lg text-sm outline-none ring-2 ring-blue-500/20"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleSaveCar(car.ID)}
                                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-600 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => startEditing(car)}
                                                        className="group cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">Description</span>
                                                        </div>
                                                        <div className="text-lg text-slate-200 mb-3 flex items-center gap-2 font-medium">
                                                            {car.DESCRIPTION || <span className="italic text-slate-500 text-sm font-normal">No description</span>}
                                                            <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </div>

                                                        <span className="text-xs font-bold text-slate-500 tracking-wider uppercase block mb-1">License Plate</span>
                                                        <div className="text-slate-400 text-sm py-1 font-mono uppercase flex items-center gap-2">
                                                            {car.LICENSE_PLATE || <span className="italic text-slate-600 normal-case font-sans">Not provided</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {editingId !== car.ID && (
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleRemoveCar(car.ID)}
                                                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg border border-transparent hover:border-red-400/20 transition-all uppercase tracking-widest"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
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
