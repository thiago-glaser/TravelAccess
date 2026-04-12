'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LanguageContext';

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
    const [distances, setDistances] = useState({});
    const [calculatingDistances, setCalculatingDistances] = useState({});
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
                setSuccess(t('cars.addSuccess'));
                setNewLicensePlate('');
                setNewDescription('');
                fetchCars();
            } else {
                setError(data.error || t('cars.addFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
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
                setError(data.error || t('cars.updateFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        }
    };

    const handleRemoveCar = async (carId) => {
        const result = await Swal.fire({ title: 'Confirmation', text: String(t('cars.removeConfirm')), icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33' });
        if (!result.isConfirmed) return;

        try {
            const res = await fetch(`/api/user/cars?carId=${carId}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(t('cars.removeSuccess'));
                fetchCars();
            } else {
                setError(data.error || t('cars.removeFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        }
    };

    const handleCalculateDistance = async (carId) => {
        setCalculatingDistances(prev => ({ ...prev, [carId]: true }));
        try {
            const res = await fetch(`/api/user/cars/distance-since-fuel?carId=${carId}`);
            const data = await res.json();
            if (data.success) {
                setDistances(prev => ({ ...prev, [carId]: { km: data.kilometers, ms: data.timeMs } }));
            } else {
                alert(data.error || t('cars.calcFailed'));
            }
        } catch (err) {
            alert(t('common.errorOccurred'));
        } finally {
            setCalculatingDistances(prev => ({ ...prev, [carId]: false }));
        }
    };

    const formatDuration = (ms) => {
        if (!ms) return '0h 0m';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="min-h-screen bg-gray-50 text-slate-900 p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {t('cars.title')}
                    </h1>
                    <p className="text-gray-500 mt-2">{t('cars.subtitle')}</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Car Form */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">{t('cars.addCar')}</h2>
                        <form onSubmit={handleAddCar} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                value={newLicensePlate}
                                onChange={(e) => setNewLicensePlate(e.target.value)}
                                placeholder={t('cars.licensePlatePlaceholder')}
                                className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400 font-mono uppercase"
                            />
                            <input
                                type="text"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder={t('cars.descriptionPlaceholder')}
                                className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                            />
                            <button
                                type="submit"
                                disabled={submitting || (!newLicensePlate && !newDescription) || userProfile?.isDemo}
                                className="md:col-span-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {userProfile?.isDemo ? t('cars.viewOnly') : (submitting ? t('cars.adding') : t('cars.addCar'))}
                            </button>
                        </form>

                        {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
                        {success && <p className="mt-3 text-green-600 text-sm">{success}</p>}
                    </div>

                    {/* Cars List */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-semibold">{t('cars.yourCars')}</h2>
                            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200">{cars.length} {t('cars.total')}</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">{t('cars.loading')}</div>
                            ) : cars.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">{t('cars.noCars')}</div>
                            ) : (
                                cars.map((car) => (
                                    <div key={car.ID} className="p-6 hover:bg-gray-50 transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex-1">
                                                {editingId === car.ID ? (
                                                    <div className="grid gap-3">
                                                        <input
                                                            type="text"
                                                            value={editLicensePlate}
                                                            onChange={(e) => setEditLicensePlate(e.target.value)}
                                                            placeholder={t('cars.licensePlate')}
                                                            className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm outline-none ring-2 ring-blue-200 font-mono uppercase"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editDescription}
                                                            onChange={(e) => setEditDescription(e.target.value)}
                                                            placeholder={t('cars.description')}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveCar(car.ID);
                                                                if (e.key === 'Escape') setEditingId(null);
                                                            }}
                                                            className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm outline-none ring-2 ring-blue-200"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleSaveCar(car.ID)}
                                                                disabled={userProfile?.isDemo}
                                                                className="px-4 py-2 bg-blue-600 text-slate-900 rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50"
                                                            >
                                                                {t('cars.save')}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="px-4 py-2 bg-slate-700 text-gray-600 rounded-lg text-xs font-semibold hover:bg-slate-600 transition-colors"
                                                            >
                                                                {t('cars.cancel')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => startEditing(car)}
                                                        className="group cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">{t('cars.description')}</span>
                                                        </div>
                                                        <div className="text-lg text-gray-700 mb-3 flex items-center gap-2 font-medium">
                                                            {car.DESCRIPTION || <span className="italic text-slate-500 text-sm font-normal">{t('cars.noDescription')}</span>}
                                                            <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </div>

                                                        <span className="text-xs font-bold text-slate-500 tracking-wider uppercase block mb-1">{t('cars.licensePlate')}</span>
                                                        <div className="text-gray-500 text-sm py-1 font-mono uppercase flex items-center gap-2">
                                                            {car.LICENSE_PLATE || <span className="italic text-slate-600 normal-case font-sans">{t('cars.notProvided')}</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {editingId !== car.ID && (
                                                <div className="flex items-center gap-3">
                                                    {distances[car.ID] !== undefined && (
                                                        <div className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-400/10 rounded-lg border border-blue-400/20 whitespace-nowrap flex flex-col items-center justify-center">
                                                            <span>{typeof distances[car.ID] === 'object' ? distances[car.ID].km.toFixed(2) : distances[car.ID].toFixed(2)} km</span>
                                                            {typeof distances[car.ID] === 'object' && distances[car.ID].ms !== undefined && (
                                                                <span className="text-xs text-blue-300 mt-0.5">{formatDuration(distances[car.ID].ms)}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleCalculateDistance(car.ID)}
                                                        disabled={calculatingDistances[car.ID]}
                                                        title={t('cars.calcDistTitle')}
                                                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-400/10 rounded-lg border border-transparent hover:border-blue-400/20 transition-all uppercase tracking-widest flex items-center justify-center disabled:opacity-50"
                                                    >
                                                        {calculatingDistances[car.ID] ? (
                                                            <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            t('cars.calcDist')
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveCar(car.ID)}
                                                        disabled={userProfile?.isDemo}
                                                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        {t('cars.remove')}
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
                    <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t('cars.backToDashboard')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
