'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function ApiKeysPage() {
    const [keys, setKeys] = useState([]);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [userProfile, setUserProfile] = useState(null);
    const { t } = useTranslation();

    useEffect(() => {
        fetchKeys();
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user) {
                    setUserProfile(data.user);
                }
            })
            .catch(err => console.error('Failed to load user profile:', err));
    }, []);

    const fetchKeys = async () => {
        try {
            const res = await fetch('/api/auth/api-keys');
            const data = await res.json();
            if (data.success) {
                setKeys(data.apiKeys);
            }
        } catch (err) {
            console.error('Failed to fetch keys');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await fetch('/api/auth/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description }),
            });
            const data = await res.json();
            if (data.success) {
                setNewKey(data.apiKey);
                setDescription('');
                fetchKeys();
            }
        } catch (err) {
            console.error('Failed to create key');
        } finally {
            setCreating(false);
        }
    };

    const handleRevokeKey = async (id) => {
        if (!confirm(t('keys.revokeConfirm'))) return;

        try {
            const res = await fetch(`/api/auth/api-keys?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                fetchKeys();
            }
        } catch (err) {
            console.error('Failed to revoke key');
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-bold">{t('keys.title')}</h1>
                        <p className="text-slate-400 mt-2">{t('keys.subtitle')}</p>
                    </div>
                    <a href="/" className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700">{t('keys.backToMap')}</a>
                </header>

                <div className="grid gap-8">
                    {/* Create New Key Section */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700">
                        <h2 className="text-xl font-semibold mb-6">{t('keys.createTitle')}</h2>
                        <form onSubmit={handleCreateKey} className="flex gap-4">
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('keys.descriptionPlaceholder')}
                                className="flex-1 px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                required
                            />
                            <button
                                type="submit"
                                disabled={creating || userProfile?.isDemo}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all disabled:opacity-50"
                            >
                                {userProfile?.isDemo ? t('keys.viewOnly') : (creating ? t('keys.generating') : t('keys.generateBtn'))}
                            </button>
                        </form>

                        {newKey && (
                            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/50 rounded-xl">
                                <p className="text-green-400 text-sm mb-2 font-medium">{t('keys.newKeyWarning')}</p>
                                <div className="flex gap-2">
                                    <code className="flex-1 p-3 bg-black/40 rounded-lg text-lg font-mono break-all">{newKey}</code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(newKey)}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                    >
                                        {t('keys.copy')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Keys List Section */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-700">
                            <h2 className="text-xl font-semibold">{t('keys.existingTitle')}</h2>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#0f172a]/50 text-slate-400 text-sm uppercase">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">{t('keys.table.description')}</th>
                                        <th className="px-6 py-4 font-medium">{t('keys.table.created')}</th>
                                        <th className="px-6 py-4 font-medium">{t('keys.table.lastUsed')}</th>
                                        <th className="px-6 py-4 font-medium">{t('keys.table.status')}</th>
                                        <th className="px-6 py-4 font-medium">{t('keys.table.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">{t('keys.loading')}</td></tr>
                                    ) : keys.length === 0 ? (
                                        <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">{t('keys.noKeys')}</td></tr>
                                    ) : (
                                        keys.map((key) => (
                                            <tr key={key.ID} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 font-medium">{key.DESCRIPTION}</td>
                                                <td className="px-6 py-4 text-slate-400 text-sm">
                                                    {new Date(key.CREATED_AT).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-sm">
                                                    {key.LAST_USED ? new Date(key.LAST_USED).toLocaleString() : t('keys.never')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${key.IS_ACTIVE ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {key.IS_ACTIVE ? t('keys.active') : t('keys.inactive')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleRevokeKey(key.ID)}
                                                        disabled={userProfile?.isDemo}
                                                        className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        {t('keys.revoke')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
