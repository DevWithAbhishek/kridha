"use client";

import * as Dialog from "@radix-ui/react-dialog";

interface Props {
    open: boolean;
    onClose: () => void;
    savedId: string;
    productName: string;
    onConfirm: () => void;
    onMoveToCart?: () => void;
}

export default function RemoveSavedModal({
    open,
    onClose,
    savedId,
    onConfirm,
}: Props) {
    async function remove() {
        await fetch(`/api/saved/${savedId}`, {
            method: "DELETE",
            credentials: "include",
        });
        onConfirm();
        onClose();
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="p-6 bg-surface rounded-modal">
                <button onClick={remove}>सिर्फ हटाएं</button>
                <button onClick={onClose}>रद्द करें</button>
            </Dialog.Content>
        </Dialog.Root>
    );
}