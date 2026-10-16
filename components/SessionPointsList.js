'use client';

import { useState, useEffect } from 'react';
import { filterLocationsByDistance, processLocations, parseUTC } from '@/lib/gpsUtils';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function SessionPointsList({ session }) {
    const { t, locale } = useTranslation();
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [aiDescription, setAiDescription] = useState(session.aiDescription || null);

    // Sync or fetch AI description
    useEffect(() => {
        if (session.aiDescription) {
            setAiDescription(session.aiDescription);
        } else if (session.id) {
            fetch(`/api/sessions/${session.id}/ai-description`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.description) {
                        setAiDescription(data.description);
                    }
                })
                .catch(() => {});
        }
    }, [session.id, session.aiDescription]);

    useEffect(() => {
        let isMounted = true;

        async function fetchPoints() {
            if (!session.startTime || !session.deviceId) {
                setLoading(false);
                return;
            }

            try {
                // Ensure proper UTC ISO format
                const startObj = parseUTC(session.startTime);
                const start = startObj ? startObj.toISOString() : new Date().toISOString();

                let end = new Date().toISOString();
                if (session.endTime) {
                    const endObj = parseUTC(session.endTime);
                    if (endObj) end = endObj.toISOString();
                }

                // Format the API parameters
                const startDateStr = start.split('T')[0];
                const startTimeStr = start.split('T')[1].substring(0, 8);
                const endDateStr = end.split('T')[0];
                const endTimeStr = end.split('T')[1].substring(0, 8);

                const url = `/api/gps-data?startDate=${startDateStr}T${startTimeStr}&endDate=${endDateStr}T${endTimeStr}&deviceId=${session.deviceId}`;

                const response = await fetch(url);
                const result = await response.json();

                if (result.success && isMounted) {
                    const sortedLocations = [...result.data].sort((a, b) => {
                        return new Date(a.date).getTime() - new Date(b.date).getTime();
                    });

                    // Apply the 10 meters rule requested by the user
                    const filteredLocations = filterLocationsByDistance(sortedLocations, 10);

                    // Process them to calculate speed, incremental distance, incremental time
                    const processedData = processLocations(filteredLocations);
                    setLocations(processedData);
                } else if (isMounted) {
                    setError(result.error || 'Failed to fetch points');
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.message || 'Error fetching locations');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchPoints();

        return () => {
            isMounted = false;
        };
    }, [session.id, session.startTime, session.endTime, session.deviceId]);

    if (loading) {
        return <div className="p-4 text-center text-gray-500 text-sm">{t('sessionPointsList.loading')}</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-500 text-sm">{t('sessionPointsList.error', { error })}</div>;
    }

    return (
        <div className="bg-white p-4 overflow-x-auto border-t border-gray-100 space-y-4">
            {/* AI Trip Resume Card */}
            <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 border border-indigo-100 rounded-xl p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white shadow-xs">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </span>
                    <h4 className="font-semibold text-indigo-950 text-sm flex items-center gap-1.5">
                        {t('sessionPointsList.aiSummaryTitle')}
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            Gemini
                        </span>
                    </h4>
                </div>

                {aiDescription ? (
                    <div className="mt-2 text-xs text-gray-700 whitespace-pre-line leading-relaxed bg-white/90 p-3 rounded-lg border border-indigo-50 shadow-2xs">
                        {aiDescription}
                    </div>
                ) : (
                    <p className="mt-1 text-xs text-gray-500 italic">
                        {t('sessionPointsList.noAiDescription')}
                    </p>
                )}
            </div>

            {/* GPS Telemetry Points Table */}
            {locations.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">{t('sessionPointsList.noPoints')}</div>
            ) : (
                <div>
                    <h4 className="font-bold text-gray-800 mb-3 text-sm">{t('sessionPointsList.title', { count: locations.length })}</h4>
                    <div className="max-h-80 overflow-y-auto rounded border border-gray-200">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="px-3 py-2 font-semibold text-gray-500">{t('sessionPointsList.headers.dateTime')}</th>
                                    <th className="px-3 py-2 font-semibold text-gray-500">{t('sessionPointsList.headers.latitude')}</th>
                                    <th className="px-3 py-2 font-semibold text-gray-500">{t('sessionPointsList.headers.longitude')}</th>
                                    <th className="px-3 py-2 font-semibold text-gray-500">{t('sessionPointsList.headers.altitude')}</th>
                                    <th className="px-3 py-2 font-semibold text-gray-500" title={t('sessionPointsList.headers.totalDistTitle')}>{t('sessionPointsList.headers.totalDist')}</th>
                                    <th className="px-3 py-2 font-semibold text-gray-500" title={t('sessionPointsList.headers.totalTimeTitle')}>{t('sessionPointsList.headers.totalTime')}</th>
                                    <th className="px-3 py-2 font-semibold text-gray-500">{t('sessionPointsList.headers.speed')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {locations.map((loc, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                            {loc.localDate.toLocaleDateString(locale)} {loc.localDate.toLocaleTimeString(locale)}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{loc.lat.toFixed(6)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{loc.lng.toFixed(6)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{loc.altitude != null ? loc.altitude.toFixed(1) : '-'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{loc.cumulativeDistanceKm.toFixed(2)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 font-mono text-xs">{loc.formattedCumulativeTime}</td>
                                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{loc.speedKmH.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
