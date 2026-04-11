"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z
    .object({
        labelEn: z.string().min(2).max(30),
        labelHi: z.string().min(2).max(30),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        daysActive: z
            .array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]))
            .min(1),
    })
    .refine((d) => d.startTime < d.endTime, {
        message: "End time must be after start",
        path: ["endTime"],
    });

type FormData = z.infer<typeof schema>;
type Day = FormData["daysActive"][number];

type PickupWindow = FormData & {
    id: string;
};

type Props = {
    window?: PickupWindow;
    onSave: () => void;
    onCancel: () => void;
};

export default function PickupWindowForm({
    window,
    onSave,
    onCancel,
}: Props) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: window,
    });

    const days = watch("daysActive") || [];

    function toggleDay(day: Day) {
        const next = days.includes(day)
            ? days.filter((d) => d !== day)
            : [...days, day];
        setValue("daysActive", next);
    }

    async function onSubmit(data: FormData) {
        const method = window ? "PATCH" : "POST";
        const url = window
            ? `/api/pickup-windows/${window.id}`
            : "/api/pickup-windows";

        await fetch(url, {
            method,
            body: JSON.stringify(data),
            credentials: "include",
        });

        onSave();
    }

    const DAY_OPTIONS: Day[] = [
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT",
        "SUN",
    ];

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input {...register("labelEn")} placeholder="English label" />
            <input {...register("labelHi")} placeholder="Hindi label" />

            <div className="flex gap-2">
                {DAY_OPTIONS.map((d) => (
                    <button
                        type="button"
                        key={d}
                        onClick={() => toggleDay(d)}
                        className={`px-3 py-1 rounded-pill ${days.includes(d)
                                ? "bg-kridha-primary text-white"
                                : "bg-gray-200"
                            }`}
                    >
                        {d}
                    </button>
                ))}
            </div>

            <input type="time" {...register("startTime")} />
            <input type="time" {...register("endTime")} />

            <div className="flex gap-3">
                <button type="submit">Save</button>
                <button type="button" onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </form>
    );
}