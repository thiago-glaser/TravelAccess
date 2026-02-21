'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseUTC } from '@/lib/gpsUtils';

// Calculate distance between two points in meters using Haversine formula
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

// Filter locations to remove points closer than 10 meters apart
const filterLocationsByDistance = (locations, minDistance = 10) => {
  if (locations.length <= 1) return locations;

  const filtered = [locations[0]]; // Always keep the first point

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

// Calculate total distance traveled between consecutive points
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

// Calculate average speed for each point using surrounding points (2 before and 2 after)
const calculateAverageSpeed = (locations) => {
  console.log('calculateAverageSpeed called with', locations.length, 'locations');
  if (locations.length < 3) {
    console.log('Not enough points for speed calculation (need at least 3)');
    return []; // Need at least 3 points to calculate meaningful speed
  }

  const speeds = [];
  const windowSize = Math.min(2, Math.floor((locations.length - 1) / 2));

  for (let i = windowSize; i < locations.length - windowSize; i++) {
    const point1 = locations[i - windowSize];
    const point2 = locations[i + windowSize];

    // Calculate distance between point[i-windowSize] and point[i+windowSize]
    const distance = calculateDistance(
      point1.lat,
      point1.lng,
      point2.lat,
      point2.lng
    );

    // Calculate time difference in seconds
    const time1 = parseUTC(point1.date).getTime();
    const time2 = parseUTC(point2.date).getTime();
    const timeDiffSeconds = (time2 - time1) / 1000;

    // Calculate speed in km/h
    const speedKmH = timeDiffSeconds > 0 ? (distance / timeDiffSeconds) * 3.6 : 0;

    console.log(`Point ${i}: speed=${speedKmH.toFixed(2)} km/h, distance=${distance.toFixed(2)}m, time=${timeDiffSeconds.toFixed(2)}s`);

    // Use parseUTC to get local date
    const localDate = parseUTC(locations[i].date);

    speeds.push({
      index: i,
      speed: speedKmH,
      date: localDate,
      time: localDate.toLocaleTimeString(),
    });
  }

  console.log('Calculated speeds:', speeds.length, 'data points');
  return speeds;
};

export default function MapContainer({ initialFilters = null, isModal = false }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(initialFilters?.deviceId || '');
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [speedData, setSpeedData] = useState([]);
  const [altitudeData, setAltitudeData] = useState([]);


  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Create map centered on New York
    map.current = L.map(mapContainer.current).setView([40.7128, -74.006], 10);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    setMapLoaded(true);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false); // Reset loaded state
      }
    };
  }, []); // Only run on mount

  const updateMarkers = () => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    if (filteredLocations.length === 0) return;

    const bounds = L.latLngBounds();

    filteredLocations.forEach((location, index) => {
      const latlng = [location.lat, location.lng];

      // Create custom red marker icon
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: 8px;
            height: 8px;
            background-color: #ef4444;
            border: 1px solid #fff;
            border-radius: 50%;
            box-shadow: 0 0 0 1px #991b1b;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 4px;
          ">
          </div>
        `,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
        popupAnchor: [0, -4],
      });

      // Create marker with custom icon
      const marker = L.marker(latlng, {
        icon: customIcon,
        title: location.deviceId || `Location ${index + 1}`,
      }).addTo(map.current);

      const device = devices.find(d => d.id === location.deviceId);
      const deviceName = device ? device.description : location.deviceId;

      // Use correct UTC parsing to get local date
      const localDate = parseUTC(location.date);

      // Create popup content
      const popupContent = `
        <div style="font-size: 12px; min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
            ${deviceName}
          </h4>
          <p style="margin: 4px 0;">
            <strong>Date:</strong> ${localDate.toLocaleDateString()} ${localDate.toLocaleTimeString()}
          </p>
          <p style="margin: 4px 0;">
            <strong>Latitude:</strong> ${location.lat.toFixed(6)}
          </p>
          <p style="margin: 4px 0;">
            <strong>Longitude:</strong> ${location.lng.toFixed(6)}
          </p>
          <p style="margin: 4px 0;">
            <strong>Altitude:</strong> ${location.altitude ? location.altitude.toFixed(2) + ' m' : 'N/A'}
          </p>
        </div>
      `;

      marker.bindPopup(popupContent);
      markers.current.push(marker);
      bounds.extend(latlng);
    });

    // Fit map to show all markers
    if (filteredLocations.length > 1) {
      map.current.fitBounds(bounds, { padding: [50, 50] });
    } else if (filteredLocations.length === 1) {
      map.current.setView([filteredLocations[0].lat, filteredLocations[0].lng], 13);
    }
  };

  useEffect(() => {
    updateMarkers();
  }, [filteredLocations, mapLoaded]);

  // Filter locations when they change
  useEffect(() => {
    // Sort locations by date in ascending order (oldest first)
    const sortedLocations = [...locations].sort((a, b) => {
      return parseUTC(a.date).getTime() - parseUTC(b.date).getTime();
    });
    console.log('Sorted locations from', sortedLocations[0]?.date, 'to', sortedLocations[sortedLocations.length - 1]?.date);

    const filtered = filterLocationsByDistance(sortedLocations, 10);
    setFilteredLocations(filtered);
    // Calculate total distance traveled
    const distance = calculateTotalDistance(filtered);
    setTotalDistance(distance);
    // Calculate average speed for each point
    const speeds = calculateAverageSpeed(filtered);
    console.log('Setting speed data:', speeds);
    setSpeedData(speeds);

    // Process altitude data
    const altitudes = filtered.map((loc, i) => {
      const localDate = parseUTC(loc.date);

      return {
        index: i,
        altitude: loc.altitude || 0,
        date: localDate,
        time: localDate.toLocaleTimeString(),
      };
    });
    setAltitudeData(altitudes);

  }, [locations]);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      const result = await response.json();
      if (result.success) {
        setDevices(result.devices);
      } else {
        console.error('Error fetching devices:', result.error);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const handleFilter = async (filters) => {
    setLoading(true);
    try {
      // filters can be a single object or an array of objects
      const filterArray = Array.isArray(filters) ? filters : [filters];

      const allResults = await Promise.all(filterArray.map(async (f) => {
        const formatTime = (t) => t.split(':').length === 2 ? `${t}:00` : t;
        let url = `/api/gps-data?startDate=${f.startDate}T${formatTime(f.startTime)}&endDate=${f.endDate}T${formatTime(f.endTime)}`;
        const deviceToUse = f.deviceId || selectedDevice;
        if (deviceToUse) {
          url += `&deviceId=${deviceToUse}`;
        }
        const response = await fetch(url);
        return response.json();
      }));

      const combinedData = allResults
        .filter(r => r.success)
        .flatMap(r => r.data)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setLocations(combinedData);

      // Check for errors in any of the fetches
      const errors = allResults.filter(r => !r.success);
      if (errors.length > 0) {
        console.error('Errors fetching some data:', errors);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      if (!isModal) alert('Error fetching GPS data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialFilters) {
      handleFilter(initialFilters);
    }
  }, [initialFilters]);

  useEffect(() => {
    fetchDevices();

    const today = new Date().toISOString().split('T')[0];
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Set default values without triggering filter
    const startDateInput = document.getElementById('startDate');
    const startHourInput = document.getElementById('startHour');
    const startMinuteInput = document.getElementById('startMinute');
    const endDateInput = document.getElementById('endDate');
    const endHourInput = document.getElementById('endHour');
    const endMinuteInput = document.getElementById('endMinute');

    if (startDateInput) startDateInput.value = today;
    if (startHourInput) startHourInput.value = '0';
    if (startMinuteInput) startMinuteInput.value = '0';
    if (endDateInput) endDateInput.value = today;
    if (endHourInput) endHourInput.value = '23';
    if (endMinuteInput) endMinuteInput.value = '59';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className={`${isModal ? 'max-w-full px-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'} py-8`}>

        {/* Filter Section */}
        {!isModal && (
          <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Filter GPS Data by Date and Device
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Times shown are in your local timezone and will be converted to UTC for database queries
            </p>

            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Device
                </label>
                <select
                  value={selectedDevice}
                  onChange={(e) => {
                    setSelectedDevice(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-200/50 text-gray-900 transition-all hover:bg-white hover:border-blue-400"
                >
                  <option value="">All Devices</option>
                  {devices.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.id} {device.description ? `- ${device.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Start Date & Time
                </label>
                <div className="flex gap-2">
                  <input
                    id="startDate"
                    type="date"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-gray-200/50 transition-all hover:bg-white hover:border-blue-400"
                  />
                  <input
                    id="startHour"
                    type="number"
                    min="0"
                    max="23"
                    placeholder="HH"
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-center text-lg bg-gray-200/50 transition-all hover:bg-white hover:border-blue-400"
                  />
                  <input
                    id="startMinute"
                    type="number"
                    min="0"
                    max="59"
                    placeholder="MM"
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-center text-lg bg-gray-200/50 transition-all hover:bg-white hover:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  End Date & Time
                </label>
                <div className="flex gap-2">
                  <input
                    id="endDate"
                    type="date"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-gray-200/50 transition-all hover:bg-white hover:border-blue-400"
                  />
                  <input
                    id="endHour"
                    type="number"
                    min="0"
                    max="23"
                    placeholder="HH"
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-center text-lg bg-gray-200/50 transition-all hover:bg-white hover:border-blue-400"
                  />
                  <input
                    id="endMinute"
                    type="number"
                    min="0"
                    max="59"
                    placeholder="MM"
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-center text-lg bg-gray-200/50 transition-all hover:bg-white hover:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const startDateInput = document.getElementById('startDate')?.value;
                    const startHour = document.getElementById('startHour')?.value || '0';
                    const startMinute = document.getElementById('startMinute')?.value || '0';
                    const endDateInput = document.getElementById('endDate')?.value;
                    const endHour = document.getElementById('endHour')?.value || '0';
                    const endMinute = document.getElementById('endMinute')?.value || '0';

                    if (startDateInput && endDateInput) {
                      // Explicitly parse local date components
                      const [sYear, sMonth, sDay] = startDateInput.split('-').map(Number);
                      const [eYear, eMonth, eDay] = endDateInput.split('-').map(Number);

                      const startLocalDate = new Date(sYear, sMonth - 1, sDay, Number(startHour), Number(startMinute), 0);
                      const endLocalDate = new Date(eYear, eMonth - 1, eDay, Number(endHour), Number(endMinute), 0);

                      const startUtcString = startLocalDate.toISOString();
                      const endUtcString = endLocalDate.toISOString();

                      handleFilter([{
                        startDate: startUtcString.split('T')[0],
                        startTime: startUtcString.split('T')[1].substring(0, 8),
                        endDate: endUtcString.split('T')[0],
                        endTime: endUtcString.split('T')[1].substring(0, 8),
                        deviceId: selectedDevice
                      }]);
                    }
                  }}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                  {loading ? 'Loading...' : 'Filter'}
                </button>

                <button
                  onClick={async () => {
                    setSelectedDevice('');
                    setLocations([]);
                    const startDateInput = document.getElementById('startDate');
                    const startHourInput = document.getElementById('startHour');
                    const startMinuteInput = document.getElementById('startMinute');
                    const endDateInput = document.getElementById('endDate');
                    const endHourInput = document.getElementById('endHour');
                    const endMinuteInput = document.getElementById('endMinute');
                    if (startDateInput) startDateInput.value = '';
                    if (startHourInput) startHourInput.value = '';
                    if (startMinuteInput) startMinuteInput.value = '';
                    if (endDateInput) endDateInput.value = '';
                    if (endHourInput) endHourInput.value = '';
                    if (endMinuteInput) endMinuteInput.value = '';

                    // Reload devices
                    fetchDevices();
                  }}
                  className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Bar - Shown in both regular and modal modes if data exists */}
        {locations.length > 0 && (
          <div className={`${isModal ? 'bg-white border-b border-gray-100 px-6 py-4 mb-0' : 'mt-4 text-sm text-gray-600'}`}>
            <div className={`flex flex-col md:flex-row ${isModal ? 'md:items-center md:justify-between' : 'gap-2'}`}>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className={`${isModal ? 'text-sm' : ''} text-gray-600`}>
                  Found <span className="font-bold text-blue-600">{locations.length}</span> GPS location(s)
                  {filteredLocations.length < locations.length && (
                    <span className="text-gray-500"> (showing {filteredLocations.length} after filtering points within 10m)</span>
                  )}
                  {selectedDevice && !isModal && ` from device ${selectedDevice}`}
                </p>
              </div>

              {filteredLocations.length > 1 && (
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <p className={`${isModal ? 'text-sm' : ''} text-gray-600 font-medium`}>
                    <span className="text-gray-500 mr-1">Total Distance:</span>
                    <span className="text-green-700 font-bold">
                      {totalDistance >= 1000
                        ? (totalDistance / 1000).toFixed(2) + ' km'
                        : totalDistance.toFixed(2) + ' m'
                      }
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map Section */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div
            ref={mapContainer}
            className="w-full h-screen bg-gray-200"
            style={{ minHeight: '600px' }}
          >
            {!mapLoaded && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-lg">Loading map...</p>
              </div>
            )}
          </div>
        </div>

        {/* Speed Chart Section */}
        {console.log('Rendering speed chart, speedData.length:', speedData.length)}
        {speedData.length > 0 && (
          <div className="bg-white shadow-lg rounded-lg p-6 mt-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Average Speed Analysis</h2>
            <div className="w-full h-96 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <svg width="100%" height="100%" viewBox="0 0 800 360" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
                {(() => {
                  // Calculate max speed and round up to a nice number
                  const maxSpeed = Math.max(...speedData.map(d => d.speed));
                  const maxYAxis = Math.ceil(maxSpeed * 1.1 / 10) * 10; // Round up to nearest 10 with 10% padding
                  const yAxisSteps = 6;
                  const stepSize = maxYAxis / (yAxisSteps - 1);

                  return (
                    <>
                      {/* Y-axis */}
                      <line x1="50" y1="20" x2="50" y2="340" stroke="#ccc" strokeWidth="2" />
                      {/* X-axis */}
                      <line x1="50" y1="340" x2="780" y2="340" stroke="#ccc" strokeWidth="2" />

                      {/* Y-axis labels and gridlines */}
                      {Array.from({ length: yAxisSteps }, (_, i) => i * stepSize).map((speed) => {
                        const y = 340 - (speed / maxYAxis) * 320;
                        return (
                          <g key={`y-${speed}`}>
                            <line x1="45" y1={y} x2="780" y2={y} stroke="#f0f0f0" strokeWidth="1" />
                            <text x="40" y={y + 5} fontSize="12" fill="#666" textAnchor="end">
                              {speed.toFixed(0)} km/h
                            </text>
                          </g>
                        );
                      })}

                      {/* Speed bars */}
                      {speedData.map((data, idx) => {
                        const chartWidth = 730; // 780 - 50 (total width minus left margin)
                        const barWidth = Math.max(2, chartWidth / speedData.length - 1);
                        const x = 50 + (idx / speedData.length) * chartWidth;
                        const y = 340 - (data.speed / maxYAxis) * 320;
                        const height = 340 - y;
                        const color = data.speed > maxYAxis * 0.6 ? '#ef4444' : data.speed > maxYAxis * 0.3 ? '#f59e0b' : '#10b981';

                        return (
                          <g key={`bar-${idx}`}>
                            <title>Speed: {data.speed.toFixed(2)} km/h at {data.time}</title>
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={height}
                              fill={color}
                              opacity="0.7"
                            />
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Speed statistics */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Average Speed</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(speedData.reduce((sum, d) => sum + d.speed, 0) / speedData.length).toFixed(1)} km/h
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Min Speed</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.min(...speedData.map(d => d.speed)).toFixed(1)} km/h
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Max Speed</p>
                <p className="text-2xl font-bold text-red-600">
                  {Math.max(...speedData.map(d => d.speed)).toFixed(1)} km/h
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Data Points</p>
                <p className="text-2xl font-bold text-purple-600">
                  {speedData.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Altitude Chart Section */}
        {altitudeData.length > 0 && (
          <div className="bg-white shadow-lg rounded-lg p-6 mt-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Altitude Analysis</h2>
            <div className="w-full h-96 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <svg width="100%" height="100%" viewBox="0 0 800 360" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
                {(() => {
                  const maxAlt = Math.max(...altitudeData.map(d => d.altitude));
                  // Ensure minAlt captures negative altitudes if any, or 0 base
                  const minAlt = Math.min(...altitudeData.map(d => d.altitude));
                  // Create padding
                  const range = maxAlt - minAlt;
                  // If flat/zero altitude, handle gracefully
                  const effectiveRange = range === 0 ? 100 : range;

                  const maxYAxis = Math.ceil((maxAlt + effectiveRange * 0.1) / 10) * 10;
                  const minYAxis = Math.floor((minAlt - effectiveRange * 0.1) / 10) * 10;

                  const yAxisRange = maxYAxis - minYAxis;
                  const yAxisSteps = 6;
                  const stepSize = yAxisRange / (yAxisSteps - 1);

                  return (
                    <>
                      {/* Y-axis */}
                      <line x1="50" y1="20" x2="50" y2="340" stroke="#ccc" strokeWidth="2" />
                      {/* X-axis */}
                      <line x1="50" y1="340" x2="780" y2="340" stroke="#ccc" strokeWidth="2" />

                      {/* Y-axis labels and gridlines */}
                      {Array.from({ length: yAxisSteps }, (_, i) => minYAxis + i * stepSize).map((alt) => {
                        const y = 340 - ((alt - minYAxis) / yAxisRange) * 320;
                        return (
                          <g key={`y-${alt}`}>
                            <line x1="45" y1={y} x2="780" y2={y} stroke="#f0f0f0" strokeWidth="1" />
                            <text x="40" y={y + 5} fontSize="12" fill="#666" textAnchor="end">
                              {alt.toFixed(0)} m
                            </text>
                          </g>
                        );
                      })}

                      {/* Altitude bars */}
                      {altitudeData.map((data, idx) => {
                        const chartWidth = 730;
                        const barWidth = Math.max(2, chartWidth / altitudeData.length - 1);
                        const x = 50 + (idx / altitudeData.length) * chartWidth;
                        const y = 340 - ((data.altitude - minYAxis) / yAxisRange) * 320;
                        const height = 340 - y;
                        const color = '#3b82f6'; // Blue for altitude

                        return (
                          <g key={`bar-alt-${idx}`}>
                            <title>Altitude: {data.altitude.toFixed(2)} m at {data.time}</title>
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={height}
                              fill={color}
                              opacity="0.6"
                            />
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Altitude statistics */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Average Altitude</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(altitudeData.reduce((sum, d) => sum + d.altitude, 0) / altitudeData.length).toFixed(1)} m
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Min Altitude</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.min(...altitudeData.map(d => d.altitude)).toFixed(1)} m
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Max Altitude</p>
                <p className="text-2xl font-bold text-red-600">
                  {Math.max(...altitudeData.map(d => d.altitude)).toFixed(1)} m
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Data Points</p>
                <p className="text-2xl font-bold text-purple-600">
                  {altitudeData.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
