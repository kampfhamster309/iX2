import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  status: string;
}

export function PropertiesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<{ data: Property[]; total: number }>('/properties').then((r) => r.data),
  });

  return (
    <AppShell>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('nav.properties')}</h2>
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
      {data && data.data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {t('properties.empty')}
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.data.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{p.address}</p>
              <p className="text-sm text-gray-500">{p.city}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
