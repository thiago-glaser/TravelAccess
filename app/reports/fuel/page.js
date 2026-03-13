'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from 'next/link';

export default function FuelReportPage() {
    const [loading, setLoading] = useState(false);
    const [cars, setCars] = useState([]);
    const [fuelData, setFuelData] = useState([]);
    const [filters, setFilters] = useState({ carId: '', year: new Date().getFullYear().toString() });
    const [filteredFuel, setFilteredFuel] = useState([]);
    const [totals, setTotals] = useState({
        cost: 0,
        liters: 0,
        count: 0,
        avgPrice: 0,
        avgKmPerLiter: 0,
        avgPricePerKm: 0
    });
    const [error, setError] = useState(null);
    const [selectedReceipt, setSelectedReceipt] = useState(null);

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

    const fetchFuel = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/user/fuel');
            const result = await response.json();
            if (result.success) {
                setFuelData(result.fuel);
            }
        } catch (err) {
            console.error('Failed to fetch fuel:', err);
            setError('Failed to load fuel data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCars();
        fetchFuel();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [fuelData, filters]);

    const applyFilters = () => {
        let filtered = [...fuelData];

        if (filters.carId) {
            filtered = filtered.filter(f => f.carId === filters.carId);
        }

        if (filters.year) {
            filtered = filtered.filter(f => {
                const date = new Date(f.timestampUtc);
                return date.getFullYear().toString() === filters.year;
            });
        }

        // Sort by date descending
        filtered.sort((a, b) => new Date(b.timestampUtc) - new Date(a.timestampUtc));

        setFilteredFuel(filtered);

        // Calculate totals
        const cost = filtered.reduce((acc, f) => acc + (Number(f.totalValue) || 0), 0);
        const liters = filtered.reduce((acc, f) => acc + (Number(f.liters) || 0), 0);
        const count = filtered.length;
        
        // Weighted averages for accuracy
        const totalKmForEfficiency = filtered.filter(f => (Number(f.totalKilometers) || 0) > 0).reduce((acc, f) => acc + (Number(f.totalKilometers) || 0), 0);
        const totalLitersForEfficiency = filtered.filter(f => (Number(f.totalKilometers) || 0) > 0).reduce((acc, f) => acc + (Number(f.liters) || 0), 0);
        
        const avgKmPerLiter = totalLitersForEfficiency > 0 ? totalKmForEfficiency / totalLitersForEfficiency : 0;
        const avgPricePerKm = totalKmForEfficiency > 0 ? (filtered.filter(f => (Number(f.totalKilometers) || 0) > 0).reduce((acc, f) => acc + (Number(f.totalValue) || 0), 0) / totalKmForEfficiency) : 0;
        const avgPrice = liters > 0 ? cost / liters : 0;

        setTotals({
            cost,
            liters,
            count,
            avgPrice,
            avgKmPerLiter,
            avgPricePerKm
        });
    };

    const [includeReceipts, setIncludeReceipts] = useState(false);

    const handleDownloadPDF = async () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(37, 99, 235);
        doc.text('Fuel Analytics Report', 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        
        let filterText = [];
        if (filters.carId) {
            const car = cars.find(c => c.ID === filters.carId);
            filterText.push(`Car: ${car ? (car.DESCRIPTION || car.LICENSE_PLATE) : filters.carId}`);
        }
        if (filters.year) filterText.push(`Year: ${filters.year}`);
        
        if (filterText.length > 0) {
            doc.text(`Filters: ${filterText.join(' | ')}`, 14, 36);
        }
        
        // Summary box
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 42, 182, 35, 'F');
        
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.setFont(undefined, 'bold');
        doc.text('Summary Metrics', 20, 50);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Total Cost: $${totals.cost.toFixed(2)}`, 20, 58);
        doc.text(`Total Liters: ${totals.liters.toFixed(2)} L`, 20, 64);
        doc.text(`Total Entries: ${totals.count}`, 20, 70);
        
        doc.text(`Avg. Price/L: $${totals.avgPrice.toFixed(2)}`, 110, 58);
        doc.text(`Avg. Efficiency: ${totals.avgKmPerLiter.toFixed(2)} km/L`, 110, 64);
        doc.text(`Avg. Cost/km: $${totals.avgPricePerKm.toFixed(3)}`, 110, 70);

        // Table
        const tableData = filteredFuel.map(f => [
            new Date(f.timestampUtc).toLocaleDateString(),
            f.carDescription || f.carLicensePlate || 'N/A',
            `${Number(f.liters || 0).toFixed(2)} L`,
            `$${Number(f.totalValue || 0).toFixed(2)}`,
            f.totalKilometers ? `${Number(f.kilometerPerLiter || 0).toFixed(2)} km/L` : '-',
            `$${f.pricePerKilometer ? Number(f.pricePerKilometer).toFixed(3) : '-'}`
        ]);

        autoTable(doc, {
            startY: 85,
            head: [['Date', 'Car', 'Liters', 'Total', 'Efficiency', 'Price / Km']],
            body: tableData,
            headStyles: { fillColor: [37, 99, 235] },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            styles: { fontSize: 9 },
            foot: [[
                'TOTAL', '', `${totals.liters.toFixed(2)} L`, `$${totals.cost.toFixed(2)}`, 
                `${totals.avgKmPerLiter.toFixed(2)} km/L`, `$${totals.avgPricePerKm.toFixed(3)}`
            ]],
            footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
        });

        // Add receipts if requested
        if (includeReceipts) {
            const fuelWithReceipts = filteredFuel.filter(f => f.hasReceipt);
            for (const fuel of fuelWithReceipts) {
                try {
                    const imgRes = await fetch(`/api/user/fuel/${fuel.id}/receipt`);
                    if (imgRes.ok) {
                        const blob = await imgRes.blob();
                        const base64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        
                        
                        doc.addPage();
                        doc.setFontSize(14);
                        doc.setTextColor(30, 41, 59);
                        doc.text(`Receipt: ${new Date(fuel.timestampUtc).toLocaleDateString()} - ${fuel.carDescription || fuel.carLicensePlate}`, 14, 20);
                        doc.text(`Amount: $${Number(fuel.totalValue).toFixed(2)} | Liters: ${Number(fuel.liters).toFixed(2)}L`, 14, 28);
                        
                        // Add image - detect format or fallback to JPEG
                        const imgFormat = blob.type.includes('png') ? 'PNG' : (blob.type.includes('webp') ? 'WEBP' : 'JPEG');
                        doc.addImage(base64, imgFormat, 14, 40, 180, 240, undefined, 'FAST');
                    }
                } catch (err) {
                    console.error('Failed to add receipt to PDF:', err);
                }
            }
        }

        doc.save(`Fuel_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Fuel Analytics</h1>
                        <p className="mt-2 text-lg text-gray-500">Track fuel consumption, expenses, and efficiency trends.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
                        <label className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
                            <input 
                                type="checkbox" 
                                checked={includeReceipts} 
                                onChange={(e) => setIncludeReceipts(e.target.checked)}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-bold text-gray-600">Include Base Images</span>
                        </label>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={filteredFuel.length === 0}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 active:scale-95 whitespace-nowrap"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download PDF
                        </button>
                    </div>
                </header>

                {/* Filters */}
                <div className="bg-white shadow-sm rounded-2xl p-6 border border-gray-100 mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Car Filter</label>
                            <select
                                value={filters.carId}
                                onChange={(e) => setFilters(prev => ({ ...prev, carId: e.target.value }))}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all hover:bg-white"
                            >
                                <option value="">All Cars</option>
                                {cars.map(car => (
                                    <option key={car.ID} value={car.ID}>{car.DESCRIPTION || car.LICENSE_PLATE || `Car #${car.ID}`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Year</label>
                            <select
                                value={filters.year}
                                onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 transition-all hover:bg-white"
                            >
                                <option value="">Any Year</option>
                                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={() => {
                                setFilters({ carId: '', year: '' });
                                fetchFuel();
                            }}
                            className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>

                {/* Summary Totals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Total Cost</p>
                        <p className="text-3xl font-black text-blue-900 font-mono">${totals.cost.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-500">
                        <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Total Liters</p>
                        <p className="text-3xl font-black text-emerald-900 font-mono">{totals.liters.toFixed(2)}L</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
                        <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Avg Efficiency</p>
                        <p className="text-3xl font-black text-amber-900 font-mono">{totals.avgKmPerLiter.toFixed(2)}<span className="text-sm font-bold ml-1">km/L</span></p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-indigo-500">
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Fuel Entries</p>
                        <p className="text-3xl font-black text-indigo-900 font-mono">{totals.count}</p>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Date</th>
                                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Car</th>
                                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Liters</th>
                                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Total</th>
                                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Efficiency</th>
                                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Price / Km</th>
                                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Receipt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading logs...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredFuel.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-20 text-center">
                                            <p className="text-gray-400 font-medium italic">No fuel entries found for the selected filters.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredFuel.map((fuel) => (
                                        <tr key={fuel.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {new Date(fuel.timestampUtc).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-800">{fuel.carDescription || 'Unknown Car'}</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{fuel.carLicensePlate || 'NO-PLATE'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 font-mono text-sm text-gray-600">{Number(fuel.liters || 0).toFixed(2)} L</td>
                                            <td className="px-6 py-5 font-mono text-sm font-bold text-emerald-600">${Number(fuel.totalValue || 0).toFixed(2)}</td>
                                            <td className="px-6 py-5">
                                                {fuel.totalKilometers ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-amber-600 font-mono">{Number(fuel.kilometerPerLiter || 0).toFixed(2)} <span className="text-[10px]">km/L</span></span>
                                                        <span className="text-[10px] text-gray-400">Dist: {fuel.totalKilometers}km</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 font-mono text-sm text-gray-600">${fuel.pricePerKilometer ? Number(fuel.pricePerKilometer).toFixed(3) : '-'}</td>
                                            <td className="px-6 py-5">
                                                {fuel.hasReceipt ? (
                                                    <button
                                                        onClick={() => setSelectedReceipt(fuel.id)}
                                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                                                        title="View Receipt"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-300 italic">No receipt</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Receipt Modal */}
            {selectedReceipt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSelectedReceipt(null)}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Fuel Receipt</h3>
                            <button onClick={() => setSelectedReceipt(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 bg-gray-50 flex items-center justify-center min-h-[400px]">
                            <img 
                                src={`/api/user/fuel/${selectedReceipt}/receipt`} 
                                alt="Fuel Receipt" 
                                className="max-w-full max-h-[70vh] rounded-xl shadow-lg border border-gray-200 object-contain"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "https://placehold.co/400x600?text=Receipt+Not+Found";
                                }}
                            />
                        </div>
                        <div className="p-6 bg-white flex justify-end gap-3">
                            <a 
                                href={`/api/user/fuel/${selectedReceipt}/receipt`} 
                                download={`Receipt_${selectedReceipt}.jpg`}
                                className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                Download
                            </a>
                            <button 
                                onClick={() => setSelectedReceipt(null)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
