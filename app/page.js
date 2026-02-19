'use client';

import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('@/components/MapContainer'), {
  ssr: false,
  loading: () => <div className="w-full h-screen flex items-center justify-center bg-gray-100"><p className="text-xl text-gray-500">Loading Map...</p></div>,
});

export default function Home() {
  return <MapContainer />;
}
