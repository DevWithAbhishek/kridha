'use client';

import { useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trash2, Upload, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import { AddProductBaseSchema } from '@/schemas';
import { ProductCategory, ProductUnit } from '@prisma/client';
import { useLangStore } from '@/stores/langStore';
import { useGeolocation } from '@/hooks/useGeolocation';
import { api } from '@/lib/api';

const AddProductFormSchema = AddProductBaseSchema.omit({
    latitude: true,
    longitude: true,
});

// Extracted from Cloudinary widget result
interface UploadedImage {
    url: string;  // secure_url
    publicId: string;  // public_id — needed for deletion
}

type FormValues = z.input<typeof AddProductFormSchema>;

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
}

// ── Cloudinary signed upload helper ─────────────────────────────────────────
// Browser sends the file directly to Cloudinary using a server-issued signature.
// The API secret never touches the client.
async function uploadToCloudinary(
    file: File,
    folder: string = "products",
): Promise<UploadedImage> {
    // 1. Get signature from Kridha server
    const { data: sigData } = await api.post<{
        success: true;
        data: { signature: string; timestamp: number; cloudName: string; apiKey: string; folder: string };
    }>('/upload/sign', { folder });

    const { signature, timestamp, cloudName, apiKey, folder: signedFolder } = sigData.data;

    // 2. Upload directly to Cloudinary
    const form = new FormData();
    form.append('file', file);
    form.append('signature', signature);
    form.append('timestamp', String(timestamp));
    form.append('api_key', apiKey);
    form.append('folder', signedFolder);

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: form },
    );

    if (!res.ok) throw new Error('Cloudinary upload failed');

    const data = await res.json() as { secure_url: string; public_id: string };
    return { url: data.secure_url, publicId: data.public_id };
}

