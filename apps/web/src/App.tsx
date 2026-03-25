import {
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { Spinner } from '@/components/ui/Spinner';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { PropertyDetailPage } from '@/pages/PropertyDetailPage';
import { AccountsPage } from '@/pages/accounting/AccountsPage';
import { AccountDetailPage } from '@/pages/accounting/AccountDetailPage';
import { JournalEntriesPage } from '@/pages/accounting/JournalEntriesPage';
import '@/i18n';
import '@/index.css';

function Root() {
  const { loading } = useAuthContext();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }
  return <Outlet />;
}

function requireAuth() {
  const rt = localStorage.getItem('ix2-rt');
  if (!rt) throw redirect({ to: '/login' });
}

function IndexRedirect() {
  const { user } = useAuthContext();
  return user ? <DashboardPage /> : <LoginPage />;
}

const rootRoute = createRootRoute({ component: Root });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexRedirect,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: requireAuth,
  component: DashboardPage,
});

const propertiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/properties',
  beforeLoad: requireAuth,
  component: PropertiesPage,
});

const propertyDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/properties/$propertyId',
  beforeLoad: requireAuth,
  component: PropertyDetailPage,
});

const accountingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounting',
  beforeLoad: () => {
    throw redirect({ to: '/accounting/accounts' });
  },
});

const accountingAccountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounting/accounts',
  beforeLoad: requireAuth,
  component: AccountsPage,
});

const accountingAccountDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounting/accounts/$accountId',
  beforeLoad: requireAuth,
  component: AccountDetailPage,
});

const accountingJournalEntriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounting/journal-entries',
  beforeLoad: requireAuth,
  component: JournalEntriesPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  propertiesRoute,
  propertyDetailRoute,
  accountingRoute,
  accountingAccountsRoute,
  accountingAccountDetailRoute,
  accountingJournalEntriesRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthProvider>
  );
}
