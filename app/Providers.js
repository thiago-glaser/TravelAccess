'use client';

import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export default function Providers({ children }) {
  return (
    <LanguageProvider>
      {children}
    </LanguageProvider>
  );
}
