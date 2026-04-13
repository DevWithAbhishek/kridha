// "use client";

// import { useEffect, useState } from "react";
// import ReliabilityDonut from "@/components/account/ReliabilityDonut";
// import Link from "next/link";

// export default function SellerProfilePage() {
//     const [profile, setProfile] = useState<any>(null);

//     useEffect(() => {
//         fetch("/api/sellers/profile", {
//             credentials: "include",
//         })
//             .then((r) => r.json())
//             .then(setProfile);
//     }, []);

//     if (!profile) return <div>Loading...</div>;

//     return (
//         <div className="p-4 space-y-6">

//             <div>
//                 <h2 className="text-h2">{profile.storeName}</h2>
//                 <div>{profile.city}</div>
//             </div>

//             <div className="border p-4 rounded-card">
//                 <div>{profile.street}</div>
//                 <div>{profile.pinCode}</div>
//             </div>

//             {/* <ReliabilityDonut score={profile.reliabilityScore} size="lg" /> */}

//             <Link href="/seller/delete-profile" className="text-error">
//                 Seller Profile Delete करें
//             </Link>
//         </div>
//     );
// }