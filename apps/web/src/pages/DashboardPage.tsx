import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <AppShell>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('nav.dashboard')}</h2>
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.welcome', { name: user?.email })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">{t('dashboard.intro')}</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
