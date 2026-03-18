'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from './locales/en.json';
import ptBr from './locales/pt-br.json';

const translations = {
  en: en,
  'pt-br': ptBr,
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    // Get language from cookie
    const savedLocale = document.cookie
      .split('; ')
      .find((row) => row.startsWith('preferred_language='))
      ?.split('=')[1];

    if (savedLocale && translations[savedLocale]) {
      setLocale(savedLocale);
    } else {
      // Default to browser language if available and supported
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('pt')) {
        setLocale('pt-br');
      } else {
        setLocale('en');
      }
    }
  }, []);

  const changeLanguage = (newLocale) => {
    if (translations[newLocale]) {
      setLocale(newLocale);
      // Set cookie for persistence (session-based)
      document.cookie = `preferred_language=${newLocale}; path=/; SameSite=Lax`;
    }
  };

  const t = (path) => {
    const keys = path.split('.');
    let value = translations[locale];
    for (const key of keys) {
      if (!value || !value[key]) return path; // Return key if translation is missing
      value = value[key];
    }
    return value;
  };

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
