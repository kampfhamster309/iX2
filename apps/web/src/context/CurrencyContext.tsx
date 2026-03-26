import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'Fr',
};

interface CurrencyContextValue {
  currency: Currency;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'EUR',
  symbol: '€',
});

interface SettingsResponse {
  system: { currency: Currency; defaultLanguage: string };
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery<SettingsResponse>({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsResponse>('/settings').then((r) => r.data),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const currency: Currency = data?.system?.currency ?? 'EUR';
  const symbol = CURRENCY_SYMBOLS[currency] ?? '€';

  return (
    <CurrencyContext.Provider value={{ currency, symbol }}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
