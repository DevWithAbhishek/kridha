import { useLangStore } from '@/stores/langStore';

export type OrderStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'AWAITING_PAYMENT'
    | 'READY_FOR_OTP_VERIFICATION'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED';

export const STATUS_CONFIG = {
    PENDING: {
        labelHi: 'पेंडिंग',
        labelEn: 'Pending',
        bg: 'bg-warning-light',
        text: 'text-warning-dark',
        dot: 'bg-warning',
    },
    CONFIRMED: {
        labelHi: 'कन्फर्म',
        labelEn: 'Confirmed',
        bg: 'bg-info-light',
        text: 'text-info-dark',
        dot: 'bg-info',
    },
    AWAITING_PAYMENT: {
        labelHi: 'भुगतान का इंतजार',
        labelEn: 'Awaiting Payment',
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        dot: 'bg-orange-500',
    },
    READY_FOR_OTP_VERIFICATION: {
        labelHi: 'ओटीपी तैयार',
        labelEn: 'Ready for OTP',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        dot: 'bg-purple-500',
    },
    COMPLETED: {
        labelHi: 'पूरा हुआ',
        labelEn: 'Completed',
        bg: 'bg-success-light',
        text: 'text-success-dark',
        dot: 'bg-success',
    },
    CANCELLED: {
        labelHi: 'रद्द',
        labelEn: 'Cancelled',
        bg: 'bg-error-light',
        text: 'text-error-dark',
        dot: 'bg-error',
    },
    DISPUTED: {
        labelHi: 'विवादित',
        labelEn: 'Disputed',
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        dot: 'bg-gray-400',
    },
};

interface StatusBadgeProps {
    status: OrderStatus;
    lang?: 'hi' | 'en';
}

export function StatusBadge({ status, lang }: StatusBadgeProps) {
    const { lang: storeLang } = useLangStore();
    const currentLang = lang || storeLang;
    const config = STATUS_CONFIG[status];
    const label = currentLang === 'hi' ? config.labelHi : config.labelEn;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-label-sm font-semibold ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {label}
        </span>
    );
}