'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trash2, Upload, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import { UpdateProductSchema } from '@/schemas';
import { ProductCategory, ProductUnit } from '@prisma/client';
import { useLangStore } from '@/stores/langStore';
import { api } from '@/lib/api';
import type { ProductWithRelations } from '@/repo/product.repo';
import { encode } from "blurhash";

type FormValues = z.input<typeof UpdateProductSchema>;

interface UploadedImage {
    url: string;
    publicId: string;
    blurHash?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    product: ProductWithRelations;
    onSave: () => void;
}


async function generateBlurHash(file: File) {
    const img = await createImageBitmap(file);

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, 32, 32);

    const imageData = ctx.getImageData(0, 0, 32, 32);

    return encode(imageData.data, 32, 32, 4, 4);
}

async function uploadToCloudinary(file: File): Promise<UploadedImage> {
    // 🔥 1. generate blurhash FIRST
    const blurHash = await generateBlurHash(file);

    // 🔥 2. get signed params
    const { data: sigData } = await api.post<{
        success: true;
        data: { signature: string; timestamp: number; cloudName: string; apiKey: string; folder: string };
    }>('/upload/sign', { folder: 'products' });

    const { signature, timestamp, cloudName, apiKey, folder } = sigData.data;

    // 🔥 3. upload to cloudinary
    const form = new FormData();
    form.append('file', file);
    form.append('signature', signature);
    form.append('timestamp', String(timestamp));
    form.append('api_key', apiKey);
    form.append('folder', folder);

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: form }
    );

    if (!res.ok) throw new Error('Cloudinary upload failed');

    const data = await res.json() as { secure_url: string; public_id: string };

    // 🔥 4. return BOTH
    return {
        url: data.secure_url,
        publicId: data.public_id,
        blurHash,
    };
}

async function deleteFromCloudinary(publicId: string): Promise<void> {
    await api.delete('/upload/destroy', { data: { publicId } });
}

// ── Extract publicId from a Cloudinary URL ────────────────────────────────────
// Existing product images only have a URL, not a publicId stored separately.
// We derive publicId from the URL: .../upload/v123456789/kridha/products/abc.jpg → kridha/products/abc
function urlToPublicId(url: string): string {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    return match?.[1] ?? url;
}

