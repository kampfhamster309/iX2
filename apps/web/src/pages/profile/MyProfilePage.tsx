import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  role: string;
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

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

// ─── MyProfilePage ────────────────────────────────────────────────────────────

export function MyProfilePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<UserProfile>('/users/me').then((r) => r.data),
  });

  const { register: regProfile, handleSubmit: handleProfileSubmit } = useForm<ProfileForm>();

  const {
    register: regPw,
    handleSubmit: handlePwSubmit,
    watch,
    reset: resetPw,
    formState: { errors: pwErrors },
  } = useForm<ChangePasswordForm>();

  const profileMutation = useMutation({
    mutationFn: (data: Partial<ProfileForm>) => api.patch('/users/me', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users', 'me'] });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    },
  });

  const pwMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/users/me/password', data).then((r) => r.data),
    onSuccess: () => {
      resetPw();
      setPwSaved(true);
      setPwError(null);
      setTimeout(() => setPwSaved(false), 2000);
    },
    onError: () => {
      setPwError(t('profile.wrongCurrentPassword'));
    },
  });

  function onPwSubmit(data: ChangePasswordForm) {
    setPwError(null);
    pwMutation.mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword });
  }

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
        <h2 className="text-xl font-semibold text-gray-900">{t('profile.title')}</h2>

        {/* Profile information section */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-gray-800">{t('profile.profileSection')}</h3>

          {/* Read-only role badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">{t('users.role')}:</span>
            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {t(`users.roles.${user.role}`)}
            </span>
          </div>

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
              {profileSaved && <span className="text-sm text-green-600">{t('profile.saved')}</span>}
              {profileMutation.isError && (
                <span className="text-sm text-red-600">{t('app.error')}</span>
              )}
            </div>
          </form>
        </section>

        {/* Change password section */}
        <section className="space-y-4 border-t border-gray-200 pt-6">
          <h3 className="text-base font-semibold text-gray-800">{t('profile.passwordSection')}</h3>

          <form onSubmit={(e) => void handlePwSubmit(onPwSubmit)(e)} className="space-y-4 max-w-sm">
            <div>
              <label
                htmlFor="profile-current-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('profile.currentPassword')}
              </label>
              <input
                id="profile-current-password"
                type="password"
                className={inputCls}
                {...regPw('currentPassword', { required: true })}
              />
            </div>
            <div>
              <label
                htmlFor="profile-new-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('profile.newPassword')}
              </label>
              <input
                id="profile-new-password"
                type="password"
                className={inputCls}
                {...regPw('newPassword', { required: true, minLength: 8 })}
              />
            </div>
            <div>
              <label
                htmlFor="profile-confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('profile.confirmPassword')}
              </label>
              <input
                id="profile-confirm-password"
                type="password"
                className={inputCls}
                {...regPw('confirmPassword', {
                  required: true,
                  validate: (v) => v === watch('newPassword') || t('profile.passwordMismatch'),
                })}
              />
              {pwErrors.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">{pwErrors.confirmPassword.message}</p>
              )}
            </div>

            {pwError && <p className="text-sm text-red-600">{pwError}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" loading={pwMutation.isPending}>
                {t('profile.passwordSection')}
              </Button>
              {pwSaved && (
                <span className="text-sm text-green-600">{t('profile.passwordChanged')}</span>
              )}
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
