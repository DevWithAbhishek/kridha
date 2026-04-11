'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({
    name: z.string().min(3).max(40),
    city: z.string().optional(),
    preferredLang: z.enum(['hi', 'en']),
});

type FormValues = z.infer<typeof schema>;

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
    user: { name: string; city?: string; preferredLang: 'hi' | 'en' };
    onSave: () => void;
}

export function EditProfileModal({ open, onClose, user, onSave }: EditProfileModalProps) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setValue,
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: user,
    });

    async function onSubmit(values: FormValues) {
        try {
            const res = await fetch('/api/users/me', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            if (res.ok) {
                // Assume toast is handled elsewhere
                onSave();
                onClose();
            }
        } catch {
            // Handle error
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay animate-fade-in" />
                <Dialog.Content className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-md bg-[var(--color-surface)] rounded-t-modal sm:rounded-modal p-6 shadow-modal animate-slide-in-up sm:animate-scale-in z-modal max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-h5 font-bold">प्रोफ़ाइल edit करें</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-btn hover:bg-background-subtle">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <Input
                            label="पूरा नाम"
                            {...register('name')}
                            error={errors.name?.message}
                        />
                        <Input
                            label="शहर"
                            {...register('city')}
                            error={errors.city?.message}
                        />
                        <div>
                            <label className="text-label-sm text-[var(--color-text-muted)]">भाषा</label>
                            <div className="flex gap-2 mt-2">
                                {(['hi', 'en'] as const).map((lang) => (
                                    <button
                                        key={lang}
                                        type="button"
                                        onClick={() => setValue('preferredLang', lang)}
                                        className={`px-4 py-2 rounded-pill text-label-sm transition ${lang === 'hi' ? 'bg-kridha-primary text-white' : 'bg-background-subtle text-[var(--color-text-muted)]'
                                            }`}
                                    >
                                        {lang === 'hi' ? 'हिंदी' : 'English'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="submit" variant="primary" loading={isSubmitting}>
                                Save
                            </Button>
                            <Button type="button" variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}