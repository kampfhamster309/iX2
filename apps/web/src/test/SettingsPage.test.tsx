import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

const mockAuthUser = vi.hoisted(() => ({
  user: { id: '1', email: 'admin@ix2.local', role: 'ADMIN' },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockAuthUser }));

const mockApi = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

import i18n from '../i18n';
import { SettingsPage } from '@/pages/settings/SettingsPage';

const MOCK_SETTINGS = {
  system: { currency: 'EUR', defaultLanguage: 'en' },
  company: {
    name: 'Muster GmbH',
    legalType: 'GmbH',
    street: 'Musterstraße 1',
    city: 'München',
    postalCode: '80333',
    country: 'DE',
    taxId: 'DE123456789',
    vatId: 'DE987654321',
    phone: '+49 89 1234567',
    email: 'info@muster.de',
    logoPath: null,
  },
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('SettingsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthUser.user = { id: '1', email: 'admin@ix2.local', role: 'ADMIN' };
    await i18n.changeLanguage('en'); // reset after language-switching tests
    mockApi.get.mockResolvedValue({ data: MOCK_SETTINGS });
    mockApi.patch.mockResolvedValue({ data: MOCK_SETTINGS.system });
    mockApi.post.mockResolvedValue({
      data: { ...MOCK_SETTINGS.company, logoPath: 'logos/test.png' },
    });
  });

  it('renders the page title and both tabs', async () => {
    render(<SettingsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /company profile/i })).toBeInTheDocument();
  });

  it('shows access denied for non-ADMIN users', () => {
    mockAuthUser.user = { id: '2', email: 'tenant@ix2.local', role: 'TENANT' };
    render(<SettingsPage />, { wrapper });
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('renders system tab with currency and language selects', async () => {
    render(<SettingsPage />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText(/currency/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/default language/i)).toBeInTheDocument();
  });

  it('saves currency immediately on change', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText(/currency/i)).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/currency/i), 'USD');

    await waitFor(() =>
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/settings/system',
        expect.objectContaining({ currency: 'USD' }),
      ),
    );
  });

  it('saves language immediately on change', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText(/default language/i)).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/default language/i), 'de');

    await waitFor(() =>
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/settings/system',
        expect.objectContaining({ defaultLanguage: 'de' }),
      ),
    );
  });

  it('renders company profile tab with form fields', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />, { wrapper });

    await waitFor(() => screen.getByRole('button', { name: /company profile/i }));
    await user.click(screen.getByRole('button', { name: /company profile/i }));

    await waitFor(() => expect(screen.getByLabelText(/company name/i)).toBeInTheDocument());
    expect((screen.getByLabelText(/company name/i) as HTMLInputElement).value).toBe('Muster GmbH');
    expect((screen.getByLabelText(/tax id/i) as HTMLInputElement).value).toBe('DE123456789');
  });

  it('saves company profile on form submit', async () => {
    const user = userEvent.setup();
    mockApi.patch.mockResolvedValue({ data: MOCK_SETTINGS.company });
    render(<SettingsPage />, { wrapper });

    await waitFor(() => screen.getByRole('button', { name: /company profile/i }));
    await user.click(screen.getByRole('button', { name: /company profile/i }));

    await waitFor(() => screen.getByRole('button', { name: /save profile/i }));
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() =>
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/settings/company',
        expect.objectContaining({ name: 'Muster GmbH' }),
      ),
    );
  });

  it('calls logo upload API when file is selected', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    const user = userEvent.setup();
    render(<SettingsPage />, { wrapper });

    // Wait for data to load, then switch to company tab
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /company profile/i }));

    await waitFor(() => screen.getByTestId('logo-input'));

    const file = new File(['fake-png'], 'logo.png', { type: 'image/png' });
    await user.upload(screen.getByTestId('logo-input'), file);

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        '/settings/company/logo',
        expect.any(FormData),
        expect.any(Object),
      ),
    );
  });
});
