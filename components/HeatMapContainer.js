'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseUTC } from '@/lib/gpsUtils';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function HeatMapContainer({ initialFilters = null, isModal = false }) {
  const { t } = useTranslation();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const heatLayer = useRef(null);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(initialFilters?.deviceId || '');
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

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

    // Initialize leaflet.heat with window.L
    window.L = L;
    require('leaflet.heat');

    setMapLoaded(true);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false); // Reset loaded state
      }
    };
  }, []); // Only run on mount

  const updateHeatMap = () => {
    if (!map.current || !mapLoaded) return;

    // Clear existing heat layer
    if (heatLayer.current) {
      heatLayer.current.remove();
      heatLayer.current = null;
    }

    if (locations.length === 0) return;

    const bounds = L.latLngBounds();

    const heatPoints = locations.map(loc => {
      bounds.extend([loc.lat, loc.lng]);
      return [loc.lat, loc.lng, 1]; // lat, lng, intensity
    });

    heatLayer.current = L.heatLayer(heatPoints, {
      radius: 20,
      blur: 15,
      maxZoom: 17,
    }).addTo(map.current);

    if (locations.length > 1) {
      map.current.fitBounds(bounds, { padding: [50, 50] });
    } else if (locations.length === 1) {
      map.current.setView([locations[0].lat, locations[0].lng], 13);
    }
  };

  useEffect(() => {
    updateHeatMap();
  }, [locations, mapLoaded]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 pb-8">
      <div className={`${isModal ? 'max-w-full px-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'} py-8`}>

        {/* Filter Section */}
        {!isModal && (
          <div className="bg-white dark:bg-slate-900 shadow-lg rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-200 mb-4">
              {t('mapContainer.heatMapTitle')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {t('mapContainer.subtitle')}
            </p>

            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                  {t('mapContainer.device')}
                </label>
                <select
                  value={selectedDevice}
                  onChange={(e) => {
                    setSelectedDevice(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-200 dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 transition-all hover:bg-white dark:bg-slate-900 hover:border-blue-400"
                >
                  <option value="">{t('mapContainer.allDevices')}</option>
                  {devices.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.id} {device.description ? `- ${device.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                  {t('mapContainer.startDate')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="startDate"
                    type="date"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 bg-gray-200 dark:bg-slate-700/50 transition-all hover:bg-white dark:bg-slate-900 hover:border-blue-400"
                  />
                  <input
                    id="startHour"
                    type="number"
                    min="0"
                    max="23"
                    placeholder={t('common.placeholders.hour')}
                    className="w-24 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 text-center text-lg bg-gray-200 dark:bg-slate-700/50 transition-all hover:bg-white dark:bg-slate-900 hover:border-blue-400"
                  />
                  <input
                    id="startMinute"
                    type="number"
                    min="0"
                    max="59"
                    placeholder={t('common.placeholders.minute')}
                    className="w-24 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 text-center text-lg bg-gray-200 dark:bg-slate-700/50 transition-all hover:bg-white dark:bg-slate-900 hover:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                  {t('mapContainer.endDate')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="endDate"
                    type="date"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 bg-gray-200 dark:bg-slate-700/50 transition-all hover:bg-white dark:bg-slate-900 hover:border-blue-400"
                  />
                  <input
                    id="endHour"
                    type="number"
                    min="0"
                    max="23"
                    placeholder={t('common.placeholders.hour')}
                    className="w-24 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 text-center text-lg bg-gray-200 dark:bg-slate-700/50 transition-all hover:bg-white dark:bg-slate-900 hover:border-blue-400"
                  />
                  <input
                    id="endMinute"
                    type="number"
                    min="0"
                    max="59"
                    placeholder={t('common.placeholders.minute')}
                    className="w-24 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 text-center text-lg bg-gray-200 dark:bg-slate-700/50 transition-all hover:bg-white dark:bg-slate-900 hover:border-blue-400"
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
                  {loading ? t('mapContainer.loading') : t('mapContainer.filter')}
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
                  {t('mapContainer.reset')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Bar */}
        {locations.length > 0 && (
          <div className={`${isModal ? 'bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-6 py-4 mb-0' : 'mt-4 mb-4 text-sm text-gray-600 dark:text-slate-400'}`}>
            <div className={`flex flex-col md:flex-row ${isModal ? 'md:items-center md:justify-between' : 'gap-2'}`}>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className={`${isModal ? 'text-sm' : ''} text-gray-600 dark:text-slate-400`}>
                  <span dangerouslySetInnerHTML={{ __html: t('mapContainer.showing_plural', { count: locations.length }) }}></span>
                  {selectedDevice && !isModal && t('mapContainer.from_device', { deviceId: selectedDevice })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Map Section */}
        <div className="bg-white dark:bg-slate-900 shadow-lg rounded-lg overflow-hidden">
          <div
            ref={mapContainer}
            className="w-full h-screen bg-gray-200 dark:bg-slate-700"
            style={{ minHeight: '600px' }}
          >
            {!mapLoaded && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 dark:text-slate-400 text-lg">{t('mapContainer.loadingHeatMap')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
