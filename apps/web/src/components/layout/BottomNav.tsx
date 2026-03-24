import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

const BOTTOM_NAV_ITEMS = [
  { key: 'nav.dashboard', path: '/dashboard', icon: '🏠' },
  { key: 'nav.properties', path: '/properties', icon: '🏢' },
  { key: 'nav.tenants', path: '/tenants', icon: '👥' },
  { key: 'nav.contracts', path: '/contracts', icon: '📄' },
];

export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      {BOTTOM_NAV_ITEMS.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className="flex-1 flex flex-col items-center justify-center py-2 text-xs text-gray-500 hover:text-primary-600 [&.active]:text-primary-600"
        >
          <span className="text-lg">{item.icon}</span>
          <span className="mt-0.5">{t(item.key)}</span>
        </Link>
      ))}
    </nav>
  );
}
