"use client";

import { useState } from "react";
import PickupWindowForm from "@/components/seller/PickupWindowForm";
import { useFetch } from "@/hooks/useFetch";
import { PickupWindow } from "@/types/dashboard";

export default function PickupWindowsPage() {
    const [editing, setEditing] = useState<PickupWindow | null>(null);

    const { data, loading, error, refetch } = useFetch<PickupWindow[]>(
        "/api/pickup-windows",
        []
    );

    const windows = data;

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error loading pickup windows</div>;

    return (
        <div className="p-4 space-y-4">

            <div className="flex justify-between">
                <h2>Pickup Windows</h2>
                <button onClick={() => setEditing({} as PickupWindow)}>
                    Add Window
                </button>
            </div>

            {windows?.map((w) => (
                <div key={w.id} className="border p-4 rounded-card">
                    <div>{w.labelHi} ({w.labelEn})</div>
                    <div>{w.startTime} - {w.endTime}</div>

                    <button onClick={() => setEditing(w)}>Edit</button>
                </div>
            ))}

            {editing && (
                <PickupWindowForm
                    window={editing}
                    onSave={() => {
                        setEditing(null);
                        refetch(); // ✅ correct
                    }}
                    onCancel={() => setEditing(null)}
                />
            )}
        </div>
    );
}