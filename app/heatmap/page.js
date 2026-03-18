'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from '@/lib/i18n/LanguageContext';

const HeatMapLoading = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100">
      <p className="text-xl text-gray-500">{t('sessions.loadingHeatMap')}</p>
    </div>
  );
};

const HeatMapContainer = dynamic(() => import('@/components/HeatMapContainer'), {
  ssr: false,
  loading: () => <HeatMapLoading />,
});

export default function Home() {
  return <HeatMapContainer />;
}
