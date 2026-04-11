"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

type Props = {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
};

export default function EditStoreImageModal({
    open,
    onClose,
    onSave,
}: Props) {
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const MAX_FILES = 5;
    const MAX_SIZE_MB = 5;

    async function upload() {
        try {
            if (!files.length) {
                setError("Please select at least one file");
                return;
            }

            setLoading(true);
            setError(null);

            // 🚀 Parallel uploads (fast)
            await Promise.all(
                files.map(async (file) => {
                    const sign = await fetch("/api/upload/sign").then((r) => r.json());

                    const form = new FormData();
                    form.append("file", file);

                    // ⚠️ If your backend provides extra fields → append here
                    if (sign.fields) {
                        Object.entries(sign.fields).forEach(([key, value]) => {
                            form.append(key, value as string);
                        });
                    }

                    const res = await fetch(sign.url, {
                        method: "POST",
                        body: form,
                    });

                    if (!res.ok) {
                        throw new Error("Upload failed");
                    }
                })
            );

            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            setError("Upload failed. Try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose();
            }}
        >
            <Dialog.Content className="p-6 bg-white rounded shadow max-w-md">

                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                        const selected = Array.from(e.target.files || []);

                        // ✅ Validation
                        const valid = selected.filter(
                            (f) => f.size <= MAX_SIZE_MB * 1024 * 1024
                        );

                        if (valid.length !== selected.length) {
                            setError("Some files exceed 5MB limit");
                        }

                        setFiles(valid.slice(0, MAX_FILES));
                    }}
                />

                {error && (
                    <p className="text-red-500 text-sm mt-2">{error}</p>
                )}

                <button
                    onClick={upload}
                    disabled={loading}
                    className="mt-4 px-4 py-2 bg-primary text-white rounded disabled:opacity-50"
                >
                    {loading ? "Uploading..." : "Save"}
                </button>

            </Dialog.Content>
        </Dialog.Root>
    );
}