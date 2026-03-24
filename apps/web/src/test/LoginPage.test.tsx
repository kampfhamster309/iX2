import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../i18n'; // init i18n

// Mock the auth context
const mockLogin = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: null, loading: false, login: mockLogin, logout: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

import { LoginPage } from '@/pages/LoginPage';

function renderLogin() {
  return render(<LoginPage />);
}

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('calls login with credentials on submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@ix2.local');
    await userEvent.type(screen.getByLabelText(/password/i), 'Admin1234!');
    await userEvent.click(screen.getByRole('button', { name: /log in|anmelden/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('admin@ix2.local', 'Admin1234!'));
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('401'));
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@test.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /log in|anmelden/i }));
    await waitFor(() => expect(screen.getByText(/invalid|ungültig/i)).toBeInTheDocument());
  });
});
