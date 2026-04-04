'use client';

import React, { useState, useEffect, Fragment } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('@/components/MapContainer'), {
    ssr: false,
    loading: () => {
        const { t } = useTranslation();
        return <div className="w-full h-screen flex items-center justify-center bg-gray-100"><p className="text-xl text-gray-500">{t('sessions.loadingMap')}</p></div>;
    },
});

const HeatMapContainer = dynamic(() => import('@/components/HeatMapContainer'), {
    ssr: false,
    loading: () => {
        const { t } = useTranslation();
        return <div className="w-full h-screen flex items-center justify-center bg-gray-100"><p className="text-xl text-gray-500">{t('sessions.loadingHeatMap')}</p></div>;
    },
});

import SessionPointsList from '@/components/SessionPointsList';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function SessionsPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
    const [selectedSession, setSelectedSession] = useState(null);
    const [selectedSessionIds, setSelectedSessionIds] = useState([]);
    const [selectedSessionsData, setSelectedSessionsData] = useState({}); // Stores full session objects for persistent selection
    const [selectingAllMatching, setSelectingAllMatching] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [modalMode, setModalMode] = useState('single'); // 'single' or 'multi'
    const [modalMapType, setModalMapType] = useState('routes'); // 'routes' or 'heatmap'
    const [cars, setCars] = useState([]);
    const [filters, setFilters] = useState({ carId: '', year: '', month: '' });
    const [expandedSessionIds, setExpandedSessionIds] = useState([]);
    const [now, setNow] = useState(() => new Date());
    const [latestSession, setLatestSession] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
    const [endSessionId, setEndSessionId] = useState(null);
    const [endSessionDeviceId, setEndSessionDeviceId] = useState(null);
    const [endSessionDateTime, setEndSessionDateTime] = useState('');
    const { t, locale } = useTranslation();

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

    const toggleExpandSession = (e, sessionId) => {
        e.stopPropagation(); // Prevents the map modal from opening
        setExpandedSessionIds(prev =>
            prev.includes(sessionId)
                ? prev.filter(id => id !== sessionId)
                : [...prev, sessionId]
        );
    };

    // Robust UTC parsing and formatting
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
            console.error('Date parsing error:', e);
            return null;
        }
    };

    const fetchSessions = async (page = 1) => {
        setLoading(true);
        try {
            let url = `/api/sessions?page=${page}&limit=${pagination.limit}`;
            if (filters.carId) url += `&carId=${filters.carId}`;
            if (filters.year) url += `&year=${filters.year}`;
            if (filters.month) url += `&month=${filters.month}`;
            url += `&tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                setSessions(result.data);
                setPagination(result.pagination);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCars = async () => {
        try {
            const response = await fetch('/api/user/cars');
            const result = await response.json();
            if (result.success) {
                setCars(result.cars);
            }
        } catch (err) {
            console.error('Failed to fetch cars:', err);
        }
    };

    useEffect(() => {
        fetchCars();
    }, []);

    useEffect(() => {
        fetchSessions(pagination.page);
    }, [pagination.page, pagination.limit, filters]);

    // Fetch the very latest session independently of filters/pagination
    const fetchLatestSession = async () => {
        try {
            const res = await fetch('/api/sessions/latest');
            const data = await res.json();
            if (data.success) setLatestSession(data.session);
        } catch (e) {
            console.error('Failed to fetch latest session:', e);
        }
    };

    useEffect(() => {
        fetchLatestSession();
        // Re-check every 30 seconds so the widget stays accurate
        const interval = setInterval(fetchLatestSession, 30_000);
        return () => clearInterval(interval);
    }, []);

    // Tick every second for live session timer
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Derive active/last session from the dedicated latest-session fetch (filter-independent)
    const timerSession = latestSession;
    const isActive = timerSession && !timerSession.endTime;

    const formatElapsed = (ms) => {
        const totalSec = Math.floor(Math.abs(ms) / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}${t('common.hours')} ${m.toString().padStart(2, '0')}${t('common.minutes')} ${s.toString().padStart(2, '0')}${t('common.seconds')}`;
        if (m > 0) return `${m}${t('common.minutes')} ${s.toString().padStart(2, '0')}${t('common.seconds')}`;
        return `${s}${t('common.seconds')}`;
    };

    const formatAgo = (ms) => {
        const totalSec = Math.floor(ms / 1000);
        const s = totalSec % 60;
        const totalMin = Math.floor(totalSec / 60);
        const m = totalMin % 60;
        const totalHr = Math.floor(totalMin / 60);
        const h = totalHr % 24;
        const days = Math.floor(totalHr / 24);
        const ago = t('common.ago');
        if (days > 0) return `${days}${t('common.days')} ${h}${t('common.hours')} ${m.toString().padStart(2, '0')}${t('common.minutes')} ${s.toString().padStart(2, '0')}${t('common.seconds')} ${ago}`;
        if (h > 0) return `${h}${t('common.hours')} ${m.toString().padStart(2, '0')}${t('common.minutes')} ${s.toString().padStart(2, '0')}${t('common.seconds')} ${ago}`;
        if (m > 0) return `${m}${t('common.minutes')} ${s.toString().padStart(2, '0')}${t('common.seconds')} ${ago}`;
        return `${s}${t('common.seconds')} ${ago}`;
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedSession(null);
        setModalMode('single');
    };

    const toggleSelectSession = (e, session) => {
        e.stopPropagation();
        const sessionId = session.id;
        const isSelected = selectedSessionIds.includes(sessionId);

        if (isSelected) {
            setSelectedSessionIds(prev => prev.filter(id => id !== sessionId));
            setSelectedSessionsData(prev => {
                const updated = { ...prev };
                delete updated[sessionId];
                return updated;
            });
        } else {
            setSelectedSessionIds(prev => [...prev, sessionId]);
            setSelectedSessionsData(prev => ({ ...prev, [sessionId]: session }));
        }
    };

    const toggleSelectAll = () => {
        const currentPageIds = sessions.map(s => s.id);
        const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedSessionIds.includes(id));

        if (allOnPageSelected) {
            setSelectedSessionIds(prev => prev.filter(id => !currentPageIds.includes(id)));
            setSelectedSessionsData(prev => {
                const updated = { ...prev };
                currentPageIds.forEach(id => delete updated[id]);
                return updated;
            });
        } else {
            const newIds = [...new Set([...selectedSessionIds, ...currentPageIds])];
            setSelectedSessionIds(newIds);
            setSelectedSessionsData(prev => {
                const updated = { ...prev };
                sessions.forEach(s => {
                    updated[s.id] = s;
                });
                return updated;
            });
        }
    };

    const toggleSelectAllMatching = async () => {
        setSelectingAllMatching(true);
        try {
            let url = `/api/sessions?page=1&limit=1000000`;
            if (filters.carId) url += `&carId=${filters.carId}`;
            if (filters.year) url += `&year=${filters.year}`;
            if (filters.month) url += `&month=${filters.month}`;
            url += `&tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                const allIds = result.data.map(s => s.id);
                const allData = {};
                result.data.forEach(s => {
                    allData[s.id] = s;
                });
                setSelectedSessionIds(allIds);
                setSelectedSessionsData(allData);
            }
        } catch (err) {
            console.error('Failed to select all matching:', err);
        } finally {
            setSelectingAllMatching(false);
        }
    };

    const handleRowClick = (session) => {
        const start = parseUTC(session.startTime);
        if (!start) return;

        const end = parseUTC(session.endTime) || new Date();

        const formatForMap = (date) => {
            const iso = date.toISOString();
            return {
                date: iso.split('T')[0],
                time: iso.split('T')[1].substring(0, 8)
            };
        };

        const startParts = formatForMap(start);
        const endParts = formatForMap(end);

        setSelectedSession({
            deviceId: session.deviceId,
            startDate: startParts.date,
            startTime: startParts.time,
            endDate: endParts.date,
            endTime: endParts.time
        });
        setModalMode('single');
        setModalMapType('routes');
        setIsModalOpen(true);
    };

    const handleViewSelectedMap = (mapType = 'routes') => {
        if (selectedSessionIds.length === 0) return;

        const selectedSessions = selectedSessionIds.map(id => selectedSessionsData[id]).filter(Boolean);
        const filtersList = selectedSessions.map(s => {
            const start = parseUTC(s.startTime);
            const end = parseUTC(s.endTime) || new Date();

            const formatForMap = (date) => {
                const iso = date.toISOString();
                return {
                    date: iso.split('T')[0],
                    time: iso.split('T')[1].substring(0, 8)
                };
            };

            const startParts = formatForMap(start);
            const endParts = formatForMap(end);

            return {
                deviceId: s.deviceId,
                startDate: startParts.date,
                startTime: startParts.time,
                endDate: endParts.date,
                endTime: endParts.time
            };
        });

        setSelectedSession(filtersList);
        setModalMode('multi');
        setModalMapType(mapType);
        setIsDropdownOpen(false); // Close dropdown when an option is selected
        setIsModalOpen(true);
    };

    const toggleSessionType = async (e, sessionId, currentType) => {
        e.stopPropagation();
        if (userProfile?.isDemo) {
            alert(t('sessions.demoWarning'));
            return;
        }
        const newType = currentType === 'B' ? 'P' : 'B';
        try {
            const response = await fetch('/api/sessions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: sessionId, type: newType })
            });
            const result = await response.json();
            if (result.success) {
                setSessions(sessions.map(s =>
                    s.id === sessionId ? { ...s, type: newType } : s
                ));
            } else {
                alert(t('sessions.updateError', { error: result.error }));
            }
        } catch (err) {
            alert(t('sessions.updateFailed', { error: err.message }));
        }
    };

    const deleteSession = async (e, sessionId) => {
        e.stopPropagation();
        if (userProfile?.isDemo) {
            alert(t('sessions.demoWarning'));
            return;
        }
        if (!confirm(t('sessions.deleteConfirm'))) {
            return;
        }
        try {
            const response = await fetch(`/api/sessions?id=${sessionId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                setSessions(sessions.filter(s => s.id !== sessionId));
                // If it's the latest session, refresh it
                if (latestSession && latestSession.id === sessionId) {
                    fetchLatestSession();
                }
            } else {
                alert(t('sessions.deleteError', { error: result.error }));
            }
        } catch (err) {
            alert(t('sessions.deleteError', { error: err.message }));
        }
    };

    const endSessionWithTime = async (deviceId, timestamp_utc, id = null) => {
        if (userProfile?.isDemo) {
            alert(t('sessions.demoWarning'));
            return;
        }
        try {
            const response = await fetch('/api/Session/end-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: deviceId, timestamp_utc, id: id || endSessionId })
            });
            const result = await response.json();
            if (response.ok) {
                fetchLatestSession();
                fetchSessions(pagination.page);
                setIsEndSessionModalOpen(false);
                setEndSessionId(null);
                setEndSessionDeviceId(null);
            } else {
                alert(t('sessions.endSessionError', { error: result.message }));
            }
        } catch (err) {
            alert(t('sessions.endSessionError', { error: err.message }));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            {t('sessions.title')}
                        </h1>
                        <p className="mt-2 text-lg text-gray-600">
                            {t('sessions.subtitle')}
                        </p>
                        {/* Session timer widget — always shows true latest session regardless of filters */}
                        {timerSession && (
                            <div className={`mt-3 inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm border ${isActive
                                    ? 'bg-green-50 border-green-200 text-green-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-600'
                                }`}>
                                {isActive ? (
                                    <>
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                        </span>
                                        <span>{t('sessions.sessionActive')}</span>
                                        <span className="font-mono text-green-700 tabular-nums">
                                            {formatElapsed(now - parseUTC(timerSession.startTime))}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const d = new Date();
                                                // Adjust to local time string for datetime-local input
                                                const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                setEndSessionDateTime(localIso);
                                                setEndSessionId(timerSession.id);
                                                setEndSessionDeviceId(timerSession.deviceId);
                                                setIsEndSessionModalOpen(true);
                                            }}
                                            className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1"
                                            title={t('sessions.endSessionWithTime')}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {t('sessions.endSession')}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{t('sessions.lastSessionEnded')}</span>
                                        <span className="font-mono text-gray-800">
                                            {formatAgo(now - parseUTC(timerSession.endTime))}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                        {selectedSessionIds.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 animate-in zoom-in duration-200"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A2 2 0 013 15.492V4.508a2 2 0 011.553-1.954L9 1h6l5.447 2.554A2 2 0 0121 5.508v10.984a2 2 0 01-1.553 1.954L15 21H9z" />
                                    </svg>
                                    {t('sessions.viewOnMap', { count: selectedSessionIds.length })}
                                    <svg className={`w-4 h-4 ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                {isDropdownOpen && (
                                    <>
                                        {/* Invisible overlay to catch clicks outside */}
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => setIsDropdownOpen(false)}
                                        ></div>
                                        
                                        <div className="absolute top-full mt-2 w-full sm:w-48 bg-white border border-gray-100 rounded-lg shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 right-0 sm:right-auto">
                                            <div className="py-1 flex flex-col">
                                                <button
                                                    onClick={() => handleViewSelectedMap('routes')}
                                                    className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 text-left w-full"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A2 2 0 013 15.492V4.508a2 2 0 011.553-1.954L9 1h6l5.447 2.554A2 2 0 0121 5.508v10.984a2 2 0 01-1.553 1.954L15 21H9z" />
                                                    </svg>
                                                    {t('sessions.routes')}
                                                </button>
                                                <button
                                                    onClick={() => handleViewSelectedMap('heatmap')}
                                                    className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 text-left w-full border-t border-gray-50"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    {t('sessions.heatMap')}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        <button
                            onClick={() => fetchSessions(pagination.page)}
                            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t('common.refresh')}
                        </button>
                    </div>
                </header>

                <div className="bg-white shadow-md rounded-xl p-4 mb-4 border border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-end gap-4">
                        <div className="w-full md:flex-1 md:min-w-[200px]">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">{t('sessions.carFilter')}</label>
                            <select
                                value={filters.carId}
                                onChange={(e) => {
                                    setFilters(prev => ({ ...prev, carId: e.target.value }));
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">{t('sessions.allCars')}</option>
                                {cars.map(car => (
                                    <option key={car.ID} value={car.ID}>
                                        {car.DESCRIPTION || car.LICENSE_PLATE || `${t('sessions.carFilter')} #${car.ID}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">{t('sessions.year')}</label>
                            <select
                                value={filters.year}
                                onChange={(e) => {
                                    setFilters(prev => ({ ...prev, year: e.target.value }));
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">{t('common.anyYear')}</option>
                                {[2024, 2025, 2026].map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-40">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">{t('sessions.month')}</label>
                            <select
                                value={filters.month}
                                onChange={(e) => {
                                    setFilters(prev => ({ ...prev, month: e.target.value }));
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">{t('common.anyMonth')}</option>
                                {[
                                    { v: 1, n: t('months.1') }, { v: 2, n: t('months.2') }, { v: 3, n: t('months.3') },
                                    { v: 4, n: t('months.4') }, { v: 5, n: t('months.5') }, { v: 6, n: t('months.6') },
                                    { v: 7, n: t('months.7') }, { v: 8, n: t('months.8') }, { v: 9, n: t('months.9') },
                                    { v: 10, n: t('months.10') }, { v: 11, n: t('months.11') }, { v: 12, n: t('months.12') }
                                ].map(m => (
                                    <option key={m.v} value={m.v}>{m.n}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">{t('sessions.pageSize')}</label>
                            <select
                                value={pagination.limit === 1000000 ? 'all' : pagination.limit}
                                onChange={(e) => {
                                    const newLimit = e.target.value === 'all' ? 1000000 : parseInt(e.target.value);
                                    setPagination(p => ({ ...p, limit: newLimit, page: 1 }));
                                }}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="20">20 {t('common.perPage')}</option>
                                <option value="50">50 {t('common.perPage')}</option>
                                <option value="100">100 {t('common.perPage')}</option>
                                <option value="all">{t('common.all')}</option>
                            </select>
                        </div>
                        <div className="w-full sm:w-auto flex items-end md:self-end pb-0.5">
                            <button
                                onClick={() => {
                                    setFilters({ carId: '', year: '', month: '' });
                                    setPagination(p => ({ ...p, page: 1, limit: 20 }));
                                    setSelectedSessionIds([]);
                                    setSelectedSessionsData({});
                                }}
                                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                {t('common.clearAll')}
                            </button>
                        </div>
                    </div>
                </div>

                {selectedSessionIds.length > 0 && (
                    <div className="mb-4 px-6 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-sm animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-2 text-blue-700 font-medium">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>
                                {selectedSessionIds.length === pagination.total ? (
                                    <>{t('sessions.allSessionsSelected', { count: pagination.total })}</>
                                ) : (
                                    <>
                                        {t('sessions.selectedSessions', { count: selectedSessionIds.length })}
                                        {sessions.length > 0 && sessions.every(s => selectedSessionIds.includes(s.id)) && selectedSessionIds.length < pagination.total && (
                                            <button
                                                onClick={toggleSelectAllMatching}
                                                disabled={selectingAllMatching}
                                                className="ml-2 text-blue-800 underline hover:no-underline font-bold disabled:opacity-50"
                                            >
                                                {selectingAllMatching ? t('sessions.selecting') : t('sessions.selectAllMatching', { count: pagination.total })}
                                            </button>
                                        )}
                                    </>
                                )}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedSessionIds([]);
                                setSelectedSessionsData({});
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider"
                        >
                            {t('sessions.clearSelection')}
                        </button>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{t('common.error')}: {error}</span>
                    </div>
                )}

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="p-0 text-center">
                        {loading && sessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-gray-500 font-medium">{t('sessions.loadingHistory')}</p>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="py-20">
                                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('sessions.noSessionsFound')}</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    {t('sessions.noSessionsDescription')}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="px-4 py-4 w-10">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                        checked={sessions.length > 0 && sessions.every(s => selectedSessionIds.includes(s.id))}
                                                        onChange={toggleSelectAll}
                                                    />
                                                </th>
                                                <th className="px-2 py-4 w-10"></th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">{t('sessions.table.car')}</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">{t('sessions.table.startTime')}</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">{t('sessions.table.endTime')}</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left" title={t('sessions.table.startLocTitle')}>{t('sessions.table.startLoc')}</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left" title={t('sessions.table.endLocTitle')}>{t('sessions.table.endLoc')}</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">{t('sessions.table.type')}</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">{t('sessions.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 text-left">
                                            {sessions.map((session) => (
                                                <Fragment key={session.id}>
                                                    <tr
                                                        onClick={() => handleRowClick(session)}
                                                        className={`hover:bg-blue-50/50 transition-colors group cursor-pointer ${selectedSessionIds.includes(session.id) ? 'bg-blue-50/30' : ''}`}
                                                    >
                                                        <td className="px-4 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                                checked={selectedSessionIds.includes(session.id)}
                                                                onChange={(e) => toggleSelectSession(e, session)}
                                                            />
                                                        </td>
                                                        <td className="px-2 py-4 w-10" onClick={(e) => toggleExpandSession(e, session.id)}>
                                                            <button
                                                                className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors cursor-pointer"
                                                                title={t('sessions.expandToggleTitle')}
                                                            >
                                                                {expandedSessionIds.includes(session.id) ? (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="px-2 py-4 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-gray-900">{session.description || t('common.unknownCar')}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                            {session.startTime ? parseUTC(session.startTime).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' }) : 'N/A'}
                                                        </td>
                                                        <td className="px-2 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                            {session.endTime ? parseUTC(session.endTime).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' }) : (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                                                                    {t('common.activeNow')}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-4 text-sm text-gray-600">
                                                            <div className="max-w-[220px] truncate" title={session.locationStart}>
                                                                {session.locationStart || '-'}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-4 text-sm text-gray-600">
                                                            <div className="max-w-[220px] truncate" title={session.locationEnd}>
                                                                {session.locationEnd || '-'}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-4 whitespace-nowrap">
                                                            <button
                                                                onClick={(e) => toggleSessionType(e, session.id, session.type)}
                                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${session.type === 'P' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                                                    session.type === 'B' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                                                                        'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                    }`}
                                                                title={t('sessions.typeToggleTitle')}
                                                            >
                                                                {session.type === 'P' ? t('common.personal') :
                                                                    session.type === 'B' ? t('common.business') :
                                                                        (session.type || t('common.standard'))}
                                                            </button>
                                                        </td>
                                                        <td className="px-2 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                {!session.endTime && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const d = new Date();
                                                                            const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                                            setEndSessionDateTime(localIso);
                                                                            setEndSessionId(session.id);
                                                                            setEndSessionDeviceId(session.deviceId);
                                                                            setIsEndSessionModalOpen(true);
                                                                        }}
                                                                        className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors group/end"
                                                                        title={t('sessions.endSession')}
                                                                    >
                                                                        <svg className="w-4 h-4 group-hover/end:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => deleteSession(e, session.id)}
                                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors group/del"
                                                                    title={t('sessions.delete')}
                                                                >
                                                                    <svg className="w-4 h-4 group-hover/del:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {expandedSessionIds.includes(session.id) && (
                                                        <tr>
                                                            <td colSpan="8" className="p-0 bg-gray-50/80">
                                                                <div className="py-2 px-6 border-b border-gray-200">
                                                                    <SessionPointsList session={session} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="bg-gray-50 px-4 md:px-6 py-4 flex flex-col md:flex-row items-center justify-between border-t border-gray-100 gap-4">
                                    <div className="text-sm text-gray-500">
                                        {t('sessions.showingSessions', { 
                                            start: (pagination.page - 1) * pagination.limit + 1, 
                                            end: Math.min(pagination.page * pagination.limit, pagination.total), 
                                            total: pagination.total 
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handlePageChange(pagination.page - 1)}
                                            disabled={pagination.page === 1 || loading}
                                            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            {t('common.previous')}
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                                let pageNum;
                                                if (pagination.totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (pagination.page <= 3) {
                                                    pageNum = i + 1;
                                                } else if (pagination.page >= pagination.totalPages - 2) {
                                                    pageNum = pagination.totalPages - 4 + i;
                                                } else {
                                                    pageNum = pagination.page - 2 + i;
                                                }

                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => handlePageChange(pageNum)}
                                                        className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${pagination.page === pageNum
                                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={() => handlePageChange(pagination.page + 1)}
                                            disabled={pagination.page === pagination.totalPages || loading}
                                            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            {t('common.next')}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                        onClick={closeModal}
                    ></div>

                    <div className="relative bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {modalMode === 'multi' ? t('sessions.modalMultiTitle', { count: selectedSessionIds.length }) : t('sessions.modalSingleTitle')}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {modalMode === 'multi' ? t('sessions.modalMultiSubtitle') : t('sessions.modalSingleSubtitle')}
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                            >
                                <svg className="w-6 h-6 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto relative">
                            {selectedSession && (
                                modalMapType === 'heatmap' ? (
                                    <HeatMapContainer
                                        initialFilters={selectedSession}
                                        isModal={true}
                                    />
                                ) : (
                                    <MapContainer
                                        initialFilters={selectedSession}
                                        isModal={true}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isEndSessionModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsEndSessionModalOpen(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">{t('sessions.selectEndDate')}</h3>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            <p className="text-sm text-gray-600">
                                {t('sessions.endSessionConfirm')}
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">{t('sessions.table.endTime')}</label>
                                <input
                                    type="datetime-local"
                                    value={endSessionDateTime}
                                    onChange={(e) => setEndSessionDateTime(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsEndSessionModalOpen(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    const date = new Date(endSessionDateTime);
                                    if (isNaN(date.getTime())) {
                                        alert(t('maintenance.invalidDate'));
                                        return;
                                    }
                                    endSessionWithTime(endSessionDeviceId, date.toISOString(), endSessionId);
                                }}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
                            >
                                {t('sessions.endSession')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
