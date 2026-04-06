'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function DemoLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { t } = useTranslation();

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
                setError(data.error || t('admin.fetchFailed'));
            }
        } catch (err) {
            setError(t('common.errorOccurred'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-slate-900 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-12 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            {t('admin.title')}
                        </h1>
                        <p className="text-gray-500 mt-2">{t('admin.subtitle')}</p>
                    </div>
                    <button 
                        onClick={fetchLogs}
                        className="px-4 py-2 bg-gray-100 hover:bg-slate-700 rounded-lg text-sm transition-colors border border-gray-200"
                    >
                        {t('admin.refresh')}
                    </button>
                </header>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">{t('admin.table.time')}</th>
                                    <th className="px-6 py-4 font-semibold">{t('admin.table.ip')}</th>
                                    <th className="px-6 py-4 font-semibold">{t('admin.table.userAgent')}</th>
                                    <th className="px-6 py-4 font-semibold">{t('admin.table.referer')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-10 text-center text-slate-500">{t('admin.loading')}</td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-10 text-center text-slate-500 italic">{t('admin.noLogs')}</td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.ID} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {new Date(log.accessTime).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-blue-600">
                                                {log.ipAddress}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={log.userAgent}>
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
                    <Link href="/" className="text-slate-500 hover:text-blue-600 transition-colors inline-flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        {t('admin.backToDashboard')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
