'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from '@/lib/i18n/LanguageContext';

const MapLoading = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-800">
      <p className="text-xl text-gray-500 dark:text-slate-400">{t('sessions.loadingMap')}</p>
    </div>
  );
};

const MapContainer = dynamic(() => import('@/components/MapContainer'), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default function Home() {
  return <MapContainer />;
}
