import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function SubOrderCard({ order, role, href }: any) {
    return (
        <Link href={href}>
            <div className="p-4 flex gap-4 border rounded-card hover:shadow-card-hover">
                <div className="w-3 h-3 rounded-full bg-green-500" />

                <div className="flex-1">
                    <div className="font-mono font-bold">{order.shortId}</div>
                    <div className="text-sm text-muted">
                        {role === "buyer"
                            ? order.seller.storeName
                            : order.buyer.name}
                    </div>
                </div>

                <div className="text-kridha-primary font-bold">
                    ₹{order.totalAmount}
                </div>

                <ChevronRight />
            </div>
        </Link>
    );
}