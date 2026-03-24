import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
