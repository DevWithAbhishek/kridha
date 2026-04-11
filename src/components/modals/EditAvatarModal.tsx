"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    currentUrl: string | null;
    onSave: () => void;
}

export default function EditAvatarModal({
    open,
    onClose,
    currentUrl,
    onSave,
}: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(currentUrl);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);

    function handleFile(f: File) {
        if (f.size > 5 * 1024 * 1024) {
            alert("5MB से बड़ी फ़ाइल नहीं");
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    }

    async function upload() {
        if (!file) return;
        setLoading(true);

        try {
            const sign = await fetch("/api/upload/sign", {
                credentials: "include",
            }).then((r) => r.json());

            const formData = new FormData();
            formData.append("file", file);
            formData.append("signature", sign.signature);

            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                setProgress(Math.round((e.loaded / e.total) * 100));
            };

            xhr.open("POST", sign.url);
            xhr.send(formData);

            xhr.onload = async () => {
                const res = JSON.parse(xhr.responseText);

                await fetch("/api/users/me/avatar", {
                    method: "POST",
                    credentials: "include",
                    body: JSON.stringify({
                        url: res.secure_url,
                        publicId: res.public_id,
                    }),
                });

                onSave();
                onClose();
            };
        } catch {
            alert("Upload failed, retry करें");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="p-6 bg-surface rounded-modal text-center">
                <img
                    src={preview || "/profile-default.png"}
                    className="w-24 h-24 rounded-full mx-auto"
                />

                <input
                    type="file"
                    hidden
                    id="avatar"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                    }}
                />

                <button onClick={() => document.getElementById("avatar")?.click()}>
                    फोटो चुनें
                </button>

                {progress > 0 && <div>{progress}%</div>}

                <div className="mt-4 flex gap-3 justify-center">
                    <button disabled={!file || loading} onClick={upload}>
                        Upload
                    </button>
                    <button onClick={onClose}>Cancel</button>
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
}