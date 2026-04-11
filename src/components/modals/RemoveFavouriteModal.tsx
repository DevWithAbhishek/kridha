"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    savedId: string;
    productName: string;
    onConfirm: () => void;
}

export default function RemoveFavouriteModal({
    open,
    onClose,
    savedId,
    productName,
    onConfirm,
}: Props) {
    const [loading, setLoading] = useState(false);

    async function remove() {
        setLoading(true);
        await fetch(`/api/saved/${savedId}`, {
            method: "DELETE",
            credentials: "include",
        });
        onConfirm();
        onClose();
        setLoading(false);
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="p-6 bg-surface rounded-modal text-center">
                <h3 className="text-h5">Favourites से हटाएं?</h3>
                <p className="text-muted">{productName} remove होगा</p>

                <div className="mt-4 flex flex-col gap-2">
                    <button onClick={remove} disabled={loading}>
                        हटाएं
                    </button>
                    <button onClick={onClose}>रखें</button>
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
}