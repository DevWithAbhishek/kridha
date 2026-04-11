import { ClipboardList, CheckCircle2, Wallet, Star } from "lucide-react";
import { ReactNode } from "react";

interface SubOrder {
    status: string;
    totalAmount: number;
}

interface User {
    reliabilityScore: number;
}

interface StatCardProps {
    label: string;
    value: string | number;
    sub?: string;
    accent?: boolean;
    icon: ReactNode;
}

function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
    return (
        <div
            className={`rounded-card border p-5 ${accent
                    ? "bg-kridha-primary border-kridha-primary/20 text-white"
                    : "bg-surface dark:bg-surface-dark border-border"
                }`}
        >
            <div className="flex items-center justify-between mb-3">
                <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent
                            ? "bg-white/15"
                            : "bg-kridha-secondary dark:bg-gray-800 text-kridha-primary"
                        }`}
                >
                    {icon}
                </div>
            </div>

            <div className="text-display-sm font-bold">{value}</div>
            <div className="text-label-md">{label}</div>
            {sub && <div className="text-label-sm text-muted">{sub}</div>}
        </div>
    );
}

export function BuyerStatRow({
    orders,
    user,
}: {
    orders: SubOrder[];
    user: User;
}) {
    const active = orders.filter(
        (o) => !["COMPLETED", "CANCELLED"].includes(o.status)
    ).length;

    const completedOrders = orders.filter((o) => o.status === "COMPLETED");
    const completed = completedOrders.length;

    const totalSpent = completedOrders.reduce(
        (sum, o) => sum + o.totalAmount,
        0
    );

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                label="Active Orders"
                value={active}
                sub="अभी चल रहे"
                accent
                icon={<ClipboardList size={18} />}
            />
            <StatCard
                label="Completed"
                value={completed}
                sub={`${orders.length} में से`}
                icon={<CheckCircle2 size={18} />}
            />
            <StatCard
                label="Total Spent"
                value={`₹${totalSpent.toLocaleString("en-IN")}`}
                sub="completed orders"
                icon={<Wallet size={18} />}
            />
            <StatCard
                label="Reliability"
                value={`${user.reliabilityScore}%`}
                sub="no-show score"
                icon={<Star size={18} />}
            />
        </div>
    );
}