export function EditProductModal({ open, onClose, product, onSave }: Props) {
    const { lang } = useLangStore();

    // Seed images from existing product URLs
    const [images, setImages] = useState<UploadedImage[]>(() =>
        (product.imageUrls ?? []).map(url => ({
            url,
            publicId: urlToPublicId(url),
            blurHash: undefined, 
        }))
    );
    const [uploading, setUploading] = useState(false);
    const [uploadErr, setUploadErr] = useState<string | null>(null);
    const [submitErr, setSubmitErr] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<FormValues>({
        resolver: zodResolver(UpdateProductSchema),
        defaultValues: {
            nameEn: product.nameEn,
            nameHi: product.nameHi ?? '',
            description: product.description ?? '',
            category: product.category as ProductCategory,
            unit: product.unit as ProductUnit,
            unitIncrement: product.unitIncrement,
            isBranded: product.isBranded,
            available: product.available,
            minOrderQty: product.minOrderQuantity,
            maxOrderQty: product.maxOrderQuantity ?? undefined,
            priceTiers: product.priceTiers.map(t => ({
                minQty: t.minQty,
                pricePerUnit: t.pricePerUnit,
            })),
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'priceTiers' });

    // Sync form when product prop changes (e.g. different product opened)
    useEffect(() => {
        reset({
            nameEn: product.nameEn,
            nameHi: product.nameHi ?? '',
            description: product.description ?? '',
            category: product.category as ProductCategory,
            unit: product.unit as ProductUnit,
            unitIncrement: product.unitIncrement,
            isBranded: product.isBranded,
            available: product.available,
            minOrderQty: product.minOrderQuantity,
            maxOrderQty: product.maxOrderQuantity ?? undefined,
            priceTiers: product.priceTiers.map(t => ({
                minQty: t.minQty,
                pricePerUnit: t.pricePerUnit,
            })),
        });
        setImages(
            (product.imageUrls ?? []).map(url => ({
                url,
                publicId: urlToPublicId(url),
                blurHash: undefined,
            }))
        );
        setSubmitErr(null);
        setUploadErr(null);
    }, [product, reset]);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        if (images.length + files.length > 5) {
            setUploadErr(lang === 'hi' ? 'अधिकतम 5 images allowed' : 'Maximum 5 images allowed');
            return;
        }
        setUploading(true);
        setUploadErr(null);
        try {
            const results = await Promise.all(files.map(uploadToCloudinary));
            setImages(prev => [...prev, ...results]);
        } catch {
            setUploadErr(lang === 'hi' ? 'Upload failed — retry करें' : 'Upload failed — please retry');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }, [images.length, lang]);

    async function removeImage(index: number) {
        const img = images[index];
        setImages(prev => prev.filter((_, i) => i !== index));
        deleteFromCloudinary(img.publicId).catch(() => null);
    }

    async function onSubmit(values: FormValues) {
        setSubmitErr(null);
        try {
            await api.patch(`/products/mine/${product.id}`, {
                ...values,
                imageUrls: images.map(i => i.url),
                blurHash:
                    images.find(i => i.blurHash)?.blurHash
                    ?? product.blurHash
                    ?? undefined,
            });
            onSave();
            onClose();
        } catch (err) {
            setSubmitErr(lang === 'hi' ? 'Update नहीं हुआ — retry करें' : 'Update failed — please retry');
        }
    }

    const CATEGORIES = Object.values(ProductCategory);
    const UNITS = Object.values(ProductUnit);

    return (
        <Dialog.Root open={open} onOpenChange={o => !o && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
                <Dialog.Content className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-2xl bg-[var(--color-surface)] rounded-t-modal sm:rounded-modal p-6 shadow-modal z-modal max-h-[90vh] overflow-y-auto">

                    <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-h5 font-bold">
                            {lang === 'hi' ? 'Product Edit करें' : 'Edit Product'}
                        </Dialog.Title>
                        <button onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></button>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                        {/* Basic info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input label="Name (English) *" {...register('nameEn')} error={errors.nameEn?.message} />
                            <Input label="Name (Hindi)"     {...register('nameHi')} error={errors.nameHi?.message} />
                        </div>

                        <Input label="Description" {...register('description')} />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-label-md font-medium block mb-1">Category</label>
                                <select {...register('category')}
                                    className="w-full border border-border-DEFAULT dark:border-border-dark rounded-lg px-3 py-2.5 bg-[var(--color-surface)] text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary">
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-label-md font-medium block mb-1">Unit</label>
                                <select {...register('unit')}
                                    className="w-full border border-border-DEFAULT dark:border-border-dark rounded-lg px-3 py-2.5 bg-[var(--color-surface)] text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary">
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <Input label="Unit Increment" type="number"
                                {...register('unitIncrement', { valueAsNumber: true })}
                                error={errors.unitIncrement?.message} />
                            <Input label="Available" type="number"
                                {...register('available', { valueAsNumber: true })}
                                error={errors.available?.message} />
                            <Input label="Min Qty" type="number"
                                {...register('minOrderQty', { valueAsNumber: true })}
                                error={errors.minOrderQty?.message} />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" {...register('isBranded')} className="w-4 h-4 rounded" />
                            <span className="text-body-sm">Branded Product</span>
                        </label>

                        {/* Price tiers */}
                        <div>
                            <p className="text-label-md font-semibold mb-2">Price Tiers</p>
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
                                            label={i === 0 ? '₹ / Unit' : ''}
                                            type="number"
                                            placeholder="Price"
                                            {...register(`priceTiers.${i}.pricePerUnit`, { valueAsNumber: true })}
                                            error={errors.priceTiers?.[i]?.pricePerUnit?.message}
                                        />
                                        {fields.length > 1 && (
                                            <button type="button" onClick={() => remove(i)}
                                                className="mb-0.5 p-2 text-error hover:bg-error-light rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="mt-2"
                                onClick={() => append({ minQty: 1, pricePerUnit: 0 })}>
                                + Add Tier
                            </Button>
                        </div>

                        {/* Images */}
                        <div>
                            <p className="text-label-md font-semibold mb-2">
                                {lang === 'hi' ? 'Images' : 'Images'}
                            </p>
                            {images.length > 0 && (
                                <div className="flex gap-2 flex-wrap mb-3">
                                    {images.map((img, i) => (
                                        <div key={img.publicId} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border-DEFAULT">
                                            <Image src={img.url} alt={`product ${i + 1}`} fill className="object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Trash2 className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {images.length < 5 && (
                                <label className="cursor-pointer">
                                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple
                                        className="sr-only" onChange={handleFileChange} disabled={uploading} />
                                    <div className={`flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl text-body-sm w-fit transition-colors ${uploading
                                            ? 'border-kridha-primary/40 text-kridha-primary animate-pulse'
                                            : 'border-border-DEFAULT hover:border-kridha-primary text-muted-DEFAULT'
                                        }`}>
                                        {uploading
                                            ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</>
                                            : <><Upload className="w-4 h-4" />Add images</>}
                                    </div>
                                </label>
                            )}
                            {uploadErr && <p className="text-error text-label-xs mt-1">{uploadErr}</p>}
                        </div>

                        {submitErr && (
                            <div className="bg-error-light border border-error/30 rounded-xl px-4 py-3 text-label-sm text-error-dark">
                                {submitErr}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose}>
                                {lang === 'hi' ? 'Cancel' : 'Cancel'}
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                className="flex-1"
                                loading={isSubmitting}
                                disabled={!isDirty && images.map(i => i.url).join() === product.imageUrls.join()}
                            >
                                {lang === 'hi' ? 'Save करें' : 'Save Changes'}
                            </Button>
                        </div>

                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
