import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Order = {
    shortId?: string;
    totalAmount: number;
    status?: string;
    seller?: { storeName?: string };
    buyer?: { name?: string };
};

type Props = {
    order: Order;
    role: "buyer" | "seller";
    href: string;
};

function getStatusColor(status?: string) {
    switch (status) {
        case "COMPLETED":
            return "bg-green-500";
        case "CONFIRMED":
            return "bg-yellow-500";
        case "CANCELLED":
            return "bg-red-500";
        default:
            return "bg-gray-400";
    }
}

export default function SubOrderCard({ order, role, href }: Props) {
    const name =
        role === "buyer"
            ? order.seller?.storeName ?? "Unknown Store"
            : order.buyer?.name ?? "Unknown Buyer";

    const formattedAmount = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(order.totalAmount || 0);

    return (
        <Link href={href} className="block">
            <div className="p-4 flex gap-4 border rounded-card hover:shadow-card-hover transition">

                {/* Status dot */}
                <div
                    className={`w-3 h-3 rounded-full ${getStatusColor(order.status)}`}
                />

                {/* Info */}
                <div className="flex-1">
                    <div className="font-mono font-bold">
                        {order.shortId ?? "—"}
                    </div>
                    <div className="text-sm text-muted">{name}</div>
                </div>

                {/* Amount */}
                <div className="text-kridha-primary font-bold">
                    {formattedAmount}
                </div>

                {/* Arrow */}
                <ChevronRight className="opacity-60" />
            </div>
        </Link>
    );
}