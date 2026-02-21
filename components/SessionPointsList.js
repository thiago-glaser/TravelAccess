'use client';

import { useState, useEffect } from 'react';
import { filterLocationsByDistance, processLocations, parseUTC } from '@/lib/gpsUtils';

export default function SessionPointsList({ session }) {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                    // Sort descending (newest first)? Actually the user wants to see sequential, maybe oldest first?
                    // Let's use oldest first as it makes sense for "incremental time and distance"
                    const sortedLocations = [...result.data].sort((a, b) => {
                        return new Date(a.date).getTime() - new Date(b.date).getTime();
                    });

                    // Apply the 10 meters rule requested by the user just like Map did
                    const filteredLocations = filterLocationsByDistance(sortedLocations, 10);

                    // Process them to calculate speed, incremental distance, incremental time
                    const processedData = processLocations(filteredLocations);
                    setLocations(processedData);
                } else if (isMounted) {
                    setError(result.error || 'Failed to fetch points');
                }
            } catch (err) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchPoints();

        return () => {
            isMounted = false;
        };
    }, [session.id, session.startTime, session.endTime, session.deviceId]);

    if (loading) {
        return <div className="p-4 text-center text-gray-500 text-sm">Loading points...</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-500 text-sm">Error: {error}</div>;
    }

    if (locations.length === 0) {
        return <div className="p-4 text-center text-gray-500 text-sm">No GPS data points found for this session.</div>;
    }

    return (
        <div className="bg-white p-4 overflow-x-auto border-t border-gray-100">
            <h4 className="font-bold text-gray-800 mb-3 text-sm">Session Data Points ({locations.length})</h4>
            <div className="max-h-80 overflow-y-auto rounded border border-gray-200">
                <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="px-3 py-2 font-semibold text-gray-500">Date/Time (Local)</th>
                            <th className="px-3 py-2 font-semibold text-gray-500">Latitude</th>
                            <th className="px-3 py-2 font-semibold text-gray-500">Longitude</th>
                            <th className="px-3 py-2 font-semibold text-gray-500">Altitude (m)</th>
                            <th className="px-3 py-2 font-semibold text-gray-500" title="Distance from start of session">Total Dist (km)</th>
                            <th className="px-3 py-2 font-semibold text-gray-500" title="Time elapsed since start of session">Total Time</th>
                            <th className="px-3 py-2 font-semibold text-gray-500">Speed (km/h)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {locations.map((loc, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                    {loc.localDate.toLocaleDateString()} {loc.localDate.toLocaleTimeString()}
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
    );
}
