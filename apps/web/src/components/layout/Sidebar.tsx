import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from '@/components/ui/Button';

const NAV_ITEMS = [
  { key: 'nav.dashboard', path: '/dashboard', icon: '🏠' },
  { key: 'nav.properties', path: '/properties', icon: '🏢' },
  { key: 'nav.tenants', path: '/tenants', icon: '👥' },
  { key: 'nav.contracts', path: '/contracts', icon: '📄' },
  { key: 'nav.accounting', path: '/accounting/accounts', icon: '💰' },
  { key: 'nav.maintenance', path: '/maintenance', icon: '🔧' },
];

const ACCOUNTING_SUB_ITEMS = [
  { key: 'nav.accounts', path: '/accounting/accounts' },
  { key: 'nav.invoicesNav', path: '/accounting/invoices' },
  { key: 'nav.expenses', path: '/accounting/expenses' },
  { key: 'nav.deposits', path: '/accounting/deposits' },
  { key: 'nav.reports', path: '/accounting/reports' },
  { key: 'nav.journalEntries', path: '/accounting/journal-entries' },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-primary-400">iX2</h1>
        <p className="text-xs text-gray-400 mt-1">{t('app.name')}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <div key={item.path}>
            <Link
              to={item.path}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors [&.active]:bg-primary-700 [&.active]:text-white"
            >
              <span>{item.icon}</span>
              <span>{t(item.key)}</span>
            </Link>
            {item.path === '/accounting/accounts' && (
              <div className="ml-6 mt-0.5 space-y-0.5">
                {ACCOUNTING_SUB_ITEMS.map((sub) => (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    className="flex items-center px-3 py-1.5 rounded-md text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors [&.active]:text-white [&.active]:font-medium"
                  >
                    {t(sub.key)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700 space-y-2">
        {user?.role === 'ADMIN' && (
          <>
            <Link
              to="/admin/users"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors [&.active]:text-white [&.active]:font-medium"
            >
              👤 {t('nav.users')}
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors [&.active]:text-white [&.active]:font-medium"
            >
              ⚙ {t('nav.settings')}
            </Link>
          </>
        )}
        <Link
          to="/profile"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors [&.active]:text-white [&.active]:font-medium"
        >
          {t('nav.profile')}
        </Link>
        <p className="text-xs text-gray-400 truncate">
          {user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : ''}
        </p>
        <p className="text-xs text-gray-500">{user?.role}</p>
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
            className="text-gray-400 hover:text-white"
          >
            {t('auth.logout')}
          </Button>
        </div>
      </div>
    </aside>
  );
}
