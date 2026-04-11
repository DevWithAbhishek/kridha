"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

type Product = {
    id: string;
    name: string;
    price: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    product: Product;
    onSave: () => void;
};

export default function EditProductModal({
    open,
    onClose,
    product,
    onSave,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: product.name,
        price: product.price,
    });

    async function save() {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`/api/products/${product.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form), // ✅ FIX
            });

            if (!res.ok) {
                throw new Error("Failed to update product");
            }

            onSave();   // refetch
            onClose();  // close modal
        } catch (err) {
            console.error(err);
            setError("Update failed. Try again.");
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

                <h2 className="text-lg font-semibold mb-4">Edit Product</h2>

                {/* Form */}
                <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="border p-2 w-full mb-3"
                />

                <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                        setForm((prev) => ({
                            ...prev,
                            price: Number(e.target.value),
                        }))
                    }
                    className="border p-2 w-full mb-3"
                />

                {/* Error */}
                {error && <p className="text-red-500 text-sm">{error}</p>}

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={save}
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-white rounded disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </div>

            </Dialog.Content>
        </Dialog.Root>
    );
}