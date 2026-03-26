import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';
type AppLanguage = 'en' | 'de';

interface SystemConfig {
  currency: Currency;
  defaultLanguage: AppLanguage;
}

interface CompanyProfileData {
  name: string;
  legalType: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  taxId: string;
  vatId: string;
  phone: string;
  email: string;
  logoPath: string | null;
}

interface SettingsResponse {
  system: SystemConfig;
  company: CompanyProfileData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'EUR', label: 'EUR — €' },
  { value: 'USD', label: 'USD — $' },
  { value: 'GBP', label: 'GBP — £' },
  { value: 'CHF', label: 'CHF — Fr' },
];

const inputCls =
  'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

// ─── System Tab ───────────────────────────────────────────────────────────────

function SystemTab({ data }: { data: SystemConfig }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [savedMsg, setSavedMsg] = useState(false);

  const mutation = useMutation({
    mutationFn: (patch: Partial<SystemConfig>) => api.patch('/settings/system', patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    },
  });

  async function handleCurrencyChange(currency: Currency) {
    mutation.mutate({ currency });
  }

  async function handleLanguageChange(lang: AppLanguage) {
    mutation.mutate({ defaultLanguage: lang });
    await i18n.changeLanguage(lang);
  }

  return (
    <div className="space-y-6 max-w-sm">
      <h3 className="text-base font-semibold text-gray-900">{t('settings.system.title')}</h3>

      <div>
        <label htmlFor="currency-select" className="block text-sm font-medium text-gray-700 mb-1">
          {t('settings.system.currency')}
        </label>
        <select
          id="currency-select"
          className={inputCls}
          defaultValue={data.currency}
          onChange={(e) => void handleCurrencyChange(e.target.value as Currency)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-1">
          {t('settings.system.language')}
        </label>
        <select
          id="language-select"
          className={inputCls}
          defaultValue={data.defaultLanguage}
          onChange={(e) => void handleLanguageChange(e.target.value as AppLanguage)}
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </div>

      {savedMsg && <p className="text-sm text-green-600">{t('settings.system.saved')}</p>}
      {mutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
    </div>
  );
}

// ─── Company Profile Tab ──────────────────────────────────────────────────────

function CompanyTab({ data }: { data: CompanyProfileData }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    data.logoPath ? `/api/settings/company/logo` : null,
  );

  const { register, handleSubmit } = useForm<CompanyProfileData>({
    defaultValues: {
      name: data.name,
      legalType: data.legalType,
      street: data.street,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country,
      taxId: data.taxId,
      vatId: data.vatId,
      phone: data.phone,
      email: data.email,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: Partial<CompanyProfileData>) => api.patch('/settings/company', values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/settings/company/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    logoMutation.mutate(file);
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit((d) => saveMutation.mutate(d))(e)}
      className="space-y-5 max-w-lg"
    >
      <h3 className="text-base font-semibold text-gray-900">{t('settings.company.title')}</h3>

      {/* Logo */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{t('settings.company.logo')}</p>
        {logoPreview && (
          <img
            src={logoPreview}
            alt="Company logo"
            className="h-16 mb-2 object-contain border border-gray-200 rounded p-1"
          />
        )}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            loading={logoMutation.isPending}
          >
            {t('settings.company.logo')}
          </Button>
          <span className="text-xs text-gray-500">{t('settings.company.logoHint')}</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          data-testid="logo-input"
          onChange={onFileChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="cp-name" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.name')}
          </label>
          <input id="cp-name" type="text" className={inputCls} {...register('name')} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="cp-legal" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.legalType')}
          </label>
          <input
            id="cp-legal"
            type="text"
            className={inputCls}
            placeholder={t('settings.company.legalTypePlaceholder')}
            {...register('legalType')}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="cp-street" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.street')}
          </label>
          <input id="cp-street" type="text" className={inputCls} {...register('street')} />
        </div>
        <div>
          <label htmlFor="cp-city" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.city')}
          </label>
          <input id="cp-city" type="text" className={inputCls} {...register('city')} />
        </div>
        <div>
          <label htmlFor="cp-postal" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.postalCode')}
          </label>
          <input id="cp-postal" type="text" className={inputCls} {...register('postalCode')} />
        </div>
        <div>
          <label htmlFor="cp-country" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.country')}
          </label>
          <input id="cp-country" type="text" className={inputCls} {...register('country')} />
        </div>
        <div>
          <label htmlFor="cp-taxid" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.taxId')}
          </label>
          <input id="cp-taxid" type="text" className={inputCls} {...register('taxId')} />
        </div>
        <div>
          <label htmlFor="cp-vatid" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.vatId')}
          </label>
          <input id="cp-vatid" type="text" className={inputCls} {...register('vatId')} />
        </div>
        <div>
          <label htmlFor="cp-phone" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.phone')}
          </label>
          <input id="cp-phone" type="text" className={inputCls} {...register('phone')} />
        </div>
        <div>
          <label htmlFor="cp-email" className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.company.email')}
          </label>
          <input id="cp-email" type="email" className={inputCls} {...register('email')} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" loading={saveMutation.isPending}>
          {t('settings.company.save')}
        </Button>
        {savedMsg && <p className="text-sm text-green-600">{t('settings.company.saved')}</p>}
        {saveMutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'system' | 'company';

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('system');

  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsResponse>('/settings').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (user?.role !== 'ADMIN') {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-sm text-red-600">{t('settings.accessDenied')}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        <h2 className="text-xl font-semibold text-gray-900">{t('settings.title')}</h2>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-1">
            {(['system', 'company'] as TabKey[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                {t(`settings.tabs.${tab}`)}
              </button>
            ))}
          </nav>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {!isLoading && data && (
          <>
            {activeTab === 'system' && <SystemTab data={data.system} />}
            {activeTab === 'company' && <CompanyTab data={data.company} />}
          </>
        )}
      </div>
    </AppShell>
  );
}
