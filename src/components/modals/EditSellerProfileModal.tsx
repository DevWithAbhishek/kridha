"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";

interface Form {
    storeName: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
}

type Props = {
    open: boolean;
    onClose: () => void;
    profile: Form;
    onSave: () => void;
};

export default function EditSellerProfileModal({
    open,
    onClose,
    profile,
    onSave,
}: Props) {
    const { register, handleSubmit, reset } = useForm<Form>({
        defaultValues: profile,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ FIX: sync form with new profile
    useEffect(() => {
        reset(profile);
    }, [profile, reset]);

    async function submit(data: Form) {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch("/api/sellers/profile", {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json", // ✅ FIX
                },
                body: JSON.stringify(data),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json?.message || "Update failed");
                return;
            }

            onSave();
            onClose();
        } catch {
            setError("Network error. Try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose(); // ✅ FIX
            }}
        >
            <Dialog.Content className="p-6 bg-white rounded shadow max-w-md">
                <form onSubmit={handleSubmit(submit)} className="space-y-3">

                    <input {...register("storeName")} placeholder="Store Name" />
                    <input {...register("street")} placeholder="Street" />
                    <input {...register("city")} placeholder="City" />
                    <input {...register("state")} placeholder="State" />
                    <input {...register("pinCode")} placeholder="Pincode" />

                    {error && (
                        <p className="text-red-500 text-sm">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-white rounded disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}