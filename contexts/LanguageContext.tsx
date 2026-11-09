import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, TranslationKey } from '../translations';

type TranslationParams = Record<string, string | number>;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  toggleLanguage: () => void;
}

function normalizeLanguage(value: unknown): Language {
  return value === 'sw' ? 'sw' : 'en';
}

function formatTranslation(lang: Language, key: TranslationKey, params?: TranslationParams): string {
  const dictionary = translations[lang] || translations.en;
  let template: string = dictionary[key] || translations.en[key] || key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }
  }
  return template;
}

const DEFAULT_CONTEXT: LanguageContextType = {
  language: 'en',
  setLanguage: () => undefined,
  t: (key, params) => formatTranslation('en', key, params),
  toggleLanguage: () => undefined,
};

const LanguageContext = createContext<LanguageContextType>(DEFAULT_CONTEXT);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        return normalizeLanguage(localStorage.getItem('tube_kenya_lang'));
      }
    } catch {
      // Fallback when storage is restricted
    }
    return 'en';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'sw' ? 'sw-KE' : 'en-KE';
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    const valid = normalizeLanguage(lang);
    setLanguageState(valid);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tube_kenya_lang', valid);
      }
    } catch {
      // Best-effort storage
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'sw' : 'en');
  };

  const t = (key: TranslationKey, params?: TranslationParams): string => {
    return formatTranslation(language, key, params);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
