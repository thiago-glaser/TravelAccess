'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function ManageBluetoothPage() {
    const [bluetoothDevices, setBluetoothDevices] = useState([]);
    const [cars, setCars] = useState([]);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newCarId, setNewCarId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editCarId, setEditCarId] = useState('');

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
        fetchBluetoothDevices();
        fetchCars();
    }, []);

    const fetchBluetoothDevices = async () => {
        try {
            const res = await fetch('/api/user/bluetooth');
            const data = await res.json();
            if (data.success) {
                setBluetoothDevices(data.bluetooth);
            }
        } catch (err) {
            console.error('Failed to fetch bluetooth devices');
        } finally {
            setLoading(false);
        }
    };

    const fetchCars = async () => {
        try {
            const res = await fetch('/api/user/cars');
            const data = await res.json();
            if (data.success) {
                setCars(data.cars);
            }
        } catch (err) {
            console.error('Failed to fetch cars');
        }
    };

    const handleAddBluetooth = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/user/bluetooth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    description: newDescription,
                    address: newAddress,
                    carId: newCarId
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(t('bluetooth.addSuccess'));
                setNewName('');
                setNewDescription('');
                setNewAddress('');
                setNewCarId('');
                fetchBluetoothDevices();
            } else {
                setError(data.error || t('bluetooth.addFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        } finally {
            setSubmitting(false);
        }
    };

    const startEditing = (device) => {
        setEditingId(device.ID);
        setEditName(device.NAME || '');
        setEditDescription(device.DESCRIPTION || '');
        setEditAddress(device.ADDRESS || '');
        setEditCarId(device.CAR_ID ? String(device.CAR_ID) : '');
    };

    const handleSaveBluetooth = async (id) => {
        try {
            const res = await fetch('/api/user/bluetooth', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    name: editName,
                    description: editDescription,
                    address: editAddress,
                    carId: editCarId
                }),
            });
            const data = await res.json();
            if (data.success) {
                setEditingId(null);
                fetchBluetoothDevices();
            } else {
                setError(data.error || t('bluetooth.updateFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        }
    };

    const handleRemoveBluetooth = async (id) => {
        if (!confirm(t('bluetooth.removeConfirm'))) return;

        try {
            const res = await fetch(`/api/user/bluetooth?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(t('bluetooth.removeSuccess'));
                fetchBluetoothDevices();
            } else {
                setError(data.error || t('bluetooth.removeFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        {t('bluetooth.title')}
                    </h1>
                    <p className="text-slate-400 mt-2">{t('bluetooth.subtitle')}</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Form */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">{t('bluetooth.addDevice')}</h2>
                        <form onSubmit={handleAddBluetooth} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={t('bluetooth.deviceNamePlaceholder')}
                                className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600 font-semibold text-slate-200"
                                required
                            />
                            <input
                                type="text"
                                value={newAddress}
                                onChange={(e) => setNewAddress(e.target.value)}
                                placeholder={t('bluetooth.addressPlaceholder')}
                                className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600 font-mono text-slate-300"
                                required
                            />
                            <input
                                type="text"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder={t('bluetooth.descriptionOptional')}
                                className="md:col-span-2 px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600 text-slate-300"
                            />
                            <select
                                value={newCarId}
                                onChange={(e) => setNewCarId(e.target.value)}
                                className="md:col-span-2 px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-300 appearance-none"
                            >
                                <option value="">{t('bluetooth.noCarAssigned')}</option>
                                {cars.map(car => (
                                    <option key={car.ID} value={car.ID}>{car.DESCRIPTION || car.LICENSE_PLATE || 'Unknown Car'}</option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={submitting || !newName || !newAddress || userProfile?.isDemo}
                                className="md:col-span-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {userProfile?.isDemo ? t('bluetooth.viewOnly') : (submitting ? t('bluetooth.adding') : t('bluetooth.addBtn'))}
                            </button>
                        </form>

                        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
                        {success && <p className="mt-3 text-green-400 text-sm">{success}</p>}
                    </div>

                    {/* List */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/20">
                            <h2 className="text-xl font-semibold">{t('bluetooth.listTitle')}</h2>
                            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">{bluetoothDevices.length} {t('bluetooth.total')}</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">{t('bluetooth.loading')}</div>
                            ) : bluetoothDevices.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">{t('bluetooth.noDevices')}</div>
                            ) : (
                                bluetoothDevices.map((device) => (
                                    <div key={device.ID} className="p-6 hover:bg-slate-800/30 transition-colors">
                                        <div className="flex flex-col md:flex-row justify-between gap-4">
                                            <div className="flex-1">
                                                {editingId === device.ID ? (
                                                    <div className="grid gap-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <input
                                                                type="text"
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                placeholder={t('bluetooth.editPlaceholder')}
                                                                className="px-3 py-2 bg-[#0f172a] border border-blue-500/50 rounded-lg text-sm outline-none ring-2 ring-blue-500/20 text-slate-200"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={editAddress}
                                                                onChange={(e) => setEditAddress(e.target.value)}
                                                                placeholder={t('bluetooth.addressEditPlaceholder')}
                                                                className="px-3 py-2 bg-[#0f172a] border border-blue-500/50 rounded-lg text-sm outline-none ring-2 ring-blue-500/20 font-mono text-slate-300"
                                                            />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={editDescription}
                                                            onChange={(e) => setEditDescription(e.target.value)}
                                                            placeholder={t('bluetooth.descEditPlaceholder')}
                                                            className="px-3 py-2 bg-[#0f172a] border border-blue-500/50 rounded-lg text-sm outline-none ring-2 ring-blue-500/20 text-slate-300"
                                                        />
                                                        <select
                                                            value={editCarId}
                                                            onChange={(e) => setEditCarId(e.target.value)}
                                                            className="px-3 py-2 bg-[#0f172a] border border-blue-500/50 rounded-lg text-sm outline-none ring-2 ring-blue-500/20 text-slate-300"
                                                        >
                                                            <option value="">{t('bluetooth.noCarAssigned')}</option>
                                                            {cars.map(car => (
                                                                <option key={car.ID} value={car.ID}>{car.DESCRIPTION || car.LICENSE_PLATE || 'Unknown Car'}</option>
                                                            ))}
                                                        </select>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleSaveBluetooth(device.ID)}
                                                                disabled={userProfile?.isDemo}
                                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50"
                                                            >
                                                                {t('bluetooth.save')}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-600 transition-colors"
                                                            >
                                                                {t('bluetooth.cancel')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => startEditing(device)}
                                                        className="group cursor-pointer grid gap-2"
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-bold text-blue-400 tracking-wider">{t('bluetooth.nameLabel')}</span>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                                            </div>
                                                            <div className="text-lg text-slate-200 font-medium flex items-center gap-2">
                                                                {device.NAME}
                                                                <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                            <div>
                                                                <span className="text-xs font-bold text-slate-500 tracking-wider block mb-1">{t('bluetooth.addressLabel')}</span>
                                                                <div className="text-slate-300 font-mono text-sm">{device.ADDRESS}</div>
                                                            </div>
                                                            {device.CAR_DESCRIPTION && (
                                                                <div>
                                                                    <span className="text-xs font-bold text-slate-500 tracking-wider block mb-1">{t('bluetooth.linkedCarLabel')}</span>
                                                                    <div className="text-slate-300 text-sm whitespace-nowrap overflow-hidden text-ellipsis bg-slate-800 inline-block px-2 py-1 rounded text-xs">{device.CAR_DESCRIPTION}</div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {device.DESCRIPTION && (
                                                            <div className="mt-2">
                                                                <span className="text-xs font-bold text-slate-500 tracking-wider block mb-1">{t('bluetooth.descriptionLabel')}</span>
                                                                <div className="text-slate-400 text-sm">{device.DESCRIPTION}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {editingId !== device.ID && (
                                                <div className="flex items-start md:items-center">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveBluetooth(device.ID); }}
                                                        disabled={userProfile?.isDemo}
                                                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg border border-transparent hover:border-red-400/20 transition-all uppercase tracking-widest mt-2 md:mt-0 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        {t('bluetooth.remove')}
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
                        {t('bluetooth.backToDashboard')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
