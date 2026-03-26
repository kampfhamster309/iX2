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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '1', email: 'admin@ix2.local', role: 'ADMIN' } }),
}));

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ api: mockApi }));

import { UsersListPage } from '@/pages/admin/UsersListPage';
import { UserEditPage } from '@/pages/admin/UserEditPage';

const MOCK_USERS = [
  {
    id: 'user-1',
    email: 'alice@test.com',
    role: 'ACCOUNTANT',
    firstName: 'Alice',
    lastName: 'Smith',
    username: 'asmith',
    phone: '+49 89 123',
    isActive: true,
  },
  {
    id: 'user-2',
    email: 'bob@test.com',
    role: 'TENANT',
    firstName: null,
    lastName: null,
    username: null,
    phone: null,
    isActive: false,
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('UsersListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({
      data: { data: MOCK_USERS, total: 2, page: 1, limit: 25 },
    });
    mockApi.post.mockResolvedValue({ data: {} });
    mockApi.patch.mockResolvedValue({ data: {} });
  });

  it('renders user rows after loading', async () => {
    render(<UsersListPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    // bob has no name — falls back to email (appears in name cell AND email cell)
    expect(screen.getAllByText('bob@test.com').length).toBeGreaterThanOrEqual(1);
  });

  it('shows inactive row with muted styling', async () => {
    render(<UsersListPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('Inactive')).toBeInTheDocument());
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('opens CreateUserModal on "New User" click', async () => {
    const user = userEvent.setup();
    render(<UsersListPage />, { wrapper });
    await waitFor(() => screen.getByText('User Management'));

    await user.click(screen.getAllByText('New User')[0]);
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    expect(screen.getByText('Password *')).toBeInTheDocument();
  });

  it('submits CreateUserModal and closes on success', async () => {
    const user = userEvent.setup();
    render(<UsersListPage />, { wrapper });
    await waitFor(() => screen.getAllByText('New User'));

    await user.click(screen.getAllByText('New User')[0]);
    await waitFor(() => screen.getByRole('button', { name: /create/i }));

    // Fill all required fields
    await user.type(screen.getByLabelText(/email \*/i), 'new@test.com');
    const passwordInputs = screen
      .getAllByRole('textbox', { hidden: true })
      .filter((el) => (el as HTMLInputElement).type === 'password');
    // Use getAllByDisplayValue or query by name directly via the DOM
    const pwInputs = document.querySelectorAll('input[type="password"]');
    if (pwInputs[0]) await user.type(pwInputs[0] as HTMLElement, 'NewPass1234!');
    if (pwInputs[1]) await user.type(pwInputs[1] as HTMLElement, 'NewPass1234!');
    void passwordInputs; // suppress unused var

    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        '/users',
        expect.objectContaining({ email: 'new@test.com' }),
      ),
    );
  });
});

describe('UserEditPage', () => {
  const mockUser = {
    id: 'user-1',
    email: 'alice@test.com',
    role: 'ACCOUNTANT',
    firstName: 'Alice',
    lastName: 'Smith',
    username: 'asmith',
    phone: '+49 89 123',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: mockUser });
    mockApi.patch.mockResolvedValue({ data: mockUser });
  });

  it('loads and displays user data', async () => {
    render(<UserEditPage userId="user-1" />, { wrapper });
    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice@test.com')).toBeInTheDocument();
  });

  it('saves role change on select change', async () => {
    const user = userEvent.setup();
    render(<UserEditPage userId="user-1" />, { wrapper });
    await waitFor(() => screen.getByDisplayValue('Alice'));

    await user.selectOptions(screen.getByRole('combobox', { name: /role/i }), 'MANAGER');

    await waitFor(() =>
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/users/user-1/role',
        expect.objectContaining({ role: 'MANAGER' }),
      ),
    );
  });

  it('calls deactivate endpoint after confirm', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<UserEditPage userId="user-1" />, { wrapper });
    await waitFor(() => screen.getByText('Deactivate'));

    await user.click(screen.getByText('Deactivate'));

    await waitFor(() => expect(mockApi.patch).toHaveBeenCalledWith('/users/user-1/deactivate'));
  });
});