// ── Delete from Cloudinary via Kridha destroy route ─────────────────────────
async function deleteFromCloudinary(publicId: string): Promise<void> {
    await api.delete('/upload/destroy', { data: { publicId } });
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${i + 1 === current ? 'bg-kridha-primary' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
export function AddProductModal({ open, onClose, onSave }: Props) {
    const { lang } = useLangStore();
    const { lat, lng } = useGeolocation();

    const [images, setImages] = useState<UploadedImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadErr, setUploadErr] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [submitErr, setSubmitErr] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        control,
        trigger,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<FormValues>({
        resolver: zodResolver(AddProductFormSchema),
        defaultValues: {
            priceTiers: [{ minQty: 1, pricePerUnit: 0 }],
            isBranded: false,
            available: 0,
            minOrderQuantity: 1,
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'priceTiers' });

    // ── Step validation before advancing ─────────────────────────────────────
    // Validates only the fields on the current step — prevents advancing with errors.
    const STEP_FIELDS: (keyof FormValues)[][] = [
        ['nameEn', 'nameHi', 'category', 'unit', 'unitIncrement'],
        ['available', 'minOrderQuantity', 'priceTiers'],
        [],
    ];

    async function goNext() {
        const valid = await trigger(STEP_FIELDS[step - 1] as (keyof FormValues)[]);
        if (valid) setStep(s => s + 1);
    }

    // ── File input handler — signed upload ────────────────────────────────────
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;

        // Limit total images to 5
        if (images.length + files.length > 5) {
            setUploadErr(lang === 'hi' ? 'अधिकतम 5 images allowed' : 'Maximum 5 images allowed');
            return;
        }

        setUploading(true);
        setUploadErr(null);

        try {
            const results = await Promise.all(files.map(f => uploadToCloudinary(f, 'products')));
            setImages(prev => [...prev, ...results]);
        } catch {
            setUploadErr(lang === 'hi' ? 'Upload failed — retry करें' : 'Upload failed — please retry');
        } finally {
            setUploading(false);
            e.target.value = ''; // reset input so same file can be re-selected after error
        }
    }, [images.length, lang]);

    // ── Remove image — deletes from Cloudinary too ────────────────────────────
    async function removeImage(index: number) {
        const img = images[index];
        setImages(prev => prev.filter((_, i) => i !== index));
        // Best-effort delete — don't block UI if it fails
        deleteFromCloudinary(img.publicId).catch(() => null);
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    async function onSubmit(values: FormValues) {
        setSubmitErr(null);
        console.log("Product api called");
        try {
            if (!lat || !lng) {
                setSubmitErr("Location not ready");
                return;
            }

            const res = await api.post('/products', {
                ...values,
                imageUrls: images.map(i => i.url),
                latitude: lat,
                longitude: lng,
            });
            console.log("Res generated", res);

            if (res.status === 201) {
                onSave();
                handleClose();
            }
        } catch (err) {
            console.log(err);
            setSubmitErr(lang === 'hi' ? 'Product add नहीं हुआ — retry करें' : 'Failed to add product — please retry');
        }
    }

    function handleClose() {
        reset();
        setImages([]);
        setStep(1);
        setSubmitErr(null);
        setUploadErr(null);
        onClose();
    }

    const CATEGORIES = Object.values(ProductCategory);
    const UNITS = Object.values(ProductUnit);
    console.log(errors);

    return (
        <Dialog.Root open={open} onOpenChange={o => !o && handleClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
                <Dialog.Content className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-2xl bg-[var(--color-surface)] rounded-t-modal sm:rounded-modal p-6 shadow-modal z-modal max-h-[90vh] overflow-y-auto">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-h5 font-bold">
                            {lang === 'hi' ? 'Product जोड़ें' : 'Add Product'}
                        </Dialog.Title>
                        <button onClick={handleClose} aria-label="Close"><X className="w-5 h-5" /></button>
                    </div>

                    <StepDots current={step} total={3} />

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                        {/* ── STEP 1: Basic Info ─────────────────────────────────────── */}
                        {step === 1 && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label="Name (English) *"
                                        {...register('nameEn')}
                                        error={errors.nameEn?.message}
                                    />
                                    <Input
                                        label="Name (Hindi) *"
                                        {...register('nameHi')}
                                        error={errors.nameHi?.message}
                                    />
                                </div>

                                <Input
                                    label="Description"
                                    {...register('description')}
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-label-md font-medium block mb-1">Category *</label>
                                        <select
                                            {...register('category')}
                                            className="w-full border border-border-DEFAULT dark:border-border-dark rounded-lg px-3 py-2.5 bg-[var(--color-surface)] text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary"
                                        >
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        {errors.category && <p className="text-error text-label-xs mt-1">{errors.category.message}</p>}
                                    </div>

                                    <div>
                                        <label className="text-label-md font-medium block mb-1">Unit *</label>
                                        <select
                                            {...register('unit')}
                                            className="w-full border border-border-DEFAULT dark:border-border-dark rounded-lg px-3 py-2.5 bg-[var(--color-surface)] text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary"
                                        >
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                        {errors.unit && <p className="text-error text-label-xs mt-1">{errors.unit.message}</p>}
                                    </div>
                                </div>

                                <Input
                                    label="Unit Increment *"
                                    type="number"
                                    {...register('unitIncrement', { valueAsNumber: true })}
                                    error={errors.unitIncrement?.message}
                                />

                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" {...register('isBranded')} className="w-4 h-4 rounded" />
                                    <span className="text-body-sm">Branded Product</span>
                                </label>

                                <Button type="button" variant="primary" size="lg" className="w-full" onClick={goNext}>
                                    {lang === 'hi' ? 'आगे →' : 'Next →'}
                                </Button>
                            </>
                        )}

                        {/* ── STEP 2: Stock & Pricing ────────────────────────────────── */}
                        {step === 2 && (
                            <>
                                <div className="grid grid-cols-3 gap-3">
                                    <Input
                                        label="Available *"
                                        type="number"
                                        {...register('available', { valueAsNumber: true })}
                                        error={errors.available?.message}
                                    />
                                    <Input
                                        label="Min Qty *"
                                        type="number"
                                        {...register('minOrderQuantity', { valueAsNumber: true })}
                                        error={errors.minOrderQuantity?.message}
                                    />
                                    <Input
                                        label="Max Qty"
                                        type="number"
                                        {...register('maxOrderQuantity', { valueAsNumber: true })}
                                        error={errors.maxOrderQuantity?.message}
                                    />
                                </div>

                                {/* Price tiers */}
                                <div>
                                    <p className="text-label-md font-semibold mb-2">Price Tiers *</p>
                                    <div className="space-y-2">
                                        {fields.map((field, i) => (
                                            <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                                <Input
                                                    label={i === 0 ? 'Min Qty' : ''}
                                                    type="number"
                                                    placeholder="Min qty"
                                                    {...register(`priceTiers.${i}.minQty`, { valueAsNumber: true })}
                                                    error={errors.priceTiers?.[i]?.minQty?.message}
                                                />
                                                <Input
                                                    label={i === 0 ? 'Price / Unit (₹)' : ''}
                                                    type="number"
                                                    placeholder="₹ per unit"
                                                    {...register(`priceTiers.${i}.pricePerUnit`, { valueAsNumber: true })}
                                                    error={errors.priceTiers?.[i]?.pricePerUnit?.message}
                                                />
                                                {fields.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(i)}
                                                        className="mb-0.5 p-2 text-error hover:bg-error-light rounded-lg"
                                                        aria-label="Remove tier"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-2"
                                        onClick={() => append({ minQty: 1, pricePerUnit: 0 })}
                                    >
                                        + Add Tier
                                    </Button>
                                </div>

                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
                                    <Button type="button" variant="primary" size="lg" className="flex-1" onClick={goNext}>{lang === 'hi' ? 'आगे →' : 'Next →'}</Button>
                                </div>
                            </>
                        )}

                        {/* ── STEP 3: Images & Location ─────────────────────────────── */}
                        {step === 3 && (
                            <>
                                {/* Image upload area */}
                                <div>
                                    <p className="text-label-md font-semibold mb-2">
                                        {lang === 'hi' ? 'Product Images (अधिकतम 5)' : 'Product Images (max 5)'}
                                    </p>

                                    {/* Uploaded image previews */}
                                    {images.length > 0 && (
                                        <div className="flex gap-2 flex-wrap mb-3">
                                            {images.map((img, i) => (
                                                <div key={img.publicId} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border-DEFAULT">
                                                    <Image
                                                        src={img.url}
                                                        alt={`product ${i + 1}`}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeImage(i)}
                                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                        aria-label="Remove image"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Upload button — file input triggers signed upload */}
                                    {images.length < 5 && (
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                multiple
                                                className="sr-only"
                                                onChange={handleFileChange}
                                                disabled={uploading}
                                            />
                                            <div className={`flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl text-body-sm transition-colors w-fit ${uploading
                                                    ? 'border-kridha-primary/40 text-kridha-primary animate-pulse'
                                                    : 'border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary text-muted-DEFAULT'
                                                }`}>
                                                {uploading
                                                    ? <><Loader2 className="w-4 h-4 animate-spin" />{lang === 'hi' ? 'Upload हो रहा है...' : 'Uploading...'}</>
                                                    : <><Upload className="w-4 h-4" />{lang === 'hi' ? 'Images चुनें' : 'Choose images'}</>
                                                }
                                            </div>
                                        </label>
                                    )}

                                    {uploadErr && (
                                        <p className="text-error text-label-xs mt-1">{uploadErr}</p>
                                    )}
                                </div>

                                {/* Location status */}
                                <div className="text-label-sm text-muted-DEFAULT dark:text-muted-dark flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full inline-block ${lat && lng ? 'bg-success-dark' : 'bg-amber-400 animate-pulse'}`} />
                                    {lat && lng
                                        ? `${lang === 'hi' ? 'Location मिली:' : 'Location:'} ${lat.toFixed(4)}, ${lng.toFixed(4)}`
                                        : (lang === 'hi' ? 'Location detect हो रही है...' : 'Detecting location...')}
                                </div>

                                {submitErr && (
                                    <div className="bg-error-light border border-error/30 rounded-xl px-4 py-3 text-label-sm text-error-dark">
                                        {submitErr}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
                                    <Button type="submit" variant="primary" size="lg" className="flex-1" loading={isSubmitting}>
                                        {lang === 'hi' ? 'Product जोड़ें' : 'Add Product'}
                                    </Button>
                                </div>
                            </>
                        )}

                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
