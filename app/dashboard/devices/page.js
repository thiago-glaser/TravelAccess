'use client';

import { useState, useEffect } from 'react';

export default function ManageDevicesPage() {
    const [devices, setDevices] = useState([]);
    const [newDeviceId, setNewDeviceId] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        try {
            const res = await fetch('/api/user/devices');
            const data = await res.json();
            if (data.success) {
                setDevices(data.devices);
            }
        } catch (err) {
            console.error('Failed to fetch devices');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDevice = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/user/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: newDeviceId,
                    description: newDescription
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Device added successfully!');
                setNewDeviceId('');
                setNewDescription('');
                fetchDevices();
            } else {
                setError(data.error || 'Failed to add device');
            }
        } catch (err) {
            setError('An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const startEditing = (device) => {
        setEditingId(device.DEVICE_ID);
        setEditValue(device.DESCRIPTION || '');
    };

    const handleSaveDescription = async (deviceId) => {
        try {
            const res = await fetch('/api/user/devices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId, description: editValue }),
            });
            const data = await res.json();
            if (data.success) {
                setEditingId(null);
                fetchDevices();
            } else {
                setError(data.error || 'Failed to update description');
            }
        } catch (err) {
            setError('An error occurred');
        }
    };

    const handleRemoveDevice = async (deviceId) => {
        if (!confirm(`Are you sure you want to remove device ${deviceId}?`)) return;

        try {
            const res = await fetch(`/api/user/devices?deviceId=${deviceId}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Device removed successfully');
                fetchDevices();
            } else {
                setError(data.error || 'Failed to remove device');
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
                        Manage Your Devices
                    </h1>
                    <p className="text-slate-400 mt-2">Associate device IDs with your account and manage descriptions</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Device Form */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">Add Device</h2>
                        <form onSubmit={handleAddDevice} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                value={newDeviceId}
                                onChange={(e) => setNewDeviceId(e.target.value)}
                                placeholder="Device ID (e.g. 55cdd1...)"
                                className="px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600 font-mono"
                                required
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
                                disabled={submitting}
                                className="md:col-span-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? 'Adding...' : 'Add Device'}
                            </button>
                        </form>

                        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
                        {success && <p className="mt-3 text-green-400 text-sm">{success}</p>}
                    </div>

                    {/* Devices List */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/20">
                            <h2 className="text-xl font-semibold">Your Authorized Devices</h2>
                            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">{devices.length} Total</span>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">Loading devices...</div>
                            ) : devices.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium italic">No devices authorized yet</div>
                            ) : (
                                devices.map((device) => (
                                    <div key={device.DEVICE_ID} className="p-6 hover:bg-slate-800/30 transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">Device ID</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                                </div>
                                                <div className="font-mono text-lg text-slate-200">{device.DEVICE_ID}</div>

                                                <div className="mt-3">
                                                    <span className="text-xs font-bold text-slate-500 tracking-wider uppercase block mb-1">Description</span>
                                                    {editingId === device.DEVICE_ID ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleSaveDescription(device.DEVICE_ID);
                                                                    if (e.key === 'Escape') setEditingId(null);
                                                                }}
                                                                className="flex-1 px-3 py-1.5 bg-[#0f172a] border border-blue-500/50 rounded-lg text-sm outline-none ring-2 ring-blue-500/20"
                                                            />
                                                            <button
                                                                onClick={() => handleSaveDescription(device.DEVICE_ID)}
                                                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-600 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => startEditing(device)}
                                                            className="flex items-center gap-2 group cursor-pointer"
                                                        >
                                                            <div className="text-slate-400 text-sm py-1">
                                                                {device.DESCRIPTION || <span className="italic text-slate-600">No description...</span>}
                                                            </div>
                                                            <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleRemoveDevice(device.DEVICE_ID)}
                                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg border border-transparent hover:border-red-400/20 transition-all uppercase tracking-widest"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <a href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-400 transition-colors font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </a>
                </div>
            </div>
        </div>
    );
}
