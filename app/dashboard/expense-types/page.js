'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function ManageExpenseTypesPage() {
    const [types, setTypes] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [userProfile, setUserProfile] = useState(null);
    const { t } = useTranslation();

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user) {
                    setUserProfile(data.user);
                }
            })
            .catch(console.error);
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/user/expense-types');
            const data = await res.json();
            if (data.success) {
                setTypes(data.types);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        if (!name) {
            setError(t('expenses.fillMandatory') || 'Please fill name');
            setSubmitting(false);
            return;
        }

        try {
            const res = await fetch('/api/user/expense-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(t('expenses.typeAddSuccess') || 'Added successfully');
                setName('');
                setDescription('');
                fetchTypes();
            } else {
                setError(data.error || 'Failed to add type');
            }
        } catch (err) {
            setError('Error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async (id) => {
        const result = await Swal.fire({ title: 'Confirmation', text: String(t('expenses.typeRemoveConfirm') || 'Delete this type?'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33' });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch(`/api/user/expense-types?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setSuccess('Removed successfully');
                fetchTypes();
            } else {
                setError(data.error || 'Failed to remove');
            }
        } catch (err) {
            setError('Error occurred');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-slate-900 p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {t('expenses.manageTypesTitle') || 'Manage Expense Types'}
                    </h1>
                    <p className="text-gray-500 mt-2">{t('expenses.manageTypesSubtitle') || 'Create categories for your other expenses'}</p>
                </header>

                <div className="grid gap-8">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4">{t('expenses.addType') || 'Add Expense Type'}</h2>
                        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 font-medium">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full placeholder-gray-400"
                                    required
                                    placeholder="e.g. Tolls, Food, Lodging"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-gray-500 font-medium">Description (optional)</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full placeholder-gray-400"
                                    placeholder="Brief description"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting || userProfile?.isDemo}
                                className="md:col-span-2 mt-4 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50 text-lg"
                            >
                                {submitting ? 'Saving...' : 'Add Type'}
                            </button>
                        </form>
                        {error && <p className="mt-4 text-red-600 text-sm font-medium">{error}</p>}
                        {success && <p className="mt-4 text-green-600 text-sm font-medium">{success}</p>}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-semibold">Your Expense Types</h2>
                            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200">{types.length} total</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {loading ? (
                                <div className="p-10 text-center text-gray-500">Loading...</div>
                            ) : types.length === 0 ? (
                                <div className="p-10 text-center text-gray-500 font-medium italic">No expense types found. Add one above.</div>
                            ) : (
                                types.map((tItem) => (
                                    <div key={tItem.id} className="p-6 hover:bg-gray-50 transition-colors flex justify-between items-center">
                                        <div>
                                            <div className="text-lg font-bold text-slate-800">{tItem.name}</div>
                                            <div className="text-sm text-gray-500">{tItem.description}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemove(tItem.id)}
                                            className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all uppercase tracking-widest disabled:opacity-30"
                                            disabled={submitting || userProfile?.isDemo}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <Link href="/dashboard/other-expenses" className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium">
                        ← Back to Expenses
                    </Link>
                </div>
            </div>
        </div>
    );
}
