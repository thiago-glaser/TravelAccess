'use client';

import { useState, useEffect } from 'react';

export default function ApiKeysPage() {
    const [keys, setKeys] = useState([]);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKey, setNewKey] = useState('');

    useEffect(() => {
        fetchKeys();
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
        if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

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
                        <h1 className="text-3xl font-bold">API Access Keys</h1>
                        <p className="text-slate-400 mt-2">Manage your keys for secure API access</p>
                    </div>
                    <a href="/" className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700">Back to Map</a>
                </header>

                <div className="grid gap-8">
                    {/* Create New Key Section */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700">
                        <h2 className="text-xl font-semibold mb-6">Create New Key</h2>
                        <form onSubmit={handleCreateKey} className="flex gap-4">
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Key description (e.g., Mobile App)"
                                className="flex-1 px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                required
                            />
                            <button
                                type="submit"
                                disabled={creating}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all disabled:opacity-50"
                            >
                                {creating ? 'Generating...' : 'Generate Key'}
                            </button>
                        </form>

                        {newKey && (
                            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/50 rounded-xl">
                                <p className="text-green-400 text-sm mb-2 font-medium">Your new API key (copy it now, it won't be shown again):</p>
                                <div className="flex gap-2">
                                    <code className="flex-1 p-3 bg-black/40 rounded-lg text-lg font-mono break-all">{newKey}</code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(newKey)}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Keys List Section */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-700">
                            <h2 className="text-xl font-semibold">Existing Keys</h2>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#0f172a]/50 text-slate-400 text-sm uppercase">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Description</th>
                                        <th className="px-6 py-4 font-medium">Created</th>
                                        <th className="px-6 py-4 font-medium">Last Used</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading keys...</td></tr>
                                    ) : keys.length === 0 ? (
                                        <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No API keys found</td></tr>
                                    ) : (
                                        keys.map((key) => (
                                            <tr key={key.ID} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 font-medium">{key.DESCRIPTION}</td>
                                                <td className="px-6 py-4 text-slate-400 text-sm">
                                                    {new Date(key.CREATED_AT).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-sm">
                                                    {key.LAST_USED ? new Date(key.LAST_USED).toLocaleString() : 'Never'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${key.IS_ACTIVE ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {key.IS_ACTIVE ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleRevokeKey(key.ID)}
                                                        className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                                                    >
                                                        Revoke
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
