"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

type Product = {
    id: string;
};

type Props = {
    open: boolean;
    onClose: () => void;
    product?: Product;
    onSave: () => void;
};

export default function ProductFormDialog({
    open,
    onClose,
    product,
    onSave,
}: Props) {
    const [step, setStep] = useState<number>(1);

    async function submit() {
        const method = product ? "PATCH" : "POST";
        const url = product
            ? `/api/products/${product.id}`
            : "/api/products";

        await fetch(url, {
            method,
            credentials: "include",
        });

        onSave();
        onClose();
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="max-w-2xl p-6 bg-surface rounded-modal">
                <div className="flex gap-2 mb-4">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={s === step ? "font-bold" : ""}>
                            Step {s}
                        </div>
                    ))}
                </div>

                {step === 1 && <div>Basic Info</div>}
                {step === 2 && <div>Pricing</div>}
                {step === 3 && <div>Location</div>}

                <div className="flex justify-between mt-6">
                    <button onClick={() => setStep(step - 1)}>Back</button>

                    {step < 3 ? (
                        <button onClick={() => setStep(step + 1)}>Next</button>
                    ) : (
                        <button onClick={submit}>Submit</button>
                    )}
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
}