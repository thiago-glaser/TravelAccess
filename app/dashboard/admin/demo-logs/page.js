'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DemoLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/admin/demo-logs');
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            } else {
                setError(data.error || 'Failed to fetch logs');
            }
        } catch (err) {
            setError('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-12 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            Demo Access Logs
                        </h1>
                        <p className="text-slate-400 mt-2">Monitor connections to the demo account.</p>
                    </div>
                    <button 
                        onClick={fetchLogs}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors border border-slate-700"
                    >
                        Refresh Logs
                    </button>
                </header>

                <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Time (UTC)</th>
                                    <th className="px-6 py-4 font-semibold">IP Address</th>
                                    <th className="px-6 py-4 font-semibold">User Agent</th>
                                    <th className="px-6 py-4 font-semibold">Referer</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-10 text-center text-slate-500">Loading logs...</td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-10 text-center text-slate-500 italic">No access logs found</td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.ID} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-300">
                                                {new Date(log.accessTime).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-blue-400">
                                                {log.ipAddress}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-400 max-w-xs truncate" title={log.userAgent}>
                                                {log.userAgent}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 italic">
                                                {log.referer || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <Link href="/" className="text-slate-500 hover:text-blue-400 transition-colors inline-flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
