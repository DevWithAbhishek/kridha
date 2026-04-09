import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-kridha-secondary dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                <div className="text-kridha-primary w-8 h-8">{icon}</div>
            </div>
            <h2 className="text-h5 font-semibold text-text mb-1">{title}</h2>
            {subtitle && <p className="text-body-sm text-muted mb-6">{subtitle}</p>}
            {action && (
                action.href ? (
                    <Button variant="primary" size="md" asChild>
                        <Link href={action.href}>{action.label}</Link>
                    </Button>
                ) : (
                    <Button variant="primary" size="md" onClick={action.onClick}>
                        {action.label}
                    </Button>
                )
            )}
        </div>
    );
}