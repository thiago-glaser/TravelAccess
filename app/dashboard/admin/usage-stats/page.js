'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const MONTH_NAMES = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function MonthBadge({ month, year }) {
    return (
        <span className="text-xs font-semibold text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded-full">
            {MONTH_NAMES[month]} {year}
        </span>
    );
}

function StatCard({ label, value, sub, color = 'indigo' }) {
    const colors = {
        indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-300',
        blue:   'from-blue-500/20   to-blue-600/10   border-blue-500/30   text-blue-300',
        violet: 'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-300',
        emerald:'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300',
    };
    return (
        <div className={`rounded-2xl border bg-gradient-to-br p-5 ${colors[color]}`}>
            <p className="text-xs uppercase tracking-widest opacity-70 mb-1">{label}</p>
            <p className="text-3xl font-bold text-slate-900">{value?.toLocaleString()}</p>
            {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
        </div>
    );
}

export default function UsageStatsPage() {
    const now = new Date();
    const [selectedYear,  setSelectedYear]  = useState(now.getUTCFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getUTCMonth() + 1);
    const [data,          setData]          = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState('');
    const [search,        setSearch]        = useState('');

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const url = `/api/admin/usage-stats?year=${selectedYear}&month=${selectedMonth}`;
            const res  = await fetch(url);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Unknown error');
            setData(json);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    // Derived stats
    const usageRows  = data?.usage || [];
    const filtered   = usageRows.filter(r =>
        !search || (r.PATH || '').toLowerCase().includes(search.toLowerCase())
    );
    const totalHits  = usageRows.reduce((s, r) => s + (r.HIT_COUNT || 0), 0);
    const topPath    = usageRows[0];
    const apiHits    = usageRows.filter(r => (r.PATH || '').startsWith('/api'))
                                .reduce((s, r) => s + (r.HIT_COUNT || 0), 0);
    const pageHits   = totalHits - apiHits;

    const availableMonths = data?.availableMonths || [];
    const uniqueYears = [...new Set(availableMonths.map(m => m.YEAR_NUM))].sort((a, b) => b - a);

    // Bar chart max
    const maxHits = filtered.length > 0 ? Math.max(...filtered.map(r => r.HIT_COUNT || 0)) : 1;

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', color: '#1e293b', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                {/* Header */}
                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, background: 'linear-gradient(90deg, #818cf8, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                            📊 Monthly Usage Stats
                        </h1>
                        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                            Hit counts per page and API endpoint
                        </p>
                    </div>
                    <Link href="/dashboard" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        ← Back to Dashboard
                    </Link>
                </header>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(Number(e.target.value))}
                        style={selectStyle}
                    >
                        {uniqueYears.length === 0
                            ? <option value={now.getUTCFullYear()}>{now.getUTCFullYear()}</option>
                            : uniqueYears.map(y => <option key={y} value={y}>{y}</option>)
                        }
                    </select>

                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(Number(e.target.value))}
                        style={selectStyle}
                    >
                        {MONTH_NAMES.slice(1).map((name, i) => (
                            <option key={i + 1} value={i + 1}>{name}</option>
                        ))}
                    </select>

                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        style={btnStyle}
                    >
                        {loading ? '⏳ Loading…' : '↻ Refresh'}
                    </button>

                    <input
                        placeholder="Filter by path…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ ...selectStyle, marginLeft: 'auto', minWidth: '200px' }}
                    />
                </div>

                {/* Error */}
                {error && (
                    <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '0.75rem', padding: '1rem', color: '#fca5a5', marginBottom: '1.5rem' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Stat cards */}
                {!loading && !error && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        {[
                            { label: 'Total Hits',  value: totalHits, sub: `${MONTH_NAMES[selectedMonth]} ${selectedYear}`, color: '#818cf8' },
                            { label: 'Page Views',  value: pageHits,  sub: 'Non-API routes',                               color: '#38bdf8' },
                            { label: 'API Calls',   value: apiHits,   sub: '/api/* routes',                                color: '#a78bfa' },
                            { label: 'Unique Paths',value: usageRows.length, sub: 'Distinct endpoints',                    color: '#34d399' },
                        ].map(card => (
                            <div key={card.label} style={{
                                background: '#ffffff',
                                border: `1px solid ${card.color}44`,
                                borderRadius: '1rem',
                                padding: '1.25rem',
                                backdropFilter: 'blur(8px)'
                            }}>
                                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, marginBottom: '0.25rem', opacity: 0.8 }}>{card.label}</p>
                                <p style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{card.value?.toLocaleString()}</p>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{card.sub}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Table */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={thStyle}>#</th>
                                    <th style={thStyle}>Path</th>
                                    <th style={thStyle}>Type</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Hits</th>
                                    <th style={{ ...thStyle, minWidth: '200px' }}>Distribution</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>
                                            <span style={{ animation: 'pulse 1.5s infinite' }}>Loading…</span>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#475569', fontStyle: 'italic' }}>
                                            No data for {MONTH_NAMES[selectedMonth]} {selectedYear}
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((row, i) => {
                                        const isApi   = (row.PATH || '').startsWith('/api');
                                        const pct     = Math.round(((row.HIT_COUNT || 0) / maxHits) * 100);
                                        const barColor = isApi ? '#818cf8' : '#38bdf8';
                                        return (
                                            <tr key={row.PATH} style={{
                                                borderBottom: '1px solid #e2e8f0',
                                                transition: 'background 0.15s'
                                            }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <td style={tdStyle}>
                                                    <span style={{ color: '#475569', fontWeight: 600, fontSize: '0.8rem' }}>
                                                        {i + 1}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <code style={{ fontSize: '0.8rem', color: '#334155', wordBreak: 'break-all' }}>
                                                        {row.PATH}
                                                    </code>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '999px',
                                                        background: isApi ? 'rgba(129,140,248,0.15)' : 'rgba(56,189,248,0.15)',
                                                        color: isApi ? '#818cf8' : '#38bdf8',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {isApi ? 'API' : 'Page'}
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                                    {(row.HIT_COUNT || 0).toLocaleString()}
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${pct}%`,
                                                            background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
                                                            borderRadius: '999px',
                                                            transition: 'width 0.4s ease'
                                                        }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer summary */}
                    {!loading && filtered.length > 0 && (
                        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#475569' }}>
                            <span>Showing {filtered.length} of {usageRows.length} paths</span>
                            <span>Total: <strong style={{ color: '#94a3b8' }}>{totalHits.toLocaleString()} hits</strong> in {MONTH_NAMES[selectedMonth]} {selectedYear}</span>
                        </div>
                    )}
                </div>

                {/* Available months overview */}
                {availableMonths.length > 0 && (
                    <div style={{ marginTop: '2rem' }}>
                        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                            All recorded months
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {availableMonths.map(m => (
                                <button
                                    key={`${m.YEAR_NUM}-${m.MONTH_NUM}`}
                                    onClick={() => { setSelectedYear(m.YEAR_NUM); setSelectedMonth(m.MONTH_NUM); }}
                                    style={{
                                        background: (selectedYear === m.YEAR_NUM && selectedMonth === m.MONTH_NUM)
                                            ? '#eff6ff' : '#ffffff',
                                        border: (selectedYear === m.YEAR_NUM && selectedMonth === m.MONTH_NUM)
                                            ? '1px solid #818cf8' : '1px solid #e2e8f0',
                                        borderRadius: '0.5rem',
                                        padding: '0.35rem 0.75rem',
                                        color: '#334155',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {MONTH_NAMES[m.MONTH_NUM]} {m.YEAR_NUM}
                                    <span style={{ marginLeft: '0.4rem', color: '#475569' }}>({(m.TOTAL_HITS || 0).toLocaleString()})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Inline styles
const selectStyle = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '0.5rem',
    color: '#1e293b',
    padding: '0.4rem 0.75rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
    outline: 'none'
};

const btnStyle = {
    background: 'rgba(129,140,248,0.15)',
    border: '1px solid rgba(129,140,248,0.3)',
    borderRadius: '0.5rem',
    color: '#818cf8',
    padding: '0.4rem 1rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.15s'
};

const thStyle = {
    padding: '0.75rem 1.25rem',
    textAlign: 'left',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#64748b',
    fontWeight: 600,
    whiteSpace: 'nowrap'
};

const tdStyle = {
    padding: '0.65rem 1.25rem',
    fontSize: '0.875rem',
    verticalAlign: 'middle'
};
