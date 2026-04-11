"use client";

import * as Dialog from "@radix-ui/react-dialog";

export default function EditProductModal({
    open,
    onClose,
    product,
    onSave,
}: any) {
    async function save() {
        await fetch(`/api/products/${product.id}`, {
            method: "PATCH",
            credentials: "include",
        });

        onSave();
        onClose();
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content>
                <div>Edit Product</div>
                <button onClick={save}>Save</button>
            </Dialog.Content>
        </Dialog.Root>
    );
}