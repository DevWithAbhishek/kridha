'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({
    nameEn: z.string().min(2).max(100),
    nameHi: z.string().optional(),
    category: z.enum(['GRAINS', 'DAIRY', 'OIL', 'SPICES', 'FLOUR', 'VEGETABLES', 'PULSES', 'BEVERAGES', 'OTHER']),
    unit: z.enum(['KG', 'GRAM', 'LITRE', 'ML', 'PIECE', 'DOZEN', 'QUINTAL', 'TON', 'BUNDLE']),
    unitIncrement: z.number().positive(),
    minOrderQuantity: z.number().positive(),
    available: z.number().nonnegative(),
    priceTiers: z.array(z.object({ minQty: z.number().positive(), pricePerUnit: z.number().positive() })).min(1),
});

type FormValues = z.infer<typeof schema>;

interface AddProductModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
}

function useGeolocation() {
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

    useState(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            () => undefined,
            { maximumAge: 1000 * 60 * 5, timeout: 10000 }
        );
    });

    return { coords };
}

export function AddProductModal({ open, onClose, onSave }: AddProductModalProps) {
    const [step, setStep] = useState(1);
    const { coords } = useGeolocation();

    const {
        register,
        handleSubmit,
        control,
        formState: { errors, isSubmitting },
        watch,
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            priceTiers: [{ minQty: 1, pricePerUnit: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'priceTiers',
    });

    async function onSubmit(values: FormValues) {
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    latitude: coords?.lat,
                    longitude: coords?.lng,
                }),
            });
            if (res.ok) {
                onSave();
                onClose();
            }
        } catch {
            // Handle error
        }
    }

    const nextStep = () => setStep((prev) => prev + 1);
    const prevStep = () => setStep((prev) => prev - 1);

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay animate-fade-in" />
                <Dialog.Content className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-2xl bg-[var(--color-surface)] rounded-t-modal sm:rounded-modal p-6 shadow-modal animate-slide-in-up sm:animate-scale-in z-modal max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-h5 font-bold">Add Product</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-btn hover:bg-background-subtle">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex justify-center gap-2 mb-8">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`w-3 h-3 rounded-full ${s < step ? 'bg-kridha-primary/40' : s === step ? 'bg-kridha-primary' : 'bg-gray-200'
                                    }`}
                            />
                        ))}
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {step === 1 && (
                            <>
                                <Input
                                    label="Name (English)"
                                    {...register('nameEn')}
                                    error={errors.nameEn?.message}
                                />
                                <Input
                                    label="Name (Hindi)"
                                    {...register('nameHi')}
                                    error={errors.nameHi?.message}
                                />
                                <div>
                                    <label className="text-label-sm text-[var(--color-text-muted)]">Category</label>
                                    <select
                                        className="w-full mt-2 rounded-lg border border-[var(--color-border)] bg-surface px-4 py-3"
                                        {...register('category')}
                                    >
                                        <option value="GRAINS">Grains</option>
                                        <option value="DAIRY">Dairy</option>
                                        <option value="OIL">Oil</option>
                                        <option value="SPICES">Spices</option>
                                        <option value="FLOUR">Flour</option>
                                        <option value="VEGETABLES">Vegetables</option>
                                        <option value="PULSES">Pulses</option>
                                        <option value="BEVERAGES">Beverages</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-label-sm text-[var(--color-text-muted)]">Unit</label>
                                    <select
                                        className="w-full mt-2 rounded-lg border border-[var(--color-border)] bg-surface px-4 py-3"
                                        {...register('unit')}
                                    >
                                        <option value="KG">KG</option>
                                        <option value="GRAM">GRAM</option>
                                        <option value="LITRE">LITRE</option>
                                        <option value="ML">ML</option>
                                        <option value="PIECE">PIECE</option>
                                        <option value="DOZEN">DOZEN</option>
                                        <option value="QUINTAL">QUINTAL</option>
                                        <option value="TON">TON</option>
                                        <option value="BUNDLE">BUNDLE</option>
                                    </select>
                                </div>
                                <Input
                                    label="Unit Increment"
                                    type="number"
                                    {...register('unitIncrement', { valueAsNumber: true })}
                                    error={errors.unitIncrement?.message}
                                />
                                <Button type="button" variant="primary" onClick={nextStep}>
                                    Next
                                </Button>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <Input
                                    label="Available Stock"
                                    type="number"
                                    {...register('available', { valueAsNumber: true })}
                                    error={errors.available?.message}
                                />
                                <Input
                                    label="Min Order Quantity"
                                    type="number"
                                    {...register('minOrderQuantity', { valueAsNumber: true })}
                                    error={errors.minOrderQuantity?.message}
                                />
                                <div>
                                    <label className="text-label-sm text-[var(--color-text-muted)]">Price Tiers</label>
                                    <div className="space-y-3 mt-2">
                                        {fields.map((field, index) => (
                                            <div key={field.id} className="flex gap-3 items-end">
                                                <Input
                                                    label="Min Qty"
                                                    type="number"
                                                    {...register(`priceTiers.${index}.minQty`, { valueAsNumber: true })}
                                                />
                                                <Input
                                                    label="Price per Unit"
                                                    type="number"
                                                    {...register(`priceTiers.${index}.pricePerUnit`, { valueAsNumber: true })}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="p-2 rounded-btn hover:bg-error-light"
                                                >
                                                    <Trash2 className="w-4 h-4 text-error" />
                                                </button>
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => append({ minQty: 1, pricePerUnit: 0 })}
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Tier
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button type="button" variant="ghost" onClick={prevStep}>
                                        Back
                                    </Button>
                                    <Button type="button" variant="primary" onClick={nextStep}>
                                        Next
                                    </Button>
                                </div>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <div className="text-body-sm text-muted">
                                    Location: {coords ? `${coords.lat}, ${coords.lng}` : 'Detecting...'}
                                </div>
                                <div className="flex gap-3">
                                    <Button type="button" variant="ghost" onClick={prevStep}>
                                        Back
                                    </Button>
                                    <Button type="submit" variant="primary" loading={isSubmitting}>
                                        Add Product
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