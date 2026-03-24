import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: unknown) => {
        const e = error as { response?: { status?: number } };
        if (e?.response?.status === 401) return false;
        if (e?.response?.status === 403) return false;
        if (e?.response?.status === 404) return false;
        return failureCount < 2;
      },
    },
  },
});
