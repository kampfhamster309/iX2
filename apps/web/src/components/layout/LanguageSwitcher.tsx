import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  function toggle() {
    const next = i18n.language === 'en' ? 'de' : 'en';
    void i18n.changeLanguage(next);
    localStorage.setItem('ix2-language', next);
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label="Switch language">
      {i18n.language === 'en' ? 'DE' : 'EN'}
    </Button>
  );
}
