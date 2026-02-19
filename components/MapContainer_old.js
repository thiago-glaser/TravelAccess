'use client';

import { useEffect, useRef, useState } from 'react';

export default function MapContainer() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  const updateMarkers = () => {
    if (!map.current || !googleLoaded) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.setMap(null));
    markers.current = [];

    if (locations.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    locations.forEach((location, index) => {
      const position = {
        lat: location.lat,
        lng: location.lng,
      };

      const marker = new window.google.maps.Marker({
        position,
        map: map.current,
        title: location.name || `Location ${index + 1}`,
        label: String(index + 1),
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="p-3 text-sm">
            <h3 class="font-bold text-gray-900">${location.name || 'Location'}</h3>
            <p class="text-gray-600 text-xs">Date: ${new Date(location.date).toLocaleDateString()}</p>
            <p class="text-gray-600 text-xs">Latitude: ${location.lat.toFixed(4)}</p>
            <p class="text-gray-600 text-xs">Longitude: ${location.lng.toFixed(4)}</p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        markers.current.forEach(m => {
          if (m.infoWindow) {
            m.infoWindow.close();
          }
        });
        infoWindow.open(map.current, marker);
      });

      marker.infoWindow = infoWindow;
      markers.current.push(marker);
      bounds.extend(position);
    });

    if (locations.length > 1) {
      map.current.fitBounds(bounds);
    } else if (locations.length === 1) {
      map.current.setCenter(markers.current[0].getPosition());
      map.current.setZoom(13);
    }
  };

  // Initialize map when Google loads
  useEffect(() => {
    if (!googleLoaded || !mapContainer.current) return;

    if (!map.current) {
      map.current = new window.google.maps.Map(mapContainer.current, {
        zoom: 10,
        center: { lat: 40.7128, lng: -74.006 },
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
      });
    }

    updateMarkers();
  }, [googleLoaded]);

  // Update markers when locations change
  useEffect(() => {
    updateMarkers();
  }, [locations]);

  const handleFilter = async (startDate, endDate) => {
    setLoading(true);
    try {
      let url = `/api/gps-data?startDate=${startDate}&endDate=${endDate}`;
      if (selectedDevice) {
        url += `&deviceId=${selectedDevice}`;
      }
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setLocations(result.data);
        if (result.devices) {
          setDevices(result.devices);
        }
      } else {
        console.error('Error fetching data:', result.error);
        alert('Error fetching GPS data: ' + result.error);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      alert('Error fetching GPS data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setLocations([]);
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
  };

  // Load Google Maps script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google) {
      setGoogleLoaded(true);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found in environment variables');
      alert('Google Maps API key is not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local');
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('Google Maps API loaded');
      setGoogleLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      alert('Failed to load Google Maps API. Check your API key.');
    };
    document.head.appendChild(script);
  }, []);

  // Load initial data on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    setTimeout(() => {
      const startInput = document.getElementById('startDate');
      const endInput = document.getElementById('endDate');
      
      if (startInput) startInput.value = thirtyDaysAgo;
      if (endInput) endInput.value = today;

      handleFilter(thirtyDaysAgo, today);
    }, 100);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Travel Access GPS Tracker
        </h1>

        {/* Filter Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Filter GPS Data by Date and Device
          </h2>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Device
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => {
                  setSelectedDevice(e.target.value);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                id="startDate"
                type="date"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const start = document.getElementById('startDate')?.value;
                  const end = document.getElementById('endDate')?.value;
                  if (start && end) {
                    handleFilter(start, end);
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
                  const startInput = document.getElementById('startDate');
                  const endInput = document.getElementById('endDate');
                  if (startInput) startInput.value = '';
                  if (endInput) endInput.value = '';
                  
                  // Reload devices
                  try {
                    const response = await fetch('/api/gps-data?startDate=2000-01-01&endDate=2100-12-31');
                    const result = await response.json();
                    if (result.devices) {
                      setDevices(result.devices);
                    }
                  } catch (error) {
                    console.error('Error loading devices:', error);
                  }
                }}
                className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium"
              >
                Reset
              </button>
            </div>
          </div>

          {locations.length > 0 && (
            <p className="mt-4 text-sm text-gray-600">
              Found <span className="font-bold text-blue-600">{locations.length}</span> GPS location(s)
              {selectedDevice && ` from device ${selectedDevice}`}
            </p>
          )}
        </div>

        {/* Map Section */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div
            ref={mapContainer}
            className="w-full h-screen bg-gray-200"
            style={{ minHeight: '600px' }}
          >
            {!googleLoaded && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-lg">Loading map...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
