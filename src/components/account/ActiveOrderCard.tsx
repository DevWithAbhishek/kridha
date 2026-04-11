// "use client";

// import { Calendar } from "lucide-react";
// import { STATUS_CONFIG } from "@/lib/statusConfig";
// import {StatusBadge} from "@/components/layout/StatusBadge";
// import {OrderTimeline} from "@/components/shared/OrderTimeline";
// import { OtpDisplay } from "@/components/shared/OtpDisplay";
// import {DealCountdown} from "@/components/product/DealCountdown";

// interface Item {
//     nameHi: string;
//     nameEn: string;
//     qty: number;
//     unit: string;
//     subTotal: number;
// }

// interface SubOrder {
//     id: string;
//     shortId: string;
//     status: string;
//     seller: { storeName: string; city: string };
//     items: Item[];
//     totalAmount: number;
//     advanceAmount: number;
//     remainingAmount: number;
//     pickupAt: string;
// }

// export default function ActiveOrderCard({
//     order,
//     lang = "hi",
// }: {
//     order: SubOrder;
//     onCancel: (id: string) => void;
//     lang?: "hi" | "en";
// }) {
//     return (
//         <div className="bg-surface dark:bg-surface-dark rounded-card border border-border hover:shadow-card-hover transition-shadow overflow-hidden">
//             {/* Header */}
//             <div className="flex justify-between px-5 py-4 border-b border-border">
//                 <div>
//                     <div className="font-mono font-bold">{order.shortId}</div>
//                     <div className="text-label-sm text-muted">
//                         {order.seller.storeName} • {order.seller.city}
//                     </div>
//                 </div>
//                 <StatusBadge status={order.status}   />
//             </div>

//             {/* Items */}
//             <div className="px-5 py-3 border-b border-border/50">
//                 {order.items.map((item, i) => (
//                     <div key={i} className="flex justify-between">
//                         <span>
//                             {lang === "hi" ? item.nameHi : item.nameEn} • {item.qty}{" "}
//                             {item.unit}
//                         </span>
//                         <span className="text-kridha-primary font-semibold">
//                             ₹{item.subTotal}
//                         </span>
//                     </div>
//                 ))}
//             </div>

//             {/* Financials */}
//             <div className="px-5 py-3 grid grid-cols-3 gap-2 bg-kridha-secondary/30 dark:bg-kridha-primary/10 border-b border-border/50">
//                 <div>
//                     <div className="text-label-xs text-muted">Total</div>
//                     <div className="font-bold">₹{order.totalAmount}</div>
//                 </div>
//                 <div>
//                     <div className="text-label-xs text-muted">Advance</div>
//                     <div className="font-bold text-success">
//                         ₹{order.advanceAmount}
//                     </div>
//                 </div>
//                 <div>
//                     <div className="text-label-xs text-muted">Remaining</div>
//                     <div className="font-bold text-warning">
//                         ₹{order.remainingAmount}
//                     </div>
//                 </div>
//             </div>

//             {/* Pickup */}
//             <div className="px-5 py-3 flex items-center gap-2 border-b border-border/50">
//                 <Calendar className="text-kridha-primary" size={16} />
//                 {new Date(order.pickupAt).toLocaleString("hi-IN")}
//             </div>

//             {/* OTP */}
//             {order.status === "READY_FOR_OTP" && (
//                 <div className="px-5 py-4 border-b border-border">
//                     <OtpDisplay orderId={order.id} />
//                 </div>
//             )}

//             {/* Timeline */}
//             <details className="px-5 py-3 border-b border-border">
//                 <summary className="text-label-sm text-kridha-primary cursor-pointer">
//                     Status timeline
//                 </summary>
//                 <OrderTimeline orderId={order.id} />
//             </details>
//         </div>
//     );
// }