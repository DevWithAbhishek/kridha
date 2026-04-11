'use client';

import { useLangStore } from '@/stores/langStore';

interface CategoryTabsProps {
    selected: string;
    onChange: (cat: string) => void;
}

const CATEGORIES = [
    { value: '', labelHi: 'सभी', labelEn: 'All' },
    { value: 'OIL', labelHi: 'तेल', labelEn: 'Oil' },
    { value: 'GRAINS', labelHi: 'अनाज', labelEn: 'Grains' },
    { value: 'FLOUR', labelHi: 'आटा', labelEn: 'Flour' },
    { value: 'SPICES', labelHi: 'मसाले', labelEn: 'Spices' },
    { value: 'DAIRY', labelHi: 'डेयरी', labelEn: 'Dairy' },
    { value: 'PULSES', labelHi: 'दाल', labelEn: 'Pulses' },
    { value: 'VEGETABLES', labelHi: 'सब्जी', labelEn: 'Veg' },
    { value: 'OTHER', labelHi: 'अन्य', labelEn: 'Other' },
];

export function CategoryTabs({ selected, onChange }: CategoryTabsProps) {
    const { lang } = useLangStore();

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory">
            {CATEGORIES.map((cat) => {
                const isSelected = selected === cat.value;
                const label = lang === 'hi' ? cat.labelHi : cat.labelEn;
                return (
                    <button
                        key={cat.value}
                        type="button"
                        onClick={() => onChange(cat.value)}
                        className={`snap-start flex-shrink-0 px-4 py-2 rounded-pill text-label-md font-semibold border transition-all min-h-touch ${isSelected
                                ? 'bg-kridha-primary text-white border-kridha-primary'
                                : 'bg-surface dark:bg-surface-dark text-muted border-border hover:border-kridha-primary hover:text-kridha-primary'
                            }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}