import { cn } from '@/lib/utils';

interface SkeletonProps {
    variant?: 'text' | 'title' | 'card' | 'avatar' | 'button' | 'stat';
    className?: string;
    count?: number;
}

export function Skeleton({ variant = 'text', className, count = 1 }: SkeletonProps) {
    const baseClasses = 'rounded-md bg-gray-200 dark:bg-gray-700 animate-shimmer bg-shimmer bg-[length:200%_100%]';

    const variantClasses = {
        text: 'h-4 w-full',
        title: 'h-7 w-3/4',
        card: 'h-48 w-full rounded-card',
        avatar: 'h-12 w-12 rounded-full',
        button: 'h-11 w-32 rounded-btn',
        stat: 'h-24 w-full rounded-card',
    };

    const skeletons = Array.from({ length: count }, (_, i) => (
        <div
            key={i}
            className={cn(baseClasses, variantClasses[variant], className)}
        />
    ));

    return <>{skeletons}</>;
}

export function SkeletonCard() {
    return (
        <div className="flex gap-4 p-4 border border-border-DEFAULT rounded-card">
            <Skeleton variant="avatar" />
            <div className="flex-1 space-y-2">
                <Skeleton variant="title" />
                <Skeleton variant="text" className="w-2/3" />
                <Skeleton variant="button" />
            </div>
        </div>
    );
}