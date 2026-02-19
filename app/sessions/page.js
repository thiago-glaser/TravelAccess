'use client';

import { useState, useEffect } from 'react';

export default function SessionsPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Placeholder for fetching session data
    useEffect(() => {
        const timer = setTimeout(() => {
            setSessions([]);
            setLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        Device Sessions
                    </h1>
                    <p className="mt-2 text-lg text-gray-600">
                        View and manage tracked travel sessions across your devices.
                    </p>
                </header>

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="p-8 text-center">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-gray-500 font-medium">Loading session history...</p>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="py-12">
                                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">No Sessions Found</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    No GPS tracking sessions have been recorded yet. Start a session from your mobile device to see it here.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Device</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Start Time</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">End Time</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {/* Session rows would go here */}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
