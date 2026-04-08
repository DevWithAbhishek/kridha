import { StatusBadge } from '@/components/ui/StatusBadge';
import { getStatusConfig } from '@/lib/statusConfig';
import type { StatusEvent } from '@/types/dashboard';

interface OrderTimelineProps {
    history: StatusEvent[];
    lang?: 'hi' | 'en';
}

export function OrderTimeline({ history, lang }: OrderTimelineProps) {
    return (
        <div className="flex flex-col gap-0">
            {history.map((event, index) => {
                const isLast = index === history.length - 1;
                const config = getStatusConfig(event.toStatus);
                return (
                    <div key={event.id} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full ${isLast ? config.dot : 'bg-kridha-primary/40'}`} />
                            {!isLast && <div className="w-px bg-border flex-1 min-h-4" />}
                        </div>
                        <div className="pb-3 flex flex-col gap-0.5">
                            <StatusBadge status={event.toStatus} lang={lang} size="sm" />
                            <div className="text-label-sm text-muted">
                                {new Date(event.createdAt).toLocaleString()}
                            </div>
                            {event.note && (
                                <div className="text-body-xs text-muted italic">{event.note}</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}