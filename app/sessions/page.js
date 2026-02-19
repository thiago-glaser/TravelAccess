'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('@/components/MapContainer'), {
    ssr: false,
    loading: () => <div className="w-full h-screen flex items-center justify-center bg-gray-100"><p className="text-xl text-gray-500">Loading Map...</p></div>,
});

export default function SessionsPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [selectedSession, setSelectedSession] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Robust UTC parsing and formatting
    const parseUTC = (dateVal) => {
        if (!dateVal) return null;
        try {
            // If it's already a Date, use it
            if (dateVal instanceof Date) return dateVal;

            // If it's a string, ensure it's treated as UTC
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
            const response = await fetch(`/api/sessions?page=${page}&limit=20`);
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

    useEffect(() => {
        fetchSessions(pagination.page);
    }, [pagination.page]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedSession(null);
    };

    const handleRowClick = (session) => {
        const start = parseUTC(session.startTime);
        if (!start) return;

        const end = parseUTC(session.endTime) || new Date();

        const formatForMap = (date) => {
            const iso = date.toISOString(); // Always UTC
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
        setIsModalOpen(true);
    };

    const toggleSessionType = async (e, sessionId, currentType) => {
        e.stopPropagation(); // Prevent opening modal when clicking the button
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
                alert('Error updating session type: ' + result.error);
            }
        } catch (err) {
            alert('Update failed: ' + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            Device Sessions
                        </h1>
                        <p className="mt-2 text-lg text-gray-600">
                            View and manage tracked travel sessions across your devices.
                        </p>
                    </div>
                    <button
                        onClick={() => fetchSessions(pagination.page)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </header>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Error: {error}</span>
                    </div>
                )}

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="p-0 text-center">
                        {loading && sessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-gray-500 font-medium">Loading session history...</p>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="py-20">
                                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">No Sessions Found</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    No GPS tracking sessions have been recorded yet. Start a session from your mobile device to see it here.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">Device</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">Start Time</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">End Time</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left" title="Starting Location">Start Loc</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left" title="Ending Location">End Loc</th>
                                                <th className="px-2 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest text-left">Type</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 text-left">
                                            {sessions.map((session) => (
                                                <tr
                                                    key={session.id}
                                                    onClick={() => handleRowClick(session)}
                                                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                                >
                                                    <td className="px-2 py-4 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-900">{session.description || 'Unknown Device'}</span>
                                                            <span className="text-xs text-gray-500 font-mono">{session.deviceId}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                        {session.startTime ? parseUTC(session.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' }) : 'N/A'}
                                                    </td>
                                                    <td className="px-2 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                        {session.endTime ? parseUTC(session.endTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' }) : (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                                                                Active Now
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
                                                            title="Click to toggle between Personal and Business"
                                                        >
                                                            {session.type === 'P' ? 'Personal' :
                                                                session.type === 'B' ? 'Business' :
                                                                    (session.type || 'Standard')}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
                                    <div className="text-sm text-gray-500">
                                        Showing <span className="font-semibold text-gray-900">{(pagination.page - 1) * 20 + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(pagination.page * 20, pagination.total)}</span> of <span className="font-semibold text-gray-900">{pagination.total}</span> sessions
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handlePageChange(pagination.page - 1)}
                                            disabled={pagination.page === 1 || loading}
                                            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            Previous
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                                // Simple pagination logic to show page numbers around current page
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
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Session Map Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                        onClick={closeModal}
                    ></div>

                    <div className="relative bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Session Map Detail</h3>
                                <p className="text-sm text-gray-500">Viewing GPS path for the selected session</p>
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

                        {/* Modal Content - Map */}
                        <div className="flex-1 overflow-auto relative">
                            {selectedSession && (
                                <MapContainer
                                    initialFilters={selectedSession}
                                    isModal={true}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
