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

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ api: mockApi }));

import { MyProfilePage } from '@/pages/profile/MyProfilePage';

const MOCK_PROFILE = {
  id: 'user-1',
  email: 'me@test.com',
  role: 'TENANT',
  firstName: 'Jane',
  lastName: 'Doe',
  username: 'jdoe',
  phone: '+49 89 999',
  isActive: true,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('MyProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: MOCK_PROFILE });
    mockApi.patch.mockResolvedValue({ data: MOCK_PROFILE });
  });

  it('renders profile data after loading', async () => {
    render(<MyProfilePage />, { wrapper });
    await waitFor(() => expect(screen.getByDisplayValue('Jane')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('me@test.com')).toBeInTheDocument();
  });

  it('shows role as read-only badge', async () => {
    render(<MyProfilePage />, { wrapper });
    await waitFor(() => screen.getByDisplayValue('Jane'));
    expect(screen.getByText('Tenant')).toBeInTheDocument();
  });

  it('saves profile changes on form submit', async () => {
    const user = userEvent.setup();
    render(<MyProfilePage />, { wrapper });
    await waitFor(() => screen.getByDisplayValue('Jane'));

    const firstNameInput = screen.getByDisplayValue('Jane');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Janet');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/users/me',
        expect.objectContaining({ firstName: 'Janet' }),
      ),
    );
  });

  it('shows error when current password is wrong', async () => {
    const user = userEvent.setup();
    mockApi.patch.mockRejectedValue({ response: { status: 401 } });
    render(<MyProfilePage />, { wrapper });
    await waitFor(() => screen.getByDisplayValue('Jane'));

    await user.type(screen.getByLabelText(/current password/i), 'wrongpass');
    await user.type(screen.getByLabelText(/^new password/i), 'NewPass1234!');
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPass1234!');

    // The button text is the t('profile.passwordSection') key value = "Change Password"
    await user.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() =>
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument(),
    );
  });
});
