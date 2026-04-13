// "use client";

// import { useEffect, useState } from "react";
// import PaymentLinkButton from "@/components/PaymentLinkButton";

// export default function SellerOrderDetail({ params }: any) {
//     const [order, setOrder] = useState<any>(null);

//     async function fetchOrder() {
//         const data = await fetch(`/api/orders/${params.id}`, {
//             credentials: "include",
//         }).then((r) => r.json());
//         setOrder(data);
//     }

//     useEffect(() => {
//         fetchOrder();

//         const interval = setInterval(() => {
//             if (
//                 order?.status === "AWAITING_PAYMENT" ||
//                 order?.status === "READY_FOR_OTP_VERIFICATION"
//             ) {
//                 fetchOrder();
//             }
//         }, 15000);

//         return () => clearInterval(interval);
//     }, [order?.status]);

//     if (!order) return <div>Loading...</div>;

//     return (
//         <div className="p-4 space-y-4">

//             <div>{order.shortId}</div>

//             <div>
//                 Buyer: {order.buyer.name} ({order.buyer.phone})
//             </div>

//             <div>
//                 {order.items.map((i: any) => (
//                     <div key={i.id}>
//                         {i.nameHi} - ₹{i.subTotal}
//                     </div>
//                 ))}
//             </div>

//             <PaymentLinkButton
//                 orderId={order.id}
//                 paymentLinkUrl={order.paymentLinkUrl}
//                 paymentLinkExpiresAt={order.paymentLinkExpiresAt}
//                 onRequested={fetchOrder}
//             />
//         </div>
//     );
// }