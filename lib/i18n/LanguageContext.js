'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from './locales/en.json';
import ptBr from './locales/pt-br.json';

const translations = {
  en: en,
  'pt-br': ptBr,
};

const supportedLanguages = [
  { code: 'en', name: 'English', flag: 'https://flagcdn.com/w40/us.png' },
  { code: 'pt-br', name: 'Português', flag: 'https://flagcdn.com/w40/br.png' },
];

// Provide a safe default so destructuring never crashes before the Provider mounts.
// This is the root cause of the "Cannot destructure property 'auth' of undefined" error
// on Android WebView, where the initial render may run before the Provider tree is ready.
const defaultContextValue = {
  locale: 'en',
  changeLanguage: () => {},
  t: (path) => path,
  languages: supportedLanguages,
};

const LanguageContext = createContext(defaultContextValue);

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

  const t = (path, replacements = {}) => {
    const keys = path.split('.');
    let value = translations[locale];
    for (const key of keys) {
      // Prevent prototype pollution by rejecting dangerous keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return path;
      }
      if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key)) return path; // Return key if translation is missing
      value = value[key];
    }
    
    // Replace placeholders like {{key}} with values from the replacements object
    if (typeof value === 'string') {
      return Object.keys(replacements).reduce((acc, key) => {
        return acc.split(`{{${key}}}`).join(String(replacements[key]));
      }, value);
    }
    
    return value;
  };

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, t, languages: supportedLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  // If somehow context is still undefined (component outside Provider tree),
  // return the safe default instead of throwing to prevent WebView crashes.
  if (context === undefined) {
    return defaultContextValue;
  }
  return context;
}
