'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoginInput, LoginSchema, SignupInput, SignupSchema } from '@/schemas';
import Link from 'next/link';


export default function AuthPage() {
    const t = useTranslations('auth');
    const tError = useTranslations('errors');
    const router = useRouter();
    const searchParams = useSearchParams();

    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
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

    const redirectUrl = searchParams.get('redirect') ?? '/';
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
                setFormError(tError('errors.INVALID_CREDENTIALS'));
                return;
            }

            if (res.status === 429) {
                setFormError(tError('errors.PIN_LOCKED'));
                return;
            }

            if (!res.ok) {
                setFormError(tError('errors.INTERNAL_ERROR'));
                return;
            }

            router.push(redirectUrl);
        } catch {
            setFormError(tError('errors.INTERNAL_ERROR'));
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
                }),
            });

            if (!signupRes.ok && signupRes.status !== 201) {
                setFormError(tError('errors.INTERNAL_ERROR'));
                return;
            }

            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: values.phone, pin: values.pin }),
            });

            if (!loginRes.ok) {
                setFormError(tError('errors.INVALID_CREDENTIALS'));
                return;
            }

            router.push(redirectUrl);
        } catch {
            setFormError(tError('errors.INTERNAL_ERROR'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>

            <div className="bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal border border-[var(--color-border)] p-8 pt-2">
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
                                error={
                                    loginErrors.phone?.message
                                        ? tError(`${loginErrors.phone.message}`)
                                        : undefined
                                }
                            />
                            <Input
                                label={t('pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerLogin('pin')}
                                error={
                                    loginErrors.pin?.message
                                        ? tError(`${loginErrors.pin.message}`)
                                        : undefined
                                }
                            />

                            <div className="text-right">
                                <Link className="text-kridha-primary text-label-sm hover:underline" href="/reset-pin">
                                    {t('forgot_pin')}
                                </Link>
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
                        </div>

                        <form onSubmit={handleSubmitSignup(handleSignup)} className="space-y-5">
                            <Input
                                label={t('name')}
                                {...registerSignup('name')}
                                    error={
                                        signupErrors.name?.message
                                            ? tError(`${signupErrors.name.message}`)
                                            : undefined
                                    }
                            />
                            <Input
                                label={t('phone')}
                                phonePrefix
                                {...registerSignup('phone')}
                                    error={
                                        signupErrors.phone?.message
                                            ? tError(`${signupErrors.phone.message}`)
                                            : undefined
                                    }
                            />
                            <Input
                                label={t('pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerSignup('pin')}
                                    error={
                                        signupErrors.pin?.message
                                            ? tError(`${signupErrors.pin.message}`)
                                            : undefined
                                    }
                            />
                            <Input
                                label={t('confirm_pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerSignup('confirmPin')}
                                    error={
                                        signupErrors.confirmPin?.message
                                            ? tError(`${signupErrors.confirmPin.message}`)
                                            : undefined
                                    }
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