import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

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

interface ProfileForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
}

interface ResetPasswordForm {
  password: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'MAINTENANCE', 'TENANT'];

const inputCls =
  'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

// ─── UserEditPage ─────────────────────────────────────────────────────────────

export function UserEditPage({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['users', userId],
    queryFn: () => api.get<User>(`/users/${userId}`).then((r) => r.data),
  });

  const { register: regProfile, handleSubmit: handleProfileSubmit } = useForm<ProfileForm>();
  const {
    register: regPw,
    handleSubmit: handlePwSubmit,
    reset: resetPw,
  } = useForm<ResetPasswordForm>();

  const profileMutation = useMutation({
    mutationFn: (data: Partial<ProfileForm>) =>
      api.patch(`/users/${userId}`, data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    },
  });

  const roleMutation = useMutation({
    mutationFn: (role: Role) => api.patch(`/users/${userId}/role`, { role }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users', userId] });
    },
  });

  const pwMutation = useMutation({
    mutationFn: (data: ResetPasswordForm) =>
      api.patch(`/users/${userId}/password`, { password: data.password }).then((r) => r.data),
    onSuccess: () => {
      resetPw();
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2000);
    },
  });

  const activeMutation = useMutation({
    mutationFn: (activate: boolean) =>
      api.patch(`/users/${userId}/${activate ? 'activate' : 'deactivate'}`).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users', userId] }),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      </AppShell>
    );
  }

  if (!user) return null;

  return (
    <AppShell>
      <div className="p-6 space-y-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => void navigate({ to: '/admin/users' })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← {t('common.back')}
          </button>
          <h2 className="text-xl font-semibold text-gray-900">{t('users.editUser')}</h2>
        </div>

        {/* Profile section */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-gray-800">{t('profile.profileSection')}</h3>
          <form
            onSubmit={(e) => void handleProfileSubmit((d) => profileMutation.mutate(d))(e)}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.firstName')}
              </label>
              <input
                type="text"
                className={inputCls}
                defaultValue={user.firstName ?? ''}
                {...regProfile('firstName')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.lastName')}
              </label>
              <input
                type="text"
                className={inputCls}
                defaultValue={user.lastName ?? ''}
                {...regProfile('lastName')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.username')}
              </label>
              <input
                type="text"
                className={inputCls}
                defaultValue={user.username ?? ''}
                {...regProfile('username')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.phone')}
              </label>
              <input
                type="text"
                className={inputCls}
                defaultValue={user.phone ?? ''}
                {...regProfile('phone')}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.email')}
              </label>
              <input
                type="email"
                className={inputCls}
                defaultValue={user.email}
                {...regProfile('email')}
              />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Button type="submit" loading={profileMutation.isPending}>
                {t('common.save')}
              </Button>
              {profileSaved && <span className="text-sm text-green-600">{t('users.saved')}</span>}
              {profileMutation.isError && (
                <span className="text-sm text-red-600">{t('app.error')}</span>
              )}
            </div>
          </form>
        </section>

        {/* Role section */}
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-gray-800">{t('users.role')}</h3>
          <div className="flex items-center gap-3">
            <select
              className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              defaultValue={user.role}
              onChange={(e) => roleMutation.mutate(e.target.value as Role)}
              aria-label={t('users.role')}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`users.roles.${r}`)}
                </option>
              ))}
            </select>
            {roleMutation.isPending && <Spinner className="h-4 w-4" />}
          </div>
        </section>

        {/* Reset password section */}
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-gray-800">{t('users.resetPassword')}</h3>
          <p className="text-sm text-gray-500">{t('users.resetPasswordHint')}</p>
          <form
            onSubmit={(e) => void handlePwSubmit((d) => pwMutation.mutate(d))(e)}
            className="flex items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.newPassword')}
              </label>
              <input
                type="password"
                className={inputCls}
                {...regPw('password', { required: true, minLength: 8 })}
              />
            </div>
            <Button type="submit" loading={pwMutation.isPending}>
              {t('users.resetPassword')}
            </Button>
            {pwSaved && <span className="text-sm text-green-600">{t('users.saved')}</span>}
          </form>
          {pwMutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
        </section>

        {/* Deactivate / Activate section */}
        <section className="space-y-3 border-t border-gray-200 pt-6">
          <h3 className="text-base font-semibold text-gray-800">{t('users.status')}</h3>
          {user.isActive ? (
            <Button
              variant="secondary"
              loading={activeMutation.isPending}
              onClick={() => {
                if (window.confirm(t('users.deactivateConfirm'))) {
                  activeMutation.mutate(false);
                }
              }}
            >
              {t('users.deactivate')}
            </Button>
          ) : (
            <Button
              loading={activeMutation.isPending}
              onClick={() => {
                if (window.confirm(t('users.activateConfirm'))) {
                  activeMutation.mutate(true);
                }
              }}
            >
              {t('users.activate')}
            </Button>
          )}
          {activeMutation.isError && <p className="text-sm text-red-600">{t('app.error')}</p>}
        </section>
      </div>
    </AppShell>
  );
}
