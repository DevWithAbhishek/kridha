"use client";

import { useEffect, useState } from "react";

export default function DeleteSellerProfile() {
    const [profile, setProfile] = useState<any>(null);
    const [input, setInput] = useState("");

    useEffect(() => {
        fetch("/api/sellers/profile", { credentials: "include" })
            .then((r) => r.json())
            .then(setProfile);
    }, []);

    if (!profile) return null;

    async function handleDelete() {
        if (input !== profile.storeName) return;

        await fetch("/api/sellers/profile", {
            method: "DELETE",
            credentials: "include",
        });

        window.location.href = "/dashboard";
    }

    return (
        <div className="p-6 max-w-form mx-auto">

            <h3 className="text-error mb-3">
                {profile.storeName} टाइप करें confirm के लिए
            </h3>

            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="border p-2 w-full"
            />

            <button
                disabled={input !== profile.storeName}
                onClick={handleDelete}
                className="bg-error text-white px-4 py-2 mt-4 rounded-btn"
            >
                Delete Seller Profile
            </button>

            <p className="text-muted text-center mt-4">
                आपका buyer account safe रहेगा
            </p>
        </div>
    );
}