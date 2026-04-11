'use client';

import { Button } from '@/components/ui/Button';

interface QuantitySelectorProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max?: number;
    step: number;
    unit: string;
    disabled?: boolean;
}

export function QuantitySelector({ value, onChange, min, max, step, unit, disabled }: QuantitySelectorProps) {
    const handleChange = (delta: number) => {
        let newValue = value + delta;
        newValue = Math.max(min, newValue);
        if (max !== undefined) newValue = Math.min(max, newValue);
        // Round to nearest step
        newValue = Math.round(newValue / step) * step;
        onChange(newValue);
    };

    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={() => handleChange(-step)}
                disabled={disabled || value <= min}
                className="w-9 h-9 rounded-btn border border-border flex items-center justify-center bg-kridha-secondary text-kridha-primary hover:bg-kridha-primary/20 transition-colors disabled:opacity-50"
            >
                -
            </button>
            <span className="min-w-16 text-center text-h5 font-bold text-text">
                {value} {unit}
            </span>
            <button
                type="button"
                onClick={() => handleChange(step)}
                disabled={disabled || (max !== undefined && value >= max)}
                className="w-9 h-9 rounded-btn border border-border flex items-center justify-center bg-kridha-secondary text-kridha-primary hover:bg-kridha-primary/20 transition-colors disabled:opacity-50"
            >
                +
            </button>
        </div>
    );
}