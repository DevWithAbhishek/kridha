'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoginInput, LoginSchema, SignupInput, SignupSchema } from '@/schemas';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toastNotifications';

export default function AuthPage() {
    const t = useTranslations('auth');
    const tError = useTranslations('errors');
    const router = useRouter();
    const searchParams = useSearchParams();
    const qc = useQueryClient();

    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register: registerLogin,
        handleSubmit: handleSubmitLogin,
        formState: { errors: loginErrors },
    } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

    const {
        register: registerSignup,
        handleSubmit: handleSubmitSignup,
        formState: { errors: signupErrors },
    } = useForm<SignupInput>({ resolver: zodResolver(SignupSchema) });

    // FIX: decode redirect URL and clamp to safe same-origin paths only.
    // Never redirect to an external URL — prevents open-redirect attacks.
    const rawRedirect = searchParams.get('redirect') ?? '/profile/dashboard';
    const redirectUrl = rawRedirect.startsWith('/') ? rawRedirect : '/profile/dashboard';

    // ── Login ─────────────────────────────────────────────────────────────────
    async function handleLogin(values: LoginInput) {
        setFormError(null);
        setLoading(true);
        try {
            await api.post('/auth/login', { phone: values.phone, pin: values.pin });
            await qc.invalidateQueries({ queryKey: ['me'] });
            toast.success("Welcome Back to KRIDHA!!!")
            router.push(redirectUrl);
        } catch (err) {
            const e = err as { response?: { status?: number; data?: { code?: string } } };
            const status = e.response?.status;
            const code = e.response?.data?.code;
            toast.warning("Login Failed. Please retry.")
            if (status === 401 || code === 'INVALID_CREDENTIALS') {
                setFormError(tError('INVALID_CREDENTIALS'));
            } else if (status === 429 || code === 'PIN_LOCKED' || code === 'RATE_LIMITED') {
                setFormError(tError('PIN_LOCKED'));
            } else if (code === 'PIN_INVALID') {
                setFormError(tError('PIN_INVALID'));
            }
            
            else {
                setFormError(tError('INTERNAL_ERROR'));
            }
        } finally {
            setLoading(false);
        }
    }

    // ── Signup ────────────────────────────────────────────────────────────────
    async function handleSignup(values: SignupInput) {
        setFormError(null);
        setLoading(true);
        try {
            await api.post('/auth/signup', {
                name: values.name,
                phone: values.phone,
                pin: values.pin,
                confirmPin: values.confirmPin,
            });
            // Auto-login after signup. This is what sets the auth cookies.
            await api.post('/auth/login', { phone: values.phone, pin: values.pin });
            // Invalidate stale ['me'] cache before navigating — prevents AuthGuard
            // from reading a null user from a previous failed attempt.
            await qc.invalidateQueries({ queryKey: ['me'] });
            toast.success("Welcome to Kridha !!!")

            router.push(redirectUrl);
        } catch (err) {
            const e = err as { response?: { status?: number; data?: { code?: string } } };
            const code = e.response?.data?.code;
            toast.error("Signup Failed. Please check details");
            if (code === 'INVALID_CREDENTIALS') {
                // Signup succeeded but auto-login failed — rare, ask user to log in
                setActiveTab('login');
                setFormError(tError('SIGNUP_LOGIN_PROMPT') || 'Account created! Please log in.');
            } else if (e.response?.status === 429) {
                setFormError(tError('RATE_LIMITED'));
            } else {
                setFormError(tError('INTERNAL_ERROR'));
            }
        } finally {
            setLoading(false);
        }
    }

    function switchTab(tab: 'login' | 'signup') {
        setActiveTab(tab);
        setFormError(null);
    }

    return (
        <div>
            <div className="bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal border border-[var(--color-border)] p-8 pt-2">

                {/* Tab switcher */}
                <div className="flex rounded-pill bg-background-subtle p-1 mb-8">
                    {(['login', 'signup'] as const).map(tab => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => switchTab(tab)}
                            className={`flex-1 rounded-pill px-4 py-2 text-label-sm transition ${activeTab === tab
                                    ? 'bg-[var(--color-surface)] shadow-sm font-semibold'
                                    : 'text-[var(--color-text-muted)]'
                                }`}
                        >
                            {t(tab)}
                        </button>
                    ))}
                </div>

                {/* ── LOGIN ─────────────────────────────────────────────────────── */}
                {activeTab === 'login' && (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-h3 font-bold text-[var(--color-text)]">{t('login')}</h1>
                        </div>
                        <form onSubmit={handleSubmitLogin(handleLogin)} className="space-y-5">
                            <Input
                                label={t('phone')}
                                phonePrefix
                                {...registerLogin('phone')}
                                error={loginErrors.phone?.message ? tError(loginErrors.phone.message) : undefined}
                            />
                            <Input
                                label={t('pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerLogin('pin')}
                                error={loginErrors.pin?.message ? tError(loginErrors.pin.message) : undefined}
                            />
                            <div className="text-right">
                                <Link className="text-kridha-primary text-label-sm hover:underline" href="/reset-pin">
                                    {t('forgot_pin')}
                                </Link>
                            </div>
                            {formError && <p className="text-error text-label-sm">{formError}</p>}
                            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                                {t('login_btn')}
                            </Button>
                        </form>
                    </div>
                )}

                {/* ── SIGNUP ────────────────────────────────────────────────────── */}
                {activeTab === 'signup' && (
                    <div className="space-y-6">
                        <h1 className="text-h3 font-bold text-[var(--color-text)]">{t('signup')}</h1>
                        <form onSubmit={handleSubmitSignup(handleSignup)} className="space-y-5">
                            <Input
                                label={t('name')}
                                {...registerSignup('name')}
                                error={signupErrors.name?.message ? tError(signupErrors.name.message) : undefined}
                            />
                            <Input
                                label={t('phone')}
                                phonePrefix
                                {...registerSignup('phone')}
                                error={signupErrors.phone?.message ? tError(signupErrors.phone.message) : undefined}
                            />
                            <Input
                                label={t('pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerSignup('pin')}
                                error={signupErrors.pin?.message ? tError(signupErrors.pin.message) : undefined}
                            />
                            <Input
                                label={t('confirm_pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...registerSignup('confirmPin')}
                                error={signupErrors.confirmPin?.message ? tError(signupErrors.confirmPin.message) : undefined}
                            />
                            {formError && <p className="text-error text-label-sm">{formError}</p>}
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
