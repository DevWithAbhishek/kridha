import { useLangStore } from '@/stores/langStore';
import { getStatusConfig } from '@/lib/statusConfig';
import type { OrderStatus } from '@/types/dashboard';

interface StatusBadgeProps {
    status: OrderStatus;
    lang?: 'hi' | 'en';
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, lang, size = 'md' }: StatusBadgeProps) {
    const { lang: storeLang } = useLangStore();
    const currentLang = lang ?? storeLang;
    const config = getStatusConfig(status);
    const label = currentLang === 'hi' ? config.labelHi : config.labelEn;

    const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-label-sm gap-1' : 'px-2.5 py-1 text-label-md gap-1.5';
    const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

    return (
        <span className={`inline-flex items-center rounded-pill font-semibold border transition-colors ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}>
            <span className={`rounded-full ${config.dot} ${dotSize}`} />
            {label}
        </span>
    );
}