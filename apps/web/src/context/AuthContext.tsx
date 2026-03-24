import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { api, setAccessToken, setRefreshToken, getRefreshToken } from '@/lib/api';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

type AuthAction =
  | { type: 'SET_USER'; payload: AuthUser }
  | { type: 'CLEAR_USER' }
  | { type: 'SET_LOADING'; payload: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false };
    case 'CLEAR_USER':
      return { user: null, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { user: null, loading: true });

  // On mount: try to restore session from stored refresh token
  useEffect(() => {
    const rt = getRefreshToken();
    if (!rt) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    api
      .post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken: rt })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        return api.get<AuthUser>('/auth/me');
      })
      .then(({ data }) => dispatch({ type: 'SET_USER', payload: data }))
      .catch(() => {
        setAccessToken(null);
        setRefreshToken(null);
        dispatch({ type: 'CLEAR_USER' });
      });
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', {
      email,
      password,
    });
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    const { data: user } = await api.get<AuthUser>('/auth/me');
    dispatch({ type: 'SET_USER', payload: user });
  }

  async function logout() {
    const rt = getRefreshToken();
    if (rt) {
      await api.post('/auth/logout', { refreshToken: rt }).catch(() => {});
    }
    setAccessToken(null);
    setRefreshToken(null);
    dispatch({ type: 'CLEAR_USER' });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
