'use client';

import { useState, useEffect } from 'react';

// Haversine formula for distance calculation (reused from MapContainer)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
};

const filterLocationsByDistance = (locations, minDistance = 10) => {
    if (locations.length <= 1) return locations;
    const filtered = [locations[0]];
    for (let i = 1; i < locations.length; i++) {
        const lastFiltered = filtered[filtered.length - 1];
        const distance = calculateDistance(
            lastFiltered.lat,
            lastFiltered.lng,
            locations[i].lat,
            locations[i].lng
        );
        if (distance >= minDistance) {
            filtered.push(locations[i]);
        }
    }
    return filtered;
};

const calculateTotalDistance = (locations) => {
    if (locations.length <= 1) return 0;
    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
        const distance = calculateDistance(
            locations[i - 1].lat,
            locations[i - 1].lng,
            locations[i].lat,
            locations[i].lng
        );
        totalDistance += distance;
    }
    return totalDistance;
};

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState(null);
    const [devices, setDevices] = useState([]);
    const [filters, setFilters] = useState({ deviceId: '', year: '', month: '', type: '' });
    const [reportData, setReportData] = useState([]);
    const [totals, setTotals] = useState({
        distance: 0,
        duration: 0,
        count: 0,
        breakdown: {
            P: { distance: 0, duration: 0 },
            B: { distance: 0, duration: 0 }
        }
    });

    const fetchDevices = async () => {
        try {
            const response = await fetch('/api/devices');
            const result = await response.json();
            if (result.success) {
                setDevices(result.devices);
            }
        } catch (err) {
            console.error('Failed to fetch devices:', err);
        }
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    const parseUTC = (dateVal) => {
        if (!dateVal) return null;
        try {
            if (dateVal instanceof Date) return dateVal;
            let dateStr = String(dateVal).trim();
            if (!dateStr.includes('T')) dateStr = dateStr.replace(' ', 'T');
            if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr += 'Z';
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {
            return null;
        }
    };

    const generateReport = async () => {
        setLoading(true);
        setError(null);
        setProgress({ current: 0, total: 0 });

        try {
            // 1. Fetch sessions based on filters
            let sessionUrl = `/api/sessions?page=1&limit=10000`; // High limit for reports
            if (filters.deviceId) sessionUrl += `&deviceId=${filters.deviceId}`;
            if (filters.year) sessionUrl += `&year=${filters.year}`;
            if (filters.month) sessionUrl += `&month=${filters.month}`;
            if (filters.type) sessionUrl += `&type=${filters.type}`;

            const sResponse = await fetch(sessionUrl);
            const sResult = await sResponse.json();

            if (!sResult.success) throw new Error(sResult.error || 'Failed to fetch sessions');

            const sessionsList = sResult.data;
            if (sessionsList.length === 0) {
                setReportData([]);
                setTotals({ distance: 0, duration: 0, count: 0 });
                setLoading(false);
                return;
            }

            setProgress({ current: 0, total: sessionsList.length });

            // 2. Fetch GPS data PER session to match map behavior exactly and avoid truncation
            const batchSize = 5; // Fetch a few at a time to be efficient but safe
            const processed = [];

            for (let i = 0; i < sessionsList.length; i += batchSize) {
                const batch = sessionsList.slice(i, i + batchSize);
                const batchResults = await Promise.all(batch.map(async (session) => {
                    try {
                        const start = parseUTC(session.startTime);
                        const end = parseUTC(session.endTime) || new Date();

                        // Use correct ISO string format for the API
                        const startStr = start.toISOString();
                        const endStr = end.toISOString();

                        const locUrl = `/api/gps-data?startDate=${startStr}&endDate=${endStr}&deviceId=${session.deviceId}`;
                        const lResponse = await fetch(locUrl);
                        const lResult = await lResponse.json();

                        if (!lResult.success) return { ...session, distanceKm: 0, durationHours: 0, error: true };

                        // Process locations exactly like MapContainer
                        const sessionLocations = lResult.data
                            .map(l => ({
                                ...l,
                                timestamp: new Date(l.date).getTime()
                            }))
                            .sort((a, b) => a.timestamp - b.timestamp);

                        const filteredLocs = filterLocationsByDistance(sessionLocations, 10);
                        const distanceMeters = calculateTotalDistance(filteredLocs);
                        const durationMs = end.getTime() - start.getTime();

                        return {
                            ...session,
                            distanceKm: distanceMeters / 1000,
                            durationHours: durationMs / (1000 * 60 * 60),
                            points: filteredLocs.length
                        };
                    } catch (err) {
                        console.error('Error processing session:', session.id, err);
                        return { ...session, distanceKm: 0, durationHours: 0, error: true };
                    }
                }));

                processed.push(...batchResults);
                setProgress(prev => ({ ...prev, current: Math.min(prev.total, i + batchSize) }));
            }

            // 3. Calculate Totals and Breakdown
            const totalDist = processed.reduce((sum, s) => sum + s.distanceKm, 0);
            const totalDur = processed.reduce((sum, s) => sum + s.durationHours, 0);

            const breakdown = {
                P: { distance: 0, duration: 0 },
                B: { distance: 0, duration: 0 }
            };

            processed.forEach(s => {
                const typeKey = s.type === 'P' || s.type === 'B' ? s.type : null;
                if (typeKey) {
                    breakdown[typeKey].distance += s.distanceKm;
                    breakdown[typeKey].duration += s.durationHours;
                }
            });

            setReportData(processed);
            setTotals({
                distance: totalDist,
                duration: totalDur,
                count: processed.length,
                breakdown
            });

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const formatDuration = (hours) => {
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        const s = Math.floor(((hours - h) * 60 - m) * 60);
        return `${h}h ${m}m ${s}s`;
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            Travel Analytics Reports
                        </h1>
                        <p className="mt-2 text-lg text-gray-600">
                            Comprehensive summaries of your distance and time traveled.
                        </p>
                    </div>
                </header>

                {/* Filter Bar */}
                <div className="bg-white shadow-md rounded-xl p-4 mb-6 border border-gray-100">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Device</label>
                            <select
                                value={filters.deviceId}
                                onChange={(e) => setFilters(prev => ({ ...prev, deviceId: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">All Devices</option>
                                {devices.map(device => (
                                    <option key={device.id} value={device.id}>{device.description || device.id}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Year</label>
                            <select
                                value={filters.year}
                                onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">Any Year</option>
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="w-40">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Month</label>
                            <select
                                value={filters.month}
                                onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">Any Month</option>
                                {[
                                    { v: 1, n: 'January' }, { v: 2, n: 'February' }, { v: 3, n: 'March' },
                                    { v: 4, n: 'April' }, { v: 5, n: 'May' }, { v: 6, n: 'June' },
                                    { v: 7, n: 'July' }, { v: 8, n: 'August' }, { v: 9, n: 'September' },
                                    { v: 10, n: 'October' }, { v: 11, n: 'November' }, { v: 12, n: 'December' }
                                ].map(m => <option key={m.v} value={m.v}>{m.n}</option>)}
                            </select>
                        </div>
                        <div className="w-40">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Type</label>
                            <select
                                value={filters.type}
                                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">All Types</option>
                                <option value="P">Personal Only</option>
                                <option value="B">Business Only</option>
                            </select>
                        </div>
                        <div className="flex items-end self-end pb-0.5 gap-2">
                            <button
                                onClick={generateReport}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 min-w-[140px]"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Processing...
                                    </span>
                                ) : 'Generate Report'}
                            </button>
                            <button
                                onClick={() => {
                                    setFilters({ deviceId: '', year: '', month: '', type: '' });
                                    setReportData([]);
                                    setTotals({ distance: 0, duration: 0, count: 0 });
                                }}
                                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {loading && progress.total > 0 && (
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2">
                            <span>Processing Sessions</span>
                            <span>{progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Error: {error}</span>
                    </div>
                )}

                {/* Summary Cards */}
                {reportData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Distance</p>
                            <p className="text-3xl font-black text-blue-600 font-mono">{totals.distance.toFixed(2)} <span className="text-sm">KM</span></p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Duration</p>
                            <p className="text-3xl font-black text-green-600 font-mono">{formatDuration(totals.duration)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Sessions</p>
                            <p className="text-3xl font-black text-purple-600 font-mono">{totals.count}</p>
                        </div>
                    </div>
                )}

                {/* Type Breakdown (Visible when All Types are selected) */}
                {reportData.length > 0 && !filters.type && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-400">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Breakdown by Type</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Distance Breakdown */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 font-medium">Distance Distribution</span>
                                    <span className="text-gray-400 font-mono text-xs italic">Total: {totals.distance.toFixed(1)} km</span>
                                </div>
                                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="bg-blue-500 h-full transition-all duration-500"
                                        style={{ width: `${totals.distance > 0 ? (totals.breakdown.P.distance / totals.distance) * 100 : 0}%` }}
                                        title={`Personal: ${totals.breakdown.P.distance.toFixed(1)} km`}
                                    ></div>
                                    <div
                                        className="bg-yellow-500 h-full transition-all duration-500"
                                        style={{ width: `${totals.distance > 0 ? (totals.breakdown.B.distance / totals.distance) * 100 : 0}%` }}
                                        title={`Business: ${totals.breakdown.B.distance.toFixed(1)} km`}
                                    ></div>
                                </div>
                                <div className="flex gap-4 mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">Personal ({totals.distance > 0 ? Math.round((totals.breakdown.P.distance / totals.distance) * 100) : 0}%)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">Business ({totals.distance > 0 ? Math.round((totals.breakdown.B.distance / totals.distance) * 100) : 0}%)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Time Breakdown */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 font-medium">Time Distribution</span>
                                    <span className="text-gray-400 font-mono text-xs italic">Total: {Math.round(totals.duration)}h</span>
                                </div>
                                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="bg-blue-400 h-full transition-all duration-500"
                                        style={{ width: `${totals.duration > 0 ? (totals.breakdown.P.duration / totals.duration) * 100 : 0}%` }}
                                        title={`Personal: ${formatDuration(totals.breakdown.P.duration)}`}
                                    ></div>
                                    <div
                                        className="bg-yellow-400 h-full transition-all duration-500"
                                        style={{ width: `${totals.duration > 0 ? (totals.breakdown.B.duration / totals.duration) * 100 : 0}%` }}
                                        title={`Business: ${formatDuration(totals.breakdown.B.duration)}`}
                                    ></div>
                                </div>
                                <div className="flex gap-4 mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-blue-400 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">Personal ({totals.duration > 0 ? Math.round((totals.breakdown.P.duration / totals.duration) * 100) : 0}%)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">Business ({totals.duration > 0 ? Math.round((totals.breakdown.B.duration / totals.duration) * 100) : 0}%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Report Table */}
                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Device</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Start Time</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">End Time</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Distance</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {reportData.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-20 text-center text-gray-400 italic">
                                            {loading ? 'Consulting high-precision GPS telemetry...' : 'No sessions matching criteria. Use filters and click "Generate Report".'}
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {reportData.map((s) => (
                                            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-900">{s.description || 'Unknown'}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{s.deviceId}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                    {parseUTC(s.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                    {s.endTime ? parseUTC(s.endTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'Active'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${s.type === 'P' ? 'bg-blue-100 text-blue-700' : s.type === 'B' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {s.type === 'P' ? 'Personal' : s.type === 'B' ? 'Business' : 'Other'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-blue-600">
                                                    {s.distanceKm.toFixed(2)} km
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-gray-600">
                                                    {formatDuration(s.durationHours)}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Final Row with Totals */}
                                        <tr className="bg-gray-50 font-black border-t-2 border-gray-200">
                                            <td colSpan="4" className="px-6 py-6 text-right text-gray-900 text-base uppercase tracking-widest">Grand Total</td>
                                            <td className="px-6 py-6 text-right text-xl text-blue-700 font-mono">
                                                {totals.distance.toFixed(2)} km
                                            </td>
                                            <td className="px-6 py-6 text-right text-lg text-green-700 font-mono">
                                                {formatDuration(totals.duration)}
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
