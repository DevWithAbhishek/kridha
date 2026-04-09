'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LanguageToggle } from '@/components/shared/LanguageToggle';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { LoginInput, LoginSchema, SignupInput, SignupSchema } from '@/schemas';


export default function AuthPage() {
    const t = useTranslations('auth');
    const router = useRouter();
    const searchParams = useSearchParams();

    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
    const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register: registerLogin,
        handleSubmit: handleSubmitLogin,
        formState: { errors: loginErrors },
    } = useForm<LoginInput>({
        resolver: zodResolver(LoginSchema),
    });

    const {
        register: registerSignup,
        handleSubmit: handleSubmitSignup,
        formState: { errors: signupErrors },
    } = useForm<SignupInput>({
        resolver: zodResolver(SignupSchema),
    });

    const redirectUrl = searchParams.get('redirect') ?? '/dashboard';

    async function handleLogin(values: LoginInput) {
        setFormError(null);
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: values.phone, pin: values.pin }),
            });

            if (res.status === 401) {
                setFormError(t('errors.INVALID_CREDENTIALS'));
                return;
            }

            if (res.status === 429) {
                setFormError(t('errors.PIN_LOCKED'));
                return;
            }

            if (!res.ok) {
                setFormError(t('errors.INTERNAL_ERROR'));
                return;
            }

            router.push(redirectUrl);
        } catch {
            setFormError(t('errors.INTERNAL_ERROR'));
        } finally {
            setLoading(false);
        }
    }

    async function handleSignup(values: SignupInput) {
        setFormError(null);
        setLoading(true);

        try {
            const signupRes = await fetch('/api/auth/signup', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: values.name,
                    phone: values.phone,
                    pin: values.pin,
                    confirmPin: values.confirmPin,
                    role: values.role,
                }),
            });

            if (!signupRes.ok && signupRes.status !== 201) {
                setFormError(t('errors.INTERNAL_ERROR'));
                return;
            }

            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: values.phone, pin: values.pin }),
            });

            if (!loginRes.ok) {
                setFormError(t('errors.INVALID_CREDENTIALS'));
                return;
            }

            router.push(redirectUrl);
        } catch {
            setFormError(t('errors.INTERNAL_ERROR'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div className="flex justify-end gap-2 mb-8 lg:hidden">
                <LanguageToggle />
                <ThemeToggle />
            </div>

            <div className="bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal border border-[var(--color-border)] p-8">
                <div className="flex rounded-pill bg-background-subtle p-1 mb-8">
                    <button
                        type="button"
                        onClick={() => setActiveTab('login')}
                        className={`flex-1 rounded-pill px-4 py-2 text-label-sm transition ${activeTab === 'login'
                                ? 'bg-[var(--color-surface)] shadow-sm font-semibold'
                                : 'text-[var(--color-text-muted)]'
                            }`}
                    >
                        {t('login')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('signup')}
                        className={`flex-1 rounded-pill px-4 py-2 text-label-sm transition ${activeTab === 'signup'
                                ? 'bg-[var(--color-surface)] shadow-sm font-semibold'
                                : 'text-[var(--color-text-muted)]'
                            }`}
                    >
                        {t('signup')}
                    </button>
                </div>

                {activeTab === 'login' ? (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-h3 font-bold text-[var(--color-text)]">{t('login')}</h1>
                            <p className="text-body-sm text-[var(--color-text-muted)] mt-2">
                                {t('login')} with your phone and PIN
                            </p>
                        </div>

                        <form onSubmit={handleSubmitLogin(handleLogin)} className="space-y-5">
                            <Input
                                label={t('phone')}
                                phonePrefix
                                {...registerLogin('phone')}
                                error={loginErrors.phone?.message}
                            />
                            <Input
                                label={t('pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerLogin('pin')}
                                error={loginErrors.pin?.message}
                            />

                            <div className="text-right">
                                <a className="text-kridha-primary text-label-sm hover:underline" href="/reset-pin">
                                    {t('forgot_pin')}
                                </a>
                            </div>

                            {formError && (
                                <div className="text-error text-label-sm">{formError}</div>
                            )}

                            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                                {t('login_btn')}
                            </Button>
                        </form>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-h3 font-bold text-[var(--color-text)]">{t('signup')}</h1>
                            <p className="text-body-sm text-[var(--color-text-muted)] mt-2">
                                {t('create_account')}
                            </p>
                        </div>

                        <div className="flex gap-2 rounded-pill bg-background-subtle p-1">
                            {(['buyer', 'seller'] as const).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setRole(item)}
                                    className={`flex-1 rounded-pill px-3 py-2 text-label-sm transition ${role === item
                                            ? 'bg-[var(--color-surface)] shadow-sm font-semibold'
                                            : 'text-[var(--color-text-muted)]'
                                        }`}
                                >
                                    {item === 'buyer' ? 'Buyer' : 'Supplier'}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmitSignup(handleSignup)} className="space-y-5">
                            <Input
                                label={t('name')}
                                {...registerSignup('name')}
                                error={signupErrors.name?.message}
                            />
                            <Input
                                label={t('phone')}
                                phonePrefix
                                {...registerSignup('phone')}
                                error={signupErrors.phone?.message}
                            />
                            <Input
                                label={t('pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerSignup('pin')}
                                error={signupErrors.pin?.message}
                            />
                            <Input
                                label={t('confirm_pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerSignup('confirmPin')}
                                error={signupErrors.confirmPin?.message}
                            />

                            {formError && (
                                <div className="text-error text-label-sm">{formError}</div>
                            )}

                            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                                {t('signup_btn')}
                            </Button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}