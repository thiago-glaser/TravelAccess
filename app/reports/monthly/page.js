'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTranslation } from '@/lib/i18n/LanguageContext';

// Haversine formula for distance calculation (reused from MapContainer)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const filterLocationsByDistance = (locations, minDistance = 10) => {
    if (locations.length <= 1) return locations;
    const filtered = [locations[0]];
    for (let i = 1; i < locations.length; i++) {
        const lastFiltered = filtered[filtered.length - 1];
        const distance = calculateDistance(
            lastFiltered.lat,
            lastFiltered.lng,
            locations[i].lat,
            locations[i].lng
        );
        if (distance >= minDistance) {
            filtered.push(locations[i]);
        }
    }
    return filtered;
};

const calculateTotalDistance = (locations) => {
    if (locations.length <= 1) return 0;
    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
        const distance = calculateDistance(
            locations[i - 1].lat,
            locations[i - 1].lng,
            locations[i].lat,
            locations[i].lng
        );
        totalDistance += distance;
    }
    return totalDistance;
};

export default function MonthlyReportsPage() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState(null);
    const [cars, setCars] = useState([]);
    const [fuelData, setFuelData] = useState([]);
    const [insuranceData, setInsuranceData] = useState([]);
    const [filters, setFilters] = useState({ carId: '', year: new Date().getFullYear().toString(), type: '' });
    const [reportData, setReportData] = useState([]);
    const [totals, setTotals] = useState({
        distance: 0,
        duration: 0,
        count: 0,
        cost: 0,
        insurance: 0,
        personalInsurance: 0,
        businessInsurance: 0,
        breakdown: {
            P: { distance: 0, duration: 0, cost: 0 },
            B: { distance: 0, duration: 0, cost: 0 }
        }
    });
    const [userProfile, setUserProfile] = useState(null);
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
        try {
            const response = await fetch('/api/user/fuel');
            const result = await response.json();
            if (result.success) {
                setFuelData(result.fuel);
            }
        } catch (err) {
            console.error('Failed to fetch fuel:', err);
        }
    };

    const fetchInsurance = async () => {
        try {
            const response = await fetch('/api/user/insurance');
            const result = await response.json();
            if (result.success) {
                setInsuranceData(result.insurances);
            }
        } catch (err) {
            console.error('Failed to fetch insurance:', err);
        }
    };

    useEffect(() => {
        fetchCars();
        fetchFuel();
        fetchInsurance();
    }, []);

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
            return null;
        }
    };

    const formatDuration = (hours) => {
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        const s = Math.floor(((hours - h) * 60 - m) * 60);
        return `${h}h ${m}m ${s}s`;
    };

    const generateReport = async () => {
        setLoading(true);
        setError(null);
        setProgress({ current: 0, total: 0 });

        try {
            let sessionUrl = `/api/sessions?page=1&limit=10000`;
            if (filters.carId) sessionUrl += `&carId=${filters.carId}`;
            if (filters.year) sessionUrl += `&year=${filters.year}`;
            if (filters.type) sessionUrl += `&type=${filters.type}`;
            sessionUrl += `&tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

            const sResponse = await fetch(sessionUrl);
            const sResult = await sResponse.json();

            if (!sResult.success) throw new Error(sResult.error || 'Failed to fetch sessions');

            const sessionsList = sResult.data;
            if (sessionsList.length === 0) {
                setReportData([]);
                setTotals({ 
                    distance: 0, 
                    duration: 0, 
                    count: 0, 
                    cost: 0, 
                    insurance: 0, 
                    personalInsurance: 0, 
                    businessInsurance: 0, 
                    breakdown: { P: { distance: 0, duration: 0, cost: 0 }, B: { distance: 0, duration: 0, cost: 0 } } 
                });
                setLoading(false);
                return;
            }

            setProgress({ current: 0, total: sessionsList.length });

            const batchSize = 5;
            const processed = [];

            for (let i = 0; i < sessionsList.length; i += batchSize) {
                const batch = sessionsList.slice(i, i + batchSize);
                const batchResults = await Promise.all(batch.map(async (session) => {
                    try {
                        const start = parseUTC(session.startTime);
                        const end = parseUTC(session.endTime) || new Date();

                        let distanceKm = Number(session.distance) || 0;
                        let durationHours = Number(session.timeTraveled) || 0;
                        let sessionCost = Number(session.cost) || 0;
                        let valueConfirmed = session.valueConfirmed || 'N';
                        let isProjected = valueConfirmed === 'N';

                        // Only fetch GPS data if we don't have valid distance/time already
                        if (distanceKm <= 0 || durationHours <= 0) {
                            let startStr = session.startTime || '';
                            if (startStr.endsWith('Z')) startStr = startStr.substring(0, startStr.length - 1);

                            let endStr = '';
                            if (session.endTime) {
                                endStr = session.endTime;
                                if (endStr.endsWith('Z')) endStr = endStr.substring(0, endStr.length - 1);
                            } else {
                                endStr = end.toISOString().split('.')[0];
                            }

                            const locUrl = `/api/gps-data?startDate=${startStr}&endDate=${endStr}&deviceId=${session.deviceId}`;
                            const lResponse = await fetch(locUrl);
                            const lResult = await lResponse.json();

                            if (!lResult.success) return { ...session, distanceKm: 0, durationHours: 0, error: true };
                            if (!start) return { ...session, distanceKm: 0, durationHours: 0, cost: 0, error: true };

                            const sessionLocations = (lResult.data || [])
                                .map(l => ({ ...l, timestamp: new Date(l.date).getTime() }))
                                .sort((a, b) => a.timestamp - b.timestamp);

                            const filteredLocs = filterLocationsByDistance(sessionLocations, 10);
                            const distanceMeters = calculateTotalDistance(filteredLocs);
                            const durationMs = end.getTime() - start.getTime();
                            
                            distanceKm = distanceMeters / 1000;
                            durationHours = durationMs / (1000 * 60 * 60);

                            // Junk session filtering
                            if (distanceMeters < 1 && durationMs < 1000) {
                                return { ...session, distanceKm: 0, durationHours: 0, cost: 0, isEmpty: true };
                            }
                        }

                        // Re-evaluate cost if not confirmed or if we just recalculated distance
                        if (valueConfirmed === 'N' || session.distance === null || session.distance <= 0) {
                            let sessionPricePerKm = 0;
                            const carFuelLogs = fuelData.filter(f => f.carId === session.carId).sort((a, b) => {
                                const aTime = a.timestampUtc.endsWith('Z') ? a.timestampUtc : a.timestampUtc + 'Z';
                                const bTime = b.timestampUtc.endsWith('Z') ? b.timestampUtc : b.timestampUtc + 'Z';
                                return new Date(aTime).getTime() - new Date(bTime).getTime();
                            });
                            
                            if (carFuelLogs.length > 0) {
                                const validLogs = carFuelLogs.filter(f => parseFloat(f.pricePerKilometer) > 0);
                                const applicableLog = carFuelLogs.find(f => {
                                    const fTimeStr = f.timestampUtc.endsWith('Z') ? f.timestampUtc : f.timestampUtc + 'Z';
                                    return new Date(fTimeStr).getTime() >= end.getTime();
                                });

                                if (applicableLog && parseFloat(applicableLog.pricePerKilometer) > 0) {
                                    sessionPricePerKm = parseFloat(applicableLog.pricePerKilometer);
                                    isProjected = false;
                                    valueConfirmed = 'Y';
                                } else if (validLogs.length > 0) {
                                    isProjected = true;
                                    if (!applicableLog) sessionPricePerKm = parseFloat(validLogs[validLogs.length - 1].pricePerKilometer);
                                    else sessionPricePerKm = parseFloat(validLogs[0].pricePerKilometer);
                                    valueConfirmed = 'N';
                                }
                            }
                            sessionCost = distanceKm * sessionPricePerKm;

                            // Save results back to DB if they've changed and session is finished
                            if (session.endTime && !userProfile?.isDemo) {
                                fetch('/api/sessions', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        id: session.id,
                                        cost: sessionCost,
                                        distance: distanceKm,
                                        timeTraveled: durationHours,
                                        valueConfirmed: valueConfirmed
                                    })
                                }).catch(err => console.error('Failed to save session metrics:', err));
                            }
                        }

                        return {
                            ...session,
                            distanceKm,
                            durationHours,
                            cost: sessionCost,
                            valueConfirmed,
                            isProjected
                        };
                    } catch (err) {
                        console.error('Error processing session:', session.id, err);
                        return { ...session, distanceKm: 0, durationHours: 0, cost: 0, error: true };
                    }
                }));

                processed.push(...batchResults.filter(r => !r.isEmpty));
                setProgress(prev => ({ ...prev, current: Math.min(prev.total, i + batchSize) }));
            }

            // Group by Month, Car, Type
            const monthlyAgg = {};
            processed.forEach(s => {
                const date = parseUTC(s.startTime);
                if (!date) return;
                
                // Format month as YYYY-MM
                const y = date.getFullYear();
                const m = (date.getMonth() + 1).toString().padStart(2, '0');
                const monthStr = `${y}-${m}`;
                const mName = date.toLocaleString(locale, { month: 'long', year: 'numeric' });
                
                const typeStr = s.type === 'P' ? 'P' : s.type === 'B' ? 'B' : 'O';
                const key = `${monthStr}_${s.carId}_${typeStr}`;

                if (!monthlyAgg[key]) {
                    monthlyAgg[key] = {
                        monthSort: monthStr,
                        monthDisplay: mName,
                        carId: s.carId,
                        carDesc: s.description || 'Unknown',
                        type: typeStr,
                        distanceKm: 0,
                        durationHours: 0,
                        cost: 0,
                        count: 0,
                        hasProjected: false
                    };
                }

                monthlyAgg[key].distanceKm += s.distanceKm;
                monthlyAgg[key].durationHours += s.durationHours;
                monthlyAgg[key].cost += (s.cost || 0);
                monthlyAgg[key].count += 1;
                if (s.valueConfirmed === 'N') monthlyAgg[key].hasProjected = true;
            });

            const groupedData = Object.values(monthlyAgg).sort((a, b) => {
                if (a.monthSort !== b.monthSort) return a.monthSort.localeCompare(b.monthSort);
                if (a.carDesc !== b.carDesc) return a.carDesc.localeCompare(b.carDesc);
                return a.type.localeCompare(b.type);
            });

            const totalDist = groupedData.reduce((sum, s) => sum + s.distanceKm, 0);
            const totalDur = groupedData.reduce((sum, s) => sum + s.durationHours, 0);
            const totalCost = groupedData.reduce((sum, s) => sum + s.cost, 0);
            const totalCount = processed.length;

            const breakdown = {
                P: { distance: 0, duration: 0, cost: 0 },
                B: { distance: 0, duration: 0, cost: 0 }
            };

            let insuranceTotal = 0;
            const reportMonthNames = Array.from(new Set(groupedData.map(s => s.monthDisplay)));
            insuranceData.forEach(ins => {
                let matchesCar = filters.carId ? ins.carId === filters.carId : true;
                let matchesMonth = false;
                
                if (filters.year) {
                    matchesMonth = ins.period.includes(filters.year.toString());
                } else {
                    matchesMonth = reportMonthNames.includes(ins.period);
                }
                
                if (matchesCar && matchesMonth) {
                    insuranceTotal += parseFloat(ins.amount || 0);
                }
            });

            groupedData.forEach(s => {
                const typeKey = s.type === 'P' || s.type === 'B' ? s.type : null;
                if (typeKey) {
                    breakdown[typeKey].distance += s.distanceKm;
                    breakdown[typeKey].duration += s.durationHours;
                    breakdown[typeKey].cost += s.cost;
                }
            });

            const pInsurance = totalDist > 0 ? insuranceTotal * (breakdown.P.distance / totalDist) : 0;
            const bInsurance = totalDist > 0 ? insuranceTotal * (breakdown.B.distance / totalDist) : 0;

            setReportData(groupedData);
            setTotals({ 
                distance: totalDist, 
                duration: totalDur, 
                count: totalCount, 
                cost: totalCost, 
                insurance: insuranceTotal, 
                personalInsurance: pInsurance,
                businessInsurance: bInsurance,
                breakdown 
            });

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const handleDownloadPDF = () => {
        if (reportData.length === 0) return;

        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59);
        doc.text(t('reports.pdfOutput.monthlyTitle'), 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(t('reports.pdfOutput.generatedOn', { date: new Date().toLocaleString(locale) }), 14, 30);
        
        let filterText = [];
        if (filters.carId) {
            const car = cars.find(c => c.ID.toString() === filters.carId.toString());
            filterText.push(`${t('reports.car')}: ${car ? (car.DESCRIPTION || car.LICENSE_PLATE) : filters.carId}`);
        }
        if (filters.year) filterText.push(`${t('reports.year')}: ${filters.year}`);
        if (filters.type) filterText.push(`${t('reports.type')}: ${filters.type === 'P' ? t('reports.personal') : t('reports.business')}`);
        
        if (filterText.length > 0) {
            doc.text(`${t('reports.pdfOutput.filters', { filters: filterText.join(' | ') })}`, 14, 36);
        }
        
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(t('reports.pdfOutput.summary'), 14, 46);
        
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);

        doc.text(`${t('reports.totalDistance')}: ${totals.distance.toFixed(2)} km`, 14, 54);
        doc.text(`${t('reports.totalDuration')}: ${formatDuration(totals.duration)}`, 14, 60);
        doc.text(`${t('reports.totalSessions')}: ${totals.count}`, 14, 66);
        doc.text(`${t('reports.totalCost')}: $${totals.cost.toFixed(2)}`, 14, 72);

        doc.text(t('reports.personal'), 80, 54);
        doc.text(`${t('reports.table.distance')}: ${totals.breakdown.P.distance.toFixed(2)} km`, 80, 60);
        doc.text(`${t('reports.table.duration')}: ${formatDuration(totals.breakdown.P.duration)}`, 80, 66);
        doc.text(`${t('reports.table.estCost')}: $${totals.breakdown.P.cost.toFixed(2)}`, 80, 72);
        const pInsurance = totals.distance > 0 ? totals.insurance * (totals.breakdown.P.distance / totals.distance) : 0;
        doc.text(`${t('reports.insurance')}: $${pInsurance.toFixed(2)}`, 80, 78);

        doc.text(t('reports.business'), 140, 54);
        doc.text(`${t('reports.table.distance')}: ${totals.breakdown.B.distance.toFixed(2)} km`, 140, 60);
        doc.text(`${t('reports.table.duration')}: ${formatDuration(totals.breakdown.B.duration)}`, 140, 66);
        doc.text(`${t('reports.table.estCost')}: $${totals.breakdown.B.cost.toFixed(2)}`, 140, 72);
        const bInsurance = totals.distance > 0 ? totals.insurance * (totals.breakdown.B.distance / totals.distance) : 0;
        doc.text(`${t('reports.insurance')}: $${bInsurance.toFixed(2)}`, 140, 78);
        
        doc.text(`${t('reports.totalInsurance')}: $${totals.insurance.toFixed(2)}`, 14, 78);

        const tableData = reportData.map(s => [
            s.monthDisplay,
            s.carDesc,
            s.type === 'P' ? t('reports.personal') : s.type === 'B' ? t('reports.business') : t('reports.other'),
            s.count.toString(),
            `${s.distanceKm.toFixed(2)} km`,
            formatDuration(s.durationHours),
            `$${s.cost.toFixed(2)}${s.hasProjected ? '*' : ''}`
        ]);

        tableData.push([
            t('reports.table.grandTotal'), '', '', '', 
            `${totals.distance.toFixed(2)} km`, 
            formatDuration(totals.duration), 
            `$${totals.cost.toFixed(2)}`
        ]);

        if (totals.insurance > 0) {
            tableData.push([
                t('reports.propPersonalInsurance'), '', '', '', '', '', 
                `$${totals.personalInsurance.toFixed(2)}`
            ]);
            tableData.push([
                t('reports.propBusinessInsurance'), '', '', '', '', '', 
                `$${totals.businessInsurance.toFixed(2)}`
            ]);
        }

        autoTable(doc, {
            startY: 88,
            head: [[t('reports.month'), t('reports.car'), t('reports.type'), t('reports.table.sessions'), t('reports.table.distance'), t('reports.table.duration'), t('reports.table.estCost')]],
            body: tableData,
            headStyles: { fillColor: [37, 99, 235] },
            styles: { fontSize: 9 },
            didParseCell: function(data) {
                const footerRows = totals.insurance > 0 ? 3 : 1;
                if (data.row.index >= tableData.length - footerRows) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [241, 245, 249];
                    data.cell.styles.textColor = [15, 23, 42];
                }
            }
        });
        
        const hasProjected = reportData.some(s => s.hasProjected);
        if (hasProjected) {
            const tableEnd = doc.lastAutoTable.finalY || 80;
            doc.setFontSize(8);
            doc.setTextColor(245, 158, 11);
            doc.text(t('reports.pdfOutput.disclaimer'), 14, tableEnd + 8);
        }

        doc.save(`Monthly_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            {t('reports.monthlyTitle')}
                        </h1>
                        <p className="mt-2 text-lg text-gray-600">
                            {t('reports.monthlySubtitle')}
                        </p>
                    </div>
                </header>

                <div className="bg-white shadow-md rounded-xl p-4 mb-6 border border-gray-100">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">{t('reports.car')}</label>
                            <select
                                value={filters.carId}
                                onChange={(e) => setFilters(prev => ({ ...prev, carId: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">{t('reports.allCars')}</option>
                                {cars.map(car => (
                                    <option key={car.ID} value={car.ID}>{car.DESCRIPTION || car.LICENSE_PLATE || `${t('reports.car')} #${car.ID}`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">{t('reports.year')}</label>
                            <select
                                value={filters.year}
                                onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">{t('common.anyYear')}</option>
                                {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="w-40">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">{t('reports.type')}</label>
                            <select
                                value={filters.type}
                                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-200/50 border border-gray-300 rounded-lg text-sm text-gray-900 transition-all hover:bg-white hover:border-blue-400"
                            >
                                <option value="">{t('reports.allTypes')}</option>
                                <option value="P">{t('reports.personalOnly')}</option>
                                <option value="B">{t('reports.businessOnly')}</option>
                            </select>
                        </div>
                        <div className="flex items-end self-end pb-0.5 gap-2">
                            <button
                                onClick={generateReport}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 min-w-[140px]"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        {t('reports.processing')}
                                    </span>
                                ) : t('reports.generateBtn')}
                            </button>
                            <button
                                onClick={() => {
                                    setFilters({ carId: '', year: '', type: '' });
                                    setReportData([]);
                                    setTotals({
                                        distance: 0, duration: 0, count: 0, cost: 0, insurance: 0,
                                        breakdown: { P: { distance: 0, duration: 0, cost: 0 }, B: { distance: 0, duration: 0, cost: 0 } }
                                    });
                                }}
                                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                {t('reports.reset')}
                            </button>
                            {reportData.length > 0 && (
                                <button
                                    onClick={handleDownloadPDF}
                                    className="px-4 py-2 text-sm font-semibold text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-600 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                                    title="Download Report as PDF"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {t('reports.pdf')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {loading && progress.total > 0 && (
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2">
                            <span>{t('reports.processingSessions')}</span>
                            <span>{progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>
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

                {reportData.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('reports.totalDistance')}</p>
                            <p className="text-3xl font-black text-blue-600 font-mono">{totals.distance.toFixed(2)} <span className="text-sm">KM</span></p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('reports.totalDuration')}</p>
                            <p className="text-3xl font-black text-green-600 font-mono">{formatDuration(totals.duration)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('reports.totalSessions')}</p>
                            <p className="text-3xl font-black text-purple-600 font-mono">{totals.count}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-500">
                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">{t('reports.totalCost')}</p>
                            <p className="text-3xl font-black text-emerald-600 font-mono">${totals.cost.toFixed(2)}</p>
                            {(reportData.some(s => s.hasProjected) || totals.insurance > 0) && (
                                <p className="text-[10px] text-amber-500 font-semibold mt-1 flex items-center gap-1">
                                    <span>⚠</span> {t('reports.dynamicPricingWarning')}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {reportData.length > 0 && totals.insurance > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-indigo-500">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">{t('reports.personalInsurance')}</p>
                                    <p className="text-3xl font-black text-indigo-600 font-mono">${totals.personalInsurance.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">{t('reports.propAllocation')}</p>
                                    <p className="text-sm font-bold text-gray-600">{totals.distance > 0 ? Math.round((totals.breakdown.P.distance / totals.distance) * 100) : 0}%</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-pink-500">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-pink-500 uppercase tracking-widest mb-1">{t('reports.businessInsurance')}</p>
                                    <p className="text-3xl font-black text-pink-600 font-mono">${totals.businessInsurance.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">{t('reports.propAllocation')}</p>
                                    <p className="text-sm font-bold text-gray-600">{totals.distance > 0 ? Math.round((totals.breakdown.B.distance / totals.distance) * 100) : 0}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {reportData.length > 0 && !filters.type && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-400">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('reports.breakdownTitle')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 font-medium">{t('reports.distDist')}</span>
                                    <span className="text-gray-400 font-mono text-xs italic">{t('common.total')}: {totals.distance.toFixed(1)} km</span>
                                </div>
                                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="bg-blue-500 h-full transition-all duration-500"
                                        style={{ width: `${totals.distance > 0 ? (totals.breakdown.P.distance / totals.distance) * 100 : 0}%` }}
                                        title={`${t('reports.personal')}: ${totals.breakdown.P.distance.toFixed(1)} km`}
                                    ></div>
                                    <div
                                        className="bg-yellow-500 h-full transition-all duration-500"
                                        style={{ width: `${totals.distance > 0 ? (totals.breakdown.B.distance / totals.distance) * 100 : 0}%` }}
                                        title={`${t('reports.business')}: ${totals.breakdown.B.distance.toFixed(1)} km`}
                                    ></div>
                                </div>
                                <div className="flex gap-4 mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">{t('reports.personal')} ({totals.distance > 0 ? Math.round((totals.breakdown.P.distance / totals.distance) * 100) : 0}%)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">{t('reports.business')} ({totals.distance > 0 ? Math.round((totals.breakdown.B.distance / totals.distance) * 100) : 0}%)</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 font-medium">{t('reports.timeDist')}</span>
                                    <span className="text-gray-400 font-mono text-xs italic">{t('common.total')}: {Math.round(totals.duration)}h</span>
                                </div>
                                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="bg-blue-400 h-full transition-all duration-500"
                                        style={{ width: `${totals.duration > 0 ? (totals.breakdown.P.duration / totals.duration) * 100 : 0}%` }}
                                        title={`${t('reports.personal')}: ${formatDuration(totals.breakdown.P.duration)}`}
                                    ></div>
                                    <div
                                        className="bg-yellow-400 h-full transition-all duration-500"
                                        style={{ width: `${totals.duration > 0 ? (totals.breakdown.B.duration / totals.duration) * 100 : 0}%` }}
                                        title={`${t('reports.business')}: ${formatDuration(totals.breakdown.B.duration)}`}
                                    ></div>
                                </div>
                                <div className="flex gap-4 mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-blue-400 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">{t('reports.personal')} ({totals.duration > 0 ? Math.round((totals.breakdown.P.duration / totals.duration) * 100) : 0}%)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">{t('reports.business')} ({totals.duration > 0 ? Math.round((totals.breakdown.B.duration / totals.duration) * 100) : 0}%)</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 font-medium">{t('reports.costDist')}</span>
                                    <span className="text-gray-400 font-mono text-xs italic">{t('common.total')}: ${totals.cost.toFixed(2)}</span>
                                </div>
                                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="bg-emerald-500 h-full transition-all duration-500"
                                        style={{ width: `${totals.cost > 0 ? (totals.breakdown.P.cost / totals.cost) * 100 : 0}%` }}
                                        title={`${t('reports.personal')}: $${totals.breakdown.P.cost.toFixed(2)}`}
                                    ></div>
                                    <div
                                        className="bg-orange-500 h-full transition-all duration-500"
                                        style={{ width: `${totals.cost > 0 ? (totals.breakdown.B.cost / totals.cost) * 100 : 0}%` }}
                                        title={`${t('reports.business')}: $${totals.breakdown.B.cost.toFixed(2)}`}
                                    ></div>
                                </div>
                                <div className="flex gap-4 mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">{t('reports.personal')} (${totals.breakdown.P.cost.toFixed(2)})</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">{t('reports.business')} (${totals.breakdown.B.cost.toFixed(2)})</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 font-medium">{t('reports.insuranceAllocation')}</span>
                                    <span className="text-gray-400 font-mono text-xs italic">{t('common.total')}: ${totals.insurance.toFixed(2)}</span>
                                </div>
                                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="bg-indigo-500 h-full transition-all duration-500"
                                        style={{ width: `${totals.distance > 0 ? (totals.breakdown.P.distance / totals.distance) * 100 : 0}%` }}
                                        title={`${t('reports.personal')}: $${(totals.insurance * (totals.distance > 0 ? totals.breakdown.P.distance / totals.distance : 0)).toFixed(2)}`}
                                    ></div>
                                    <div
                                        className="bg-pink-500 h-full transition-all duration-500"
                                        style={{ width: `${totals.distance > 0 ? (totals.breakdown.B.distance / totals.distance) * 100 : 0}%` }}
                                        title={`${t('reports.business')}: $${(totals.insurance * (totals.distance > 0 ? totals.breakdown.B.distance / totals.distance : 0)).toFixed(2)}`}
                                    ></div>
                                </div>
                                <div className="flex gap-4 mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">{t('reports.personal')} (${(totals.insurance * (totals.distance > 0 ? totals.breakdown.P.distance / totals.distance : 0)).toFixed(2)})</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-pink-500 rounded-sm"></div>
                                        <span className="text-xs text-gray-600">{t('reports.business')} (${(totals.insurance * (totals.distance > 0 ? totals.breakdown.B.distance / totals.distance : 0)).toFixed(2)})</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('reports.month')}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('reports.car')}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('reports.type')}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">{t('reports.table.sessions')}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">{t('reports.table.distance')}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">{t('reports.table.duration')}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">{t('reports.table.estCost')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {reportData.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-20 text-center text-gray-400 italic">
                                            {loading ? t('reports.table.loadingMsg') : t('reports.table.noSessionsMsg')}
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {reportData.map((s) => (
                                            <tr key={`${s.monthSort}_${s.carId}_${s.type}`} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-900">{s.monthDisplay}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {s.carDesc}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${s.type === 'P' ? 'bg-blue-100 text-blue-700' : s.type === 'B' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {s.type === 'P' ? t('reports.personal') : s.type === 'B' ? t('reports.business') : t('reports.other')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-gray-600">
                                                    {s.count}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-blue-600">
                                                    {s.distanceKm.toFixed(2)} km
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-gray-600">
                                                    {formatDuration(s.durationHours)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                                                    <div>${s.cost.toFixed(2)}</div>
                                                    {s.hasProjected && (
                                                        <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5 text-amber-500">
                                                            ~ {t('reports.table.estimated')}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 font-black border-t-2 border-gray-200">
                                            <td colSpan="4" className="px-6 py-6 text-right text-gray-900 text-base uppercase tracking-widest">{t('reports.table.grandTotal')}</td>
                                            <td className="px-6 py-6 text-right text-xl text-blue-700 font-mono">
                                                {totals.distance.toFixed(2)} km
                                            </td>
                                            <td className="px-6 py-6 text-right text-lg text-green-700 font-mono">
                                                {formatDuration(totals.duration)}
                                            </td>
                                            <td className="px-6 py-6 text-right text-xl text-emerald-700 font-mono">
                                                ${totals.cost.toFixed(2)}
                                            </td>
                                        </tr>
                                        {totals.insurance > 0 && (
                                            <>
                                                <tr className="bg-white/50 border-t border-gray-100">
                                                    <td colSpan="4" className="px-6 py-3 text-right text-gray-400 text-xs font-bold uppercase tracking-wider">{t('reports.propPersonalInsurance')}</td>
                                                    <td colSpan="2" className="px-6 py-3 text-right text-gray-400 text-xs italic">
                                                        ({totals.distance > 0 ? Math.round((totals.breakdown.P.distance / totals.distance) * 100) : 0}% of ${totals.insurance.toFixed(2)})
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-indigo-600 font-mono font-bold">
                                                        ${totals.personalInsurance.toFixed(2)}
                                                    </td>
                                                </tr>
                                                <tr className="bg-white/50 border-t border-gray-100">
                                                    <td colSpan="4" className="px-6 py-3 text-right text-gray-400 text-xs font-bold uppercase tracking-wider">{t('reports.propBusinessInsurance')}</td>
                                                    <td colSpan="2" className="px-6 py-3 text-right text-gray-400 text-xs italic">
                                                        ({totals.distance > 0 ? Math.round((totals.breakdown.B.distance / totals.distance) * 100) : 0}% of ${totals.insurance.toFixed(2)})
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-pink-600 font-mono font-bold">
                                                        ${totals.businessInsurance.toFixed(2)}
                                                    </td>
                                                </tr>
                                            </>
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
