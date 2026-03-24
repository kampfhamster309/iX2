import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) void navigate({ to: '/dashboard' });
  }, [user, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    try {
      await login(data.email, data.password);
      void navigate({ to: '/dashboard' });
    } catch {
      setError('root', { message: t('auth.error') });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-700">iX2</h1>
          <LanguageSwitcher />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('auth.loginTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Input
                id="email"
                type="email"
                label={t('auth.email')}
                autoComplete="email"
                {...register('email')}
                error={errors.email?.message}
              />
              <Input
                id="password"
                type="password"
                label={t('auth.password')}
                autoComplete="current-password"
                {...register('password')}
                error={errors.password?.message}
              />
              {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}
              <Button type="submit" className="w-full" loading={isSubmitting}>
                {t('auth.login')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
