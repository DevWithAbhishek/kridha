"use client";

import SubOrderCard from "@/components/order/SubOrderCard";
import { useFetch } from "@/hooks/useFetch";
import { SubOrder } from "@/types/dashboard";

type OrdersResponse = {
    orders: SubOrder[];
};

export default function SellerOrdersPage() {
    const { data, loading, error } = useFetch<OrdersResponse>(
        "/api/orders?role=seller",
        { orders: [] }
    );

    const orders = data.orders;

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error loading orders</div>;

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-h2">मेरे Orders</h2>

            {orders?.map((o) => (
                <SubOrderCard
                    key={o.id}
                    order={o}
                    role="seller"
                    href={`/seller/orders/${o.id}`}
                />
            ))}
        </div>
    );
}