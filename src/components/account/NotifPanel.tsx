"use client";

interface Notification {
    id: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
}

function formatTime(date: string) {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;

    if (diff < 3600) return `${Math.floor(diff / 60)}m पहले`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h पहले`;

    return new Date(date).toLocaleDateString("hi-IN");
}

export default function NotifPanel({
    notifications,
    unreadCount,
    onMarkAll,
}: {
    notifications: Notification[];
    unreadCount: number;
    onMarkAll: () => void;
}) {
    return (
        <div className="bg-surface dark:bg-surface-dark rounded-card border border-border overflow-hidden">
            <div className="flex justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="font-semibold">सूचनाएं</span>
                    {unreadCount > 0 && (
                        <span className="bg-kridha-primary text-white w-5 h-5 text-xs rounded-full flex items-center justify-center">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={onMarkAll}
                        className="text-label-sm text-kridha-primary hover:underline"
                    >
                        सभी पढ़ें
                    </button>
                )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 && (
                    <div className="p-8 text-center text-muted">
                        कोई सूचना नहीं
                    </div>
                )}

                {notifications.map((n) => (
                    <div
                        key={n.id}
                        className={`px-5 py-3.5 flex gap-3 ${!n.read &&
                            "bg-kridha-secondary/40 dark:bg-kridha-primary/10"
                            }`}
                    >
                        <div
                            className={`w-2 h-2 rounded-full mt-1.5 ${n.read ? "bg-gray-400" : "bg-kridha-primary"
                                }`}
                        />
                        <div>
                            <div
                                className={`text-label-md ${!n.read && "font-semibold"
                                    }`}
                            >
                                {n.title}
                            </div>
                            <div className="text-label-sm text-muted line-clamp-2">
                                {n.body}
                            </div>
                            <div className="text-xs text-gray-400">
                                {formatTime(n.createdAt)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}