"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

export default function EditStoreImageModal({ open, onClose, onSave }: any) {
    const [files, setFiles] = useState<File[]>([]);

    async function upload() {
        for (const file of files) {
            const sign = await fetch("/api/upload/sign").then((r) => r.json());

            const form = new FormData();
            form.append("file", file);

            await fetch(sign.url, { method: "POST", body: form });
        }

        onSave();
        onClose();
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="p-6">
                <input
                    type="file"
                    multiple
                    onChange={(e) => {
                        const f = Array.from(e.target.files || []);
                        setFiles(f.slice(0, 5));
                    }}
                />

                <button onClick={upload}>Save</button>
            </Dialog.Content>
        </Dialog.Root>
    );
}