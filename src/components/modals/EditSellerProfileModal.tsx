"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";

interface Form {
    storeName: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
}

export default function EditSellerProfileModal({
    open,
    onClose,
    profile,
    onSave,
}: any) {
    const { register, handleSubmit } = useForm<Form>({
        defaultValues: profile,
    });

    async function submit(data: Form) {
        const res = await fetch("/api/sellers/profile", {
            method: "PATCH",
            credentials: "include",
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            alert("Store exists");
            return;
        }

        onSave();
        onClose();
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="p-6">
                <form onSubmit={handleSubmit(submit)}>
                    <input {...register("storeName")} />
                    <input {...register("street")} />
                    <input {...register("city")} />
                    <input {...register("state")} />
                    <input {...register("pinCode")} />

                    <button type="submit">Save</button>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}