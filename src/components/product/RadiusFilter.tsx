'use client';

import { MapPin } from 'lucide-react';

interface RadiusFilterProps {
    value: number;
    onChange: (km: number) => void;
}

const OPTIONS = [5, 10, 20, 50];

export function RadiusFilter({ value, onChange }: RadiusFilterProps) {
    return (
        <div>
            <div className="flex items-center gap-2 text-label-md font-semibold text-text mb-2">
                <MapPin className="w-4 h-4" />
                दूरी
            </div>
            <div className="flex gap-2 flex-wrap">
                {OPTIONS.map((km) => (
                    <button
                        key={km}
                        type="button"
                        onClick={() => onChange(km)}
                        className={`px-4 py-2 rounded-pill text-label-md font-semibold border transition-all ${value === km
                                ? 'bg-kridha-primary text-white border-kridha-primary'
                                : 'bg-background-subtle text-muted border-border hover:border-kridha-primary hover:text-kridha-primary'
                            }`}
                    >
                        {km} km
                    </button>
                ))}
            </div>
        </div>
    );
}