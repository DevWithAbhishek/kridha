    'use client';

    import { useState, useRef, useCallback } from 'react';
    import { useRouter } from 'next/navigation';
    import { useTranslations } from 'next-intl';
    import { useForm } from 'react-hook-form';
    import { zodResolver } from '@hookform/resolvers/zod';
    import Link from 'next/link';
    import { Input } from '@/components/ui/Input';
    import { Button } from '@/components/ui/Button';
    import { useLangStore } from '@/stores/langStore';
    import { AddPickupWindowInput, RegisterAsSellerInput, RegisterAsSellerSchema } from '@/schemas';

    // ─── India states ─────────────────────────────────────────────────────────────
    export const STATES = [
        'Andaman and Nicobar', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam',
        'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli', 'Daman and Diu',
        'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
        'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh',
        'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
        'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
        'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    ];

    // ─── Business types ───────────────────────────────────────────────────────────
    const BUSINESS_TYPES = [
        { value: 'INDIVIDUAL', hi: 'व्यक्तिगत', en: 'Individual' },
        { value: 'PROPRIETORSHIP', hi: 'एकलस्वामित्व', en: 'Proprietorship' },
        { value: 'PARTNERSHIP', hi: 'साझेदारी', en: 'Partnership' },
        { value: 'PVT_LTD', hi: 'प्राइवेट लिमिटेड', en: 'Pvt. Limited' },
    ] as const;

    // ─── Days config (pickup window) ─────────────────────────────────────────────
    const DAYS = [
        { value: 'MON', hi: 'सोम', en: 'Mon' },
        { value: 'TUE', hi: 'मंगल', en: 'Tue' },
        { value: 'WED', hi: 'बुध', en: 'Wed' },
        { value: 'THU', hi: 'गुरु', en: 'Thu' },
        { value: 'FRI', hi: 'शुक्र', en: 'Fri' },
        { value: 'SAT', hi: 'शनि', en: 'Sat' },
        { value: 'SUN', hi: 'रवि', en: 'Sun' },
    ] as const;

    type DayValue = typeof DAYS[number]['value'];

    // Local pickup window type (not sent to backend separately — backend creates
    // defaults on registerAsSeller; these are stored locally and POSTed via
    // POST /api/pickup-windows after seller registration succeeds)
    interface PickupWindowDraft {
        labelHi: string;
        labelEn: string;
        startTime: string;
        endTime: string;
        daysActive: DayValue[];
    }

    const DEFAULT_WINDOWS: PickupWindowDraft[] = [
        { labelHi: 'सुबह', labelEn: 'Morning', startTime: '08:00', endTime: '12:00', daysActive: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
        { labelHi: 'दोपहर', labelEn: 'Afternoon', startTime: '12:00', endTime: '16:00', daysActive: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
        { labelHi: 'शाम', labelEn: 'Evening', startTime: '16:00', endTime: '20:00', daysActive: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
    ];

    // ─── Step indicator ───────────────────────────────────────────────────────────
    function StepIndicator({ current, total }: { current: number; total: number }) {
        return (
            <div className="flex items-center justify-center gap-2 mb-6">
                {Array.from({ length: total }).map((_, i) => {
                    const done = i < current;
                    const active = i === current;
                    return (
                        <div key={i} className="flex items-center gap-2">
                            {i > 0 && (
                                <div className={`h-px w-6 sm:w-8 transition-colors ${done ? 'bg-kridha-primary' : 'bg-border-DEFAULT dark:bg-border-dark'}`} />
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-label-sm font-bold border-2 transition-all ${done ? 'bg-kridha-primary border-kridha-primary text-white' :
                                active ? 'border-kridha-primary text-kridha-primary bg-kridha-secondary dark:bg-kridha-primary/20' :
                                    'border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT dark:text-muted-dark'
                                }`}>
                                {done ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : i + 1}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // ─── Summary row ──────────────────────────────────────────────────────────────
    function SummaryRow({ label, value }: { label: string; value: string | undefined }) {
        return (
            <div className="flex items-start justify-between gap-4">
                <span className="text-muted-DEFAULT dark:text-muted-dark flex-shrink-0 min-w-24 text-label-sm">{label}</span>
                <span className="text-[var(--color-text)] text-right font-medium break-all text-label-sm">{value ?? '—'}</span>
            </div>
        );
    }

    // ─── Pickup window editor ─────────────────────────────────────────────────────
    function PickupWindowEditor({
        windows,
        onChange,
        lang,
    }: {
        windows: PickupWindowDraft[];
        onChange: (w: PickupWindowDraft[]) => void;
        lang: 'hi' | 'en';
    }) {
        function updateWindow(i: number, patch: Partial<PickupWindowDraft>) {
            const next = windows.map((w, idx) => idx === i ? { ...w, ...patch } : w);
            onChange(next);
        }

        function toggleDay(i: number, day: DayValue) {
            const w = windows[i];
            const has = w.daysActive.includes(day);
            const next = has
                ? w.daysActive.filter(d => d !== day)
                : [...w.daysActive, day];
            updateWindow(i, { daysActive: next as DayValue[] });
        }

        function addWindow() {
            if (windows.length >= 5) return;
            onChange([...windows, { labelHi: '', labelEn: '', startTime: '09:00', endTime: '13:00', daysActive: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }]);
        }

        function removeWindow(i: number) {
            if (windows.length <= 1) return;
            onChange(windows.filter((_, idx) => idx !== i));
        }

        return (
            <div className="space-y-4">
                {windows.map((w, i) => (
                    <div key={i} className="border border-border-DEFAULT dark:border-border-dark rounded-xl p-4 space-y-3 bg-background-DEFAULT dark:bg-background-dark">
                        {/* Window header */}
                        <div className="flex items-center justify-between">
                            <span className="text-label-md font-semibold text-[var(--color-text)]">
                                {lang === 'hi' ? `Window ${i + 1}` : `Window ${i + 1}`}
                            </span>
                            {windows.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeWindow(i)}
                                    className="text-error text-label-sm hover:underline"
                                >
                                    {lang === 'hi' ? 'हटाएं' : 'Remove'}
                                </button>
                            )}
                        </div>

                        {/* Labels */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-label-sm text-muted-DEFAULT dark:text-muted-dark block mb-1">
                                    {lang === 'hi' ? 'Hindi label *' : 'Hindi label *'}
                                </label>
                                <input
                                    value={w.labelHi}
                                    onChange={e => updateWindow(i, { labelHi: e.target.value })}
                                    placeholder="जैसे: सुबह"
                                    className="w-full px-3 py-2.5 rounded-lg border border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-label-sm text-muted-DEFAULT dark:text-muted-dark block mb-1">
                                    {lang === 'hi' ? 'English label *' : 'English label *'}
                                </label>
                                <input
                                    value={w.labelEn}
                                    onChange={e => updateWindow(i, { labelEn: e.target.value })}
                                    placeholder="e.g. Morning"
                                    className="w-full px-3 py-2.5 rounded-lg border border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Time range */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-label-sm text-muted-DEFAULT dark:text-muted-dark block mb-1">
                                    {lang === 'hi' ? 'शुरू का समय *' : 'Start time *'}
                                </label>
                                <input
                                    type="time"
                                    value={w.startTime}
                                    onChange={e => updateWindow(i, { startTime: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-lg border border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-label-sm text-muted-DEFAULT dark:text-muted-dark block mb-1">
                                    {lang === 'hi' ? 'खत्म का समय *' : 'End time *'}
                                </label>
                                <input
                                    type="time"
                                    value={w.endTime}
                                    onChange={e => updateWindow(i, { endTime: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-lg border border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 transition-all"
                                />
                            </div>
                        </div>
                        {/* Validate end > start */}
                        {w.startTime && w.endTime && w.endTime <= w.startTime && (
                            <p className="text-error text-label-xs">
                                {lang === 'hi' ? 'खत्म का समय शुरू से बाद होना चाहिए' : 'End time must be after start time'}
                            </p>
                        )}

                        {/* Days */}
                        <div>
                            <label className="text-label-sm text-muted-DEFAULT dark:text-muted-dark block mb-2">
                                {lang === 'hi' ? 'कौन से दिन? *' : 'Active days *'}
                            </label>
                            <div className="flex gap-1.5 flex-wrap">
                                {DAYS.map(day => {
                                    const active = w.daysActive.includes(day.value);
                                    return (
                                        <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => toggleDay(i, day.value)}
                                            className={`px-2.5 py-1.5 rounded-lg text-label-sm font-medium border-2 transition-all min-h-touch ${active
                                                ? 'border-kridha-primary bg-kridha-secondary dark:bg-kridha-primary/20 text-kridha-primary'
                                                : 'border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT dark:text-muted-dark hover:border-kridha-primary/40'
                                                }`}
                                        >
                                            {lang === 'hi' ? day.hi : day.en}
                                        </button>
                                    );
                                })}
                            </div>
                            {w.daysActive.length === 0 && (
                                <p className="text-error text-label-xs mt-1">
                                    {lang === 'hi' ? 'कम से कम 1 दिन चुनें' : 'Select at least 1 day'}
                                </p>
                            )}
                        </div>
                    </div>
                ))}

                {windows.length < 5 && (
                    <button
                        type="button"
                        onClick={addWindow}
                        className="w-full py-3 border-2 border-dashed border-kridha-primary/40 rounded-xl text-label-md text-kridha-primary hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-colors"
                    >
                        + {lang === 'hi' ? 'और window जोड़ें' : 'Add another window'}
                    </button>
                )}
            </div>
        );
    }

    // ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
    // Steps: 0=Store Info, 1=Bank Details, 2=Pickup Windows, 3=Confirm & Submit
    export default function RegisterAsSellerPage() {
        const router = useRouter();
        const { lang } = useLangStore();
        const tSeller = useTranslations('sellerProfile');
        const tError = useTranslations('errors');

        // ── State ────────────────────────────────────────────────────────────────
        const [step, setStep] = useState(0);
        const [loading, setLoading] = useState(false);
        const [formError, setFormError] = useState<string | null>(null);
        const [success, setSuccess] = useState(false);
        const [loadingPincode, setLoadingPincode] = useState(false);
        const [pincodeError, setPincodeError] = useState<string | null>(null);
        const [windows, setWindows] = useState<PickupWindowDraft[]>(DEFAULT_WINDOWS);

        // ── Pincode cache — avoids re-fetching same pincode on every blur ────────
        const pincodeCache = useRef<Record<string, { city: string; state: string }>>({});

        // ── Form ─────────────────────────────────────────────────────────────────
        const {
            register,
            handleSubmit,
            watch,
            setValue,
            trigger,
            formState: { errors },
        } = useForm<RegisterAsSellerInput>({
            resolver: zodResolver(RegisterAsSellerSchema),
            defaultValues: { businessType: 'INDIVIDUAL' },
        });

        const businessType = watch('businessType');

        // ── Step field map for per-step validation ───────────────────────────────
        const STEP_FIELDS: (keyof RegisterAsSellerInput)[][] = [
            ['storeName', 'street', 'city', 'state', 'pincode', 'businessType', 'panNo'],
            ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName'],
            // Step 2 (pickup windows) is managed outside react-hook-form
            // Step 3 is confirm — no new fields, just submit
        ];

        // ── Pincode auto-fill with cache ─────────────────────────────────────────
        const handlePincodeBlur = useCallback(async (pincode: string) => {
            if (!/^\d{6}$/.test(pincode)) return;

            // Cache hit — no network call needed
            if (pincodeCache.current[pincode]) {
                const cached = pincodeCache.current[pincode];
                setValue('city', cached.city, { shouldValidate: true });
                setValue('state', cached.state, { shouldValidate: true });
                setPincodeError(null);
                return;
            }

            setLoadingPincode(true);
            setPincodeError(null);

            // AbortController — cancel if user types another pincode quickly
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);  // 5s timeout for low connectivity

            try {
                const res = await fetch(`/api/pincode?pincode=${pincode}`, {
                    signal: controller.signal,
                });

                if (!res.ok) {
                    // Pincode not found — let user fill manually (don't block)
                    setPincodeError(lang === 'hi' ? 'Pincode नहीं मिला — manually भरें' : 'Pincode not found — fill manually');
                    return;
                }

                const data = await res.json() as { city: string; state: string };
                // Store in cache
                pincodeCache.current[pincode] = data;
                setValue('city', data.city, { shouldValidate: true });
                setValue('state', data.state, { shouldValidate: true });
                setPincodeError(null);

            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    // Timeout — low connectivity
                    setPincodeError(lang === 'hi' ? 'Network slow — manually भरें' : 'Network slow — fill manually');
                } else {
                    setPincodeError(lang === 'hi' ? 'Network error — manually भरें' : 'Network error — fill manually');
                }
                // Crucially: city and state fields remain editable so user can fill them manually
            } finally {
                clearTimeout(timeout);
                setLoadingPincode(false);
            }
        }, [lang, setValue]);

        // ── Pickup window validation ─────────────────────────────────────────────
        function validateWindows(): string | null {
            for (let i = 0; i < windows.length; i++) {
                const w = windows[i];
                if (!w.labelHi.trim()) return lang === 'hi' ? `Window ${i + 1}: Hindi label जरूरी है` : `Window ${i + 1}: Hindi label required`;
                if (!w.labelEn.trim()) return lang === 'hi' ? `Window ${i + 1}: English label जरूरी है` : `Window ${i + 1}: English label required`;
                if (!w.startTime) return lang === 'hi' ? `Window ${i + 1}: Start time जरूरी है` : `Window ${i + 1}: Start time required`;
                if (!w.endTime) return lang === 'hi' ? `Window ${i + 1}: End time जरूरी है` : `Window ${i + 1}: End time required`;
                if (w.endTime <= w.startTime) return lang === 'hi' ? `Window ${i + 1}: End time शुरू से बाद होना चाहिए` : `Window ${i + 1}: End time must be after start time`;
                if (w.daysActive.length === 0) return lang === 'hi' ? `Window ${i + 1}: कम से कम 1 दिन चुनें` : `Window ${i + 1}: Select at least 1 day`;
            }
            return null;
        }

        // ── Step navigation ──────────────────────────────────────────────────────
        async function goNext() {
            setFormError(null);

            if (step < STEP_FIELDS.length) {
                const valid = await trigger(STEP_FIELDS[step] as (keyof RegisterAsSellerInput)[]);
                if (!valid) return;
            }

            // Validate pickup windows before moving to confirm step
            if (step === 2) {
                const windowErr = validateWindows();
                if (windowErr) { setFormError(windowErr); return; }
                setValue("pickupWindows", windows as AddPickupWindowInput[]); // 🔥 FIX
            }

            setStep(s => s + 1);
        }

        // ── Submit ────────────────────────────────────────────────────────────────
        async function onSubmit(values: RegisterAsSellerInput) {
            setFormError(null);
            setLoading(true);

            // Final window validation before submit
            const windowErr = validateWindows();
            if (windowErr) { setFormError(windowErr); setStep(2); setLoading(false); return; }

            try {
                // Step 1: Register as seller
                const res = await fetch('/api/auth/register-as-seller', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values),
                });
                const data = await res.json();

                if (res.status === 401) {
                    router.push('/login?redirect=/seller-registration');
                    return;
                }
                if (res.status === 409) {
                    setFormError(tError('STORE_EXISTS'));
                    setStep(0);
                    return;
                }
                if (!res.ok) {
                    setFormError(tError('INTERNAL_ERROR'));
                    return;
                }
                setSuccess(true);
                setTimeout(() => router.push('/?success=true'), 2500);

            } catch {
                setFormError(tError('NETWORK_ERROR'));
            } finally {
                setLoading(false);
            }
        }

        // ── Success state ─────────────────────────────────────────────────────────
        if (success) {
            return (
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center">
                        <svg className="w-8 h-8 text-success-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-h4 font-bold text-[var(--color-text)]">{tSeller('SUBMITTED')}</h2>
                    <p className="text-body-sm text-muted-DEFAULT dark:text-muted-dark max-w-xs">{tSeller('VERIFICATION_PENDING')}</p>
                    <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark animate-pulse-slow">{tSeller('REDIRECT')}</p>
                </div>
            );
        }

        const STEP_LABELS = [
            lang === 'hi' ? 'Store Info' : 'Store Info',
            lang === 'hi' ? 'Bank Details' : 'Bank Details',
            lang === 'hi' ? 'Pickup Times' : 'Pickup Times',
            lang === 'hi' ? 'Confirm' : 'Confirm',
        ];

        return (
            <div className="flex flex-col gap-4">
                <div className="bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal border border-[var(--color-border)] p-6 sm:p-8">

                    {/* Title */}
                    <div className="mb-6">
                        <h1 className="text-h3 font-bold text-[var(--color-text)]">{tSeller('REGISTER_AS_SELLER')}</h1>
                        <p className="text-body-sm text-muted-DEFAULT dark:text-muted-dark mt-1">{tSeller('RECEIVE_ADVANCE')}</p>
                    </div>

                    {/* Step indicator — 4 steps now */}
                    <StepIndicator current={step} total={4} />

                    {/* Step labels */}
                    <div className="flex justify-between text-label-xs mb-6 px-1">
                        {STEP_LABELS.map((label, i) => (
                            <span key={i} className={i === step ? 'text-kridha-primary font-semibold' : 'text-muted-DEFAULT dark:text-muted-dark'}>
                                {label}
                            </span>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                        {/* ══════════════════ STEP 0 — Store Info ══════════════════════════ */}
                        {step === 0 && (
                            <div className="space-y-5 animate-fade-up">
                                <Input
                                    label={tSeller('STORE_NAME_LABEL')}
                                    placeholder={tSeller('STORE_NAME_PLACEHOLDER')}
                                    {...register('storeName')}
                                    error={errors.storeName ? tSeller('STORE_NAME_SHORT') : undefined}
                                />
                                <Input
                                    label={tSeller('STREET_LABEL')}
                                    placeholder={tSeller('STREET_PLACEHOLDER')}
                                    {...register('street')}
                                    error={errors.street ? tSeller('STREET_SHORT') : undefined}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label={tSeller('LINE2_LABEL')}
                                        placeholder={tSeller('LINE2_PLACEHOLDER')}
                                        {...register('line2')}
                                    />
                                    <Input
                                        label={tSeller('LANDMARK_LABEL')}
                                        placeholder={tSeller('LANDMARK_PLACEHOLDER')}
                                        {...register('landmark')}
                                    />
                                </div>

                                {/* Pincode first — triggers city/state auto-fill */}
                                <div>
                                    <Input
                                        label={tSeller('PINCODE_LABEL')}
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="226018"
                                        {...register('pincode')}
                                        onBlur={e => handlePincodeBlur(e.target.value)}
                                        error={errors.pincode ? tSeller('PINCODE_INVALID') : undefined}
                                    />
                                    {/* Pincode feedback — below the field, not inside a grid cell */}
                                    {loadingPincode && (
                                        <p className="text-label-xs text-kridha-primary mt-1 flex items-center gap-1.5">
                                            <span className="w-3 h-3 border-2 border-kridha-primary/30 border-t-kridha-primary rounded-full animate-spin inline-block" />
                                            {lang === 'hi' ? 'Location ढूंढ रहे हैं...' : 'Fetching location...'}
                                        </p>
                                    )}
                                    {pincodeError && !loadingPincode && (
                                        <p className="text-label-xs text-warning-dark dark:text-warning mt-1">{pincodeError}</p>
                                    )}
                                </div>

                                {/* City + State below pincode — auto-filled but editable */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label={tSeller('CITY_LABEL')}
                                        placeholder="Lucknow"
                                        {...register('city')}
                                        error={errors.city ? tSeller('CITY_SHORT') : undefined}
                                    />
                                    <div>
                                        <label className="text-label-md font-medium text-[var(--color-text)] mb-1.5 block">
                                            {tSeller('STATE_LABEL')}
                                        </label>
                                        <select
                                            {...register('state')}
                                            className="w-full px-3 py-2.5 rounded-lg border border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 transition-all min-h-touch"
                                        >
                                            <option value="">{lang === 'hi' ? 'राज्य चुनें' : 'Select state'}</option>
                                            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        {errors.state && (
                                            <p className="text-error text-label-xs mt-1">{tSeller('STATE_SHORT')}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Business type */}
                                <div>
                                    <p className="text-label-md font-medium text-[var(--color-text)] mb-2">{tSeller('BUSINESS_TYPE_LABEL')}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {BUSINESS_TYPES.map(bt => (
                                            <button
                                                key={bt.value}
                                                type="button"
                                                onClick={() => setValue('businessType', bt.value)}
                                                className={`px-3 py-2.5 rounded-lg border-2 text-label-sm font-medium text-left transition-all min-h-touch ${businessType === bt.value
                                                    ? 'border-kridha-primary bg-kridha-secondary dark:bg-kridha-primary/20 text-kridha-primary'
                                                    : 'border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT dark:text-muted-dark hover:border-kridha-primary/50'
                                                    }`}
                                            >
                                                {lang === 'hi' ? bt.hi : bt.en}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label={tSeller('GST_LABEL')}
                                        placeholder="22AAAAA0000A1Z5"
                                        {...register('gstNo')}
                                    />
                                    <Input
                                        label={tSeller('PAN_LABEL')}
                                        placeholder="ABCDE1234F"
                                        {...register('panNo', {
                                            onChange: (e) => {
                                                e.target.value = e.target.value.toUpperCase();
                                            },
                                        })}
                                        error={errors.panNo ? tSeller('PAN_INVALID') : undefined}
                                    />
                                </div>

                                <Button type="button" variant="primary" size="lg" className="w-full" onClick={goNext}>
                                    {tSeller('NEXT_BANK')}
                                </Button>
                            </div>
                        )}

                        {/* ══════════════════ STEP 1 — Bank Details ════════════════════════ */}
                        {step === 1 && (
                            <div className="space-y-5 animate-fade-up">
                                <div className="bg-kridha-secondary dark:bg-kridha-primary/15 border border-kridha-primary/30 rounded-xl p-4 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-kridha-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-label-sm text-kridha-primary dark:text-kridha-primary/90 leading-relaxed">
                                        {tSeller('BANK_INFO_NOTE')}
                                    </p>
                                </div>

                                <Input
                                    label={tSeller('ACCOUNT_HOLDER_LABEL')}
                                    placeholder={tSeller('ACCOUNT_HOLDER_PLACEHOLDER')}
                                    {...register('accountHolderName')}
                                    error={errors.accountHolderName ? tSeller('ACCOUNT_NAME_SHORT') : undefined}
                                />
                                <Input
                                    label={tSeller('ACCOUNT_NUMBER_LABEL')}
                                    inputMode="numeric"
                                    placeholder="11223344556677"
                                    {...register('accountNumber')}
                                    error={errors.accountNumber ? tSeller('ACCOUNT_INVALID') : undefined}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label={tSeller('IFSC_LABEL')}
                                        placeholder="SBIN0001234"
                                        style={{ textTransform: 'uppercase' }}
                                        {...register('ifscCode')}
                                        error={errors.ifscCode ? tSeller('IFSC_INVALID') : undefined}
                                    />
                                    <Input
                                        label={tSeller('BANK_NAME_LABEL')}
                                        placeholder={tSeller('BANK_NAME_PLACEHOLDER')}
                                        {...register('bankName')}
                                        error={errors.bankName ? tSeller('BANK_SHORT') : undefined}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => { setStep(0); setFormError(null); }}>
                                        ← {tSeller('BACK')}
                                    </Button>
                                    <Button type="button" variant="primary" size="lg" className="flex-1" onClick={goNext}>
                                        {tSeller('NEXT_WINDOWS')} →
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* ══════════════════ STEP 2 — Pickup Windows ══════════════════════ */}
                        {step === 2 && (
                            <div className="space-y-5 animate-fade-up">
                                {/* Explanation banner */}
                                <div className="bg-kridha-secondary dark:bg-kridha-primary/15 border border-kridha-primary/30 rounded-xl p-4 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-kridha-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <p className="text-label-sm font-semibold text-kridha-primary">{lang === 'hi' ? 'Pickup Windows क्या है?' : 'What are Pickup Windows?'}</p>
                                        <p className="text-label-sm text-kridha-primary/80 dark:text-kridha-primary/70 mt-0.5 leading-relaxed">
                                            {lang === 'hi'
                                                ? 'वो time slots जब buyers आपसे सामान pick up कर सकते हैं। जैसे: सुबह 7-12 बजे, सोमवार से शनिवार।'
                                                : 'Time slots when buyers can pick up goods from you. E.g. Morning 7-12, Mon-Sat.'}
                                        </p>
                                    </div>
                                </div>

                                <PickupWindowEditor
                                    windows={windows}
                                    onChange={setWindows}
                                    lang={lang}
                                />

                                {formError && (
                                    <div className="bg-error-light border border-error/30 rounded-xl px-4 py-3 text-label-sm text-error-dark">
                                        {formError}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => { setStep(1); setFormError(null); }}>
                                        ← {tSeller('BACK')}
                                    </Button>
                                    <Button type="button" variant="primary" size="lg" className="flex-1" onClick={goNext}>
                                        {lang === 'hi' ? 'Review करें →' : 'Review →'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* ══════════════════ STEP 3 — Confirm & Submit ════════════════════ */}
                        {step === 3 && (
                            <div className="space-y-5 animate-fade-up">
                                <p className="text-body-sm text-muted-DEFAULT dark:text-muted-dark">{tSeller('VERIFY_BEFORE_SUBMIT')}</p>

                                {/* Store summary */}
                                <div className="bg-background-DEFAULT dark:bg-background-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
                                    <div className="px-4 py-3 bg-kridha-secondary dark:bg-kridha-primary/10 border-b border-border-DEFAULT dark:border-border-dark">
                                        <p className="text-label-md font-semibold text-kridha-primary">{tSeller('STORE_DETAILS_SECTION')}</p>
                                    </div>
                                    <div className="px-4 py-3 space-y-2">
                                        <SummaryRow label={tSeller('FIELD_NAME')} value={watch('storeName')} />
                                        <SummaryRow label={tSeller('FIELD_ADDRESS')} value={`${watch('street')}, ${watch('city')}, ${watch('state')} - ${watch('pincode')}`} />
                                        <SummaryRow label={tSeller('FIELD_BUSINESS_TYPE')} value={BUSINESS_TYPES.find(b => b.value === businessType)?.[lang === 'hi' ? 'hi' : 'en']} />
                                        <SummaryRow label="PAN" value={watch('panNo')} />
                                    </div>
                                </div>

                                {/* Bank summary */}
                                <div className="bg-background-DEFAULT dark:bg-background-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
                                    <div className="px-4 py-3 bg-kridha-secondary dark:bg-kridha-primary/10 border-b border-border-DEFAULT dark:border-border-dark">
                                        <p className="text-label-md font-semibold text-kridha-primary">{tSeller('BANK_DETAILS_SECTION')}</p>
                                    </div>
                                    <div className="px-4 py-3 space-y-2">
                                        <SummaryRow label={tSeller('accountHolderName')} value={watch('accountHolderName')} />
                                        <SummaryRow label={tSeller('accountNumber')} value={`****${watch('accountNumber')?.slice(-4)}`} />
                                        <SummaryRow label={tSeller('ifscCode')} value={watch('ifscCode')} />
                                        <SummaryRow label={tSeller('bankName')} value={watch('bankName')} />
                                    </div>
                                </div>

                                {/* Pickup windows summary */}
                                <div className="bg-background-DEFAULT dark:bg-background-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
                                    <div className="px-4 py-3 bg-kridha-secondary dark:bg-kridha-primary/10 border-b border-border-DEFAULT dark:border-border-dark">
                                        <p className="text-label-md font-semibold text-kridha-primary">
                                            {lang === 'hi' ? '⏰ Pickup Windows' : '⏰ Pickup Windows'}
                                        </p>
                                    </div>
                                    <div className="px-4 py-3 space-y-2">
                                        {windows.map((w, i) => (
                                            <SummaryRow
                                                key={i}
                                                label={lang === 'hi' ? w.labelHi : w.labelEn}
                                                value={`${w.startTime}–${w.endTime} · ${w.daysActive.map(d => DAYS.find(x => x.value === d)?.[lang === 'hi' ? 'hi' : 'en']).join(' ')}`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Terms note */}
                                <div className="bg-kridha-accent/10 border border-kridha-accent/30 rounded-xl p-4">
                                    <p className="text-label-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
                                        {tSeller('SUBMIT_WARNING')}
                                    </p>
                                </div>

                                {formError && (
                                    <div className="bg-error-light border border-error/30 rounded-xl px-4 py-3 text-label-sm text-error-dark">
                                        {formError}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => { setStep(2); setFormError(null); }}>
                                        ← {tSeller('BACK')}
                                    </Button>
                                    <Button type="submit" variant="primary" size="lg" className="flex-1" loading={loading}>
                                        {tSeller('SUBMIT')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </form>

                    {step === 0 && (
                        <p className="text-center text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-6">
                            {tSeller('ALREADY_HAVE_ACCOUNT')}
                            <Link href="/login" className="text-kridha-primary hover:underline font-semibold ml-1">
                                {tSeller('LOGIN')}
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        );
    }
