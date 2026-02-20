'use client';

import { useState, useEffect } from 'react';

export default function ManageDevicesPage() {
    const [devices, setDevices] = useState([]);
    const [newDeviceId, setNewDeviceId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
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
                body: JSON.stringify({ deviceId: newDeviceId }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Device added successfully!');
                setNewDeviceId('');
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
            <div className="max-w-2xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Manage Your Devices
                    </h1>
                    <p className="text-slate-400 mt-2">Add or remove device IDs to authorize tracking data access</p>
                </header>

                <div className="grid gap-8">
                    {/* Add Device Form */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">Add Device</h2>
                        <form onSubmit={handleAddDevice} className="flex gap-4">
                            <input
                                type="text"
                                value={newDeviceId}
                                onChange={(e) => setNewDeviceId(e.target.value)}
                                placeholder="Enter Device ID (e.g. 855cdd...)"
                                className="flex-1 px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                                required
                            />
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all disabled:opacity-50 transform active:scale-95"
                            >
                                {submitting ? 'Adding...' : 'Add Device'}
                            </button>
                        </form>

                        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
                        {success && <p className="mt-3 text-green-400 text-sm">{success}</p>}
                    </div>

                    {/* Devices List */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700">
                            <h2 className="text-xl font-semibold">Your Authorized Devices</h2>
                        </div>

                        <div className="divide-y divide-slate-700">
                            {loading ? (
                                <div className="p-10 text-center text-slate-500">Loading devices...</div>
                            ) : devices.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium">No devices authorized yet</div>
                            ) : (
                                devices.map((device) => (
                                    <div key={device.DEVICE_ID} className="p-6 flex justify-between items-center hover:bg-slate-800/50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <span className="font-mono text-lg">{device.DEVICE_ID}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveDevice(device.DEVICE_ID)}
                                            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <a href="/" className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Map
                    </a>
                </div>
            </div>
        </div>
    );
}
