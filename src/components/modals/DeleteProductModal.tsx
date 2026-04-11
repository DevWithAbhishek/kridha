"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    productId: string;
    productName: string;
    onConfirm: () => void;
}

export default function DeleteProductModal({
    open,
    onClose,
    productId,
    productName,
    onConfirm,
}: Props) {
    const [error, setError] = useState("");

    async function del() {
        const res = await fetch(`/api/products/${productId}`, {
            method: "DELETE",
            credentials: "include",
        });

        if (res.status === 409) {
            setError("Active orders हैं");
            return;
        }

        onConfirm();
        onClose();
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="p-6 text-center">
                <h3 className="text-error">Product delete करें?</h3>
                <p>{productName}</p>

                {error && <div className="text-error">{error}</div>}

                <button onClick={del}>Delete करें</button>
                <button onClick={onClose}>Cancel</button>
            </Dialog.Content>
        </Dialog.Root>
    );
}