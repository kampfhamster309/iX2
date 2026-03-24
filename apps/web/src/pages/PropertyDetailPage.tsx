import { useTranslation } from 'react-i18next';
import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export function PropertyDetailPage() {
  const { t } = useTranslation();
  const { propertyId } = useParams({ strict: false }) as { propertyId: string };
  const { data, isLoading } = useQuery({
    queryKey: ['properties', propertyId],
    queryFn: () => api.get(`/properties/${propertyId}`).then((r) => r.data),
    enabled: !!propertyId,
  });

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          ← {t('common.back')}
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">{data?.name ?? '...'}</h2>
      </div>
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{data.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">
              {data.address}, {data.city} {data.postalCode}
            </p>
            <p className="text-sm text-gray-500">{data.country}</p>
            <span className="inline-block text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              {data.status}
            </span>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
