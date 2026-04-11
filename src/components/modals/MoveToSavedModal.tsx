"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Save } from "lucide-react";
import { useState } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    cartItemId: string;
    productName: string;
    onConfirm: () => void;
}

export default function MoveToSavedModal({
    open,
    onClose,
    cartItemId,
    productName,
    onConfirm,
}: Props) {
    const [loading, setLoading] = useState(false);

    async function handleSave() {
        try {
            setLoading(true);

            await fetch(`/api/cart/${cartItemId}`, {
                method: "DELETE",
                credentials: "include",
            });

            await fetch(`/api/saved`, {
                method: "POST",
                credentials: "include",
                body: JSON.stringify({ cartItemId, type: "SAVED_FOR_LATER" }),
            });

            onConfirm();
            onClose();
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="p-6 rounded-modal bg-surface max-w-md mx-auto animate-scale-in">
                <div className="w-12 h-12 mx-auto bg-kridha-secondary rounded-full flex items-center justify-center">
                    <Save />
                </div>

                <h3 className="text-h5 text-center font-bold mt-4">
                    Saved for Later में ले जाएं?
                </h3>

                <p className="text-body-sm text-muted text-center mt-2">
                    {productName} cart से हटकर saved list में जाएगा
                </p>

                <div className="mt-6 flex flex-col gap-3">
                    <button
                        disabled={loading}
                        onClick={handleSave}
                        className="bg-kridha-primary text-white py-2 rounded-btn"
                    >
                        {loading ? "..." : "Save for Later"}
                    </button>

                    <button onClick={onClose} className="py-2">
                        रहने दें
                    </button>
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
}