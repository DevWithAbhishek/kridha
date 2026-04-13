import { Product, SellerProfile, SubOrder } from "@/types/dashboard";
import { ShoppingBag, IndianRupee, Star, ShieldCheck } from "lucide-react";

export function SellerStatRow({
    orders,
    products,
    profile,
}: {
    orders: SubOrder[];
    products: Product[]
    profile: SellerProfile;
}) {
    const activeOrders = orders.filter(
        (o) => !["COMPLETED", "CANCELLED"].includes(o.status)
    ).length;

    const revenue = orders
        .filter((o) => o.status === "COMPLETED")
        .reduce((sum, o) => sum + o.totalAmount, 0);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-kridha-primary text-white p-5 rounded-card">
                <ShoppingBag /> {activeOrders}
            </div>

            <div>₹{revenue.toLocaleString("en-IN")}</div>
            <div>
                {profile.sellerRating} ★ ({profile.sellerRatingCount})
            </div>
            <div>{profile.reliabilityScore}%</div>
        </div>
    );
}