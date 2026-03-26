import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'MAINTENANCE' | 'TENANT';

interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  isActive: boolean;
}

interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

interface CreateUserForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  role: Role;
  password: string;
  confirmPassword: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'MAINTENANCE', 'TENANT'];

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-purple-100 text-purple-700',
  ACCOUNTANT: 'bg-blue-100 text-blue-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  TENANT: 'bg-gray-100 text-gray-700',
};

const inputCls =
  'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

function initials(user: User): string {
  const first = user.firstName?.[0] ?? '';
  const last = user.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || user.email[0].toUpperCase();
}

function displayName(user: User): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.email;
}

// ─── CreateUserModal ──────────────────────────────────────────────────────────

interface CreateUserModalProps {
  onClose: () => void;
}

function CreateUserModal({ onClose }: CreateUserModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateUserForm>({ defaultValues: { role: 'TENANT' } });

  const mutation = useMutation({
    mutationFn: (data: Omit<CreateUserForm, 'confirmPassword'>) =>
      api.post('/users', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  function onSubmit(data: CreateUserForm) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword: _confirmPassword, ...payload } = data;
    mutation.mutate(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl p-6 space-y-5">
        <h3 className="text-lg font-semibold text-gray-900">{t('users.newUser')}</h3>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.firstName')}
              </label>
              <input type="text" className={inputCls} {...register('firstName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.lastName')}
              </label>
              <input type="text" className={inputCls} {...register('lastName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.username')}
              </label>
              <input type="text" className={inputCls} {...register('username')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.phone')}
              </label>
              <input type="text" className={inputCls} {...register('phone')} />
            </div>
            <div className="col-span-2">
              <label
                htmlFor="create-user-email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('users.email')} *
              </label>
              <input
                id="create-user-email"
                type="email"
                className={inputCls}
                {...register('email', { required: true })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.role')}
              </label>
              <select className={inputCls} {...register('role')}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`users.roles.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.password')} *
              </label>
              <input
                type="password"
                className={inputCls}
                {...register('password', { required: true, minLength: 8 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.confirmPassword')} *
              </label>
              <input
                type="password"
                className={inputCls}
                {...register('confirmPassword', {
                  required: true,
                  validate: (v) => v === watch('password') || t('users.passwordMismatch'),
                })}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          {mutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {t('common.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── UsersListPage ────────────────────────────────────────────────────────────

export function UsersListPage() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['users'],
    queryFn: () => api.get<UsersResponse>('/users').then((r) => r.data),
  });

  return (
    <AppShell>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t('users.title')}</h2>
          <Button onClick={() => setShowCreate(true)}>{t('users.newUser')}</Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {!isLoading && data && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t('users.name')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t('users.email')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t('users.phone')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t('users.role')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t('users.status')}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      {t('users.noUsers')}
                    </td>
                  </tr>
                )}
                {data.data.map((user) => (
                  <tr key={user.id} className={cn(!user.isActive && 'opacity-50')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                          {initials(user)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{displayName(user)}</p>
                          {user.username && (
                            <p className="text-xs text-gray-500">@{user.username}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-gray-600">{user.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          ROLE_COLORS[user.role],
                        )}
                      >
                        {t(`users.roles.${user.role}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          user.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {user.isActive ? t('users.active') : t('users.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: user.id }}
                        className="text-xs font-medium text-primary-600 hover:text-primary-800"
                      >
                        {t('common.edit')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </AppShell>
  );
}
