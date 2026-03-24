import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enCore, deCore } from '@ix2/i18n';

const savedLang = localStorage.getItem('ix2-language') ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { core: enCore },
    de: { core: deCore },
  },
  lng: savedLang,
  fallbackLng: 'en',
  defaultNS: 'core',
  interpolation: { escapeValue: false },
});

export default i18n;
