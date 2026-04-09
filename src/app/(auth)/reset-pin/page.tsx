'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const phoneSchema = z.object({
    phone: z.string().regex(/^[6-9]\d{9}$/, '10 digit phone number required'),
});

const resetSchema = z
    .object({
        otp: z.string().length(4, 'OTP must be 4 digits').regex(/^\d{4}$/, 'OTP must be 4 digits'),
        newPin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d{4}$/, 'PIN must be 4 digits'),
        confirmPin: z.string().length(4, 'PIN must be 4 digits'),
    })
    .refine((data) => data.newPin === data.confirmPin, {
        path: ['confirmPin'],
        message: 'PIN does not match',
    });

type PhoneFormValues = z.infer<typeof phoneSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPinPage() {
    const t = useTranslations('auth');
    const router = useRouter();

    const [step, setStep] = useState<1 | 2>(1);
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [countdown, setCountdown] = useState(3);

    const phoneForm = useForm<PhoneFormValues>({
        resolver: zodResolver(phoneSchema),
    });

    const resetForm = useForm<ResetFormValues>({
        resolver: zodResolver(resetSchema),
    });

    async function handleSendOtp(values: PhoneFormValues) {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-pin-request', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: values.phone }),
            });
            if (res.ok) {
                setPhone(values.phone);
                setStep(2);
            } else {
                phoneForm.setError('phone', { message: t('errors.INVALID_PHONE') });
            }
        } catch {
            phoneForm.setError('phone', { message: t('errors.INTERNAL_ERROR') });
        } finally {
            setLoading(false);
        }
    }

    async function handleResetPin(values: ResetFormValues) {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-pin', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    otp: values.otp,
                    newPin: values.newPin,
                }),
            });
            if (res.ok) {
                setSuccess(true);
            } else {
                resetForm.setError('otp', { message: t('errors.INVALID_OTP') });
            }
        } catch {
            resetForm.setError('otp', { message: t('errors.INTERNAL_ERROR') });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (success) {
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev === 1) {
                        router.push('/login');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [success, router]);

    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-page-x py-8">
            <div className="max-w-form w-full bg-[var(--color-surface)] rounded-modal shadow-modal border border-[var(--color-border)] p-8">
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2].map((s) => (
                        <div
                            key={s}
                            className={`w-3 h-3 rounded-full ${s < step ? 'bg-kridha-primary/40' : s === step ? 'bg-kridha-primary' : 'bg-gray-200'
                                }`}
                        />
                    ))}
                </div>

                {success ? (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-success-light text-success rounded-full flex items-center justify-center mx-auto">
                            ✓
                        </div>
                        <h1 className="text-h4 font-bold">PIN बदल गया!</h1>
                        <p className="text-body-sm text-muted">Redirecting in {countdown}s...</p>
                    </div>
                ) : step === 1 ? (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-h3 font-bold text-[var(--color-text)]">{t('reset_pin')}</h1>
                            <p className="text-body-sm text-[var(--color-text-muted)] mt-2">
                                {t('reset_pin_desc')}
                            </p>
                        </div>

                        <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-5">
                            <Input
                                label={t('phone')}
                                phonePrefix
                                {...phoneForm.register('phone')}
                                error={phoneForm.formState.errors.phone?.message}
                            />

                            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                                {t('send_otp')}
                            </Button>
                        </form>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-h3 font-bold text-[var(--color-text)]">{t('new_pin')}</h1>
                            <p className="text-body-sm text-[var(--color-text-muted)] mt-2">
                                {t('otp_sent')} +91 {phone}
                            </p>
                        </div>

                        <form onSubmit={resetForm.handleSubmit(handleResetPin)} className="space-y-5">
                            <div>
                                <label className="text-label-sm text-[var(--color-text-muted)]">{t('otp')}</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={4}
                                    className="w-full mt-2 text-center text-display-sm tracking-[0.4em] border border-[var(--color-border)] rounded-lg px-4 py-3 focus:border-kridha-primary focus:shadow-focus-primary"
                                    {...resetForm.register('otp')}
                                />
                                {resetForm.formState.errors.otp && (
                                    <p className="text-error text-label-sm mt-1">{resetForm.formState.errors.otp.message}</p>
                                )}
                            </div>

                            <Input
                                label={t('new_pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...resetForm.register('newPin')}
                                error={resetForm.formState.errors.newPin?.message}
                            />

                            <Input
                                label={t('confirm_pin')}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                {...resetForm.register('confirmPin')}
                                error={resetForm.formState.errors.confirmPin?.message}
                            />

                            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                                {t('change_pin')}
                            </Button>
                        </form>

                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="text-kridha-primary text-label-sm hover:underline"
                        >
                            ← {t('back_to_phone')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}