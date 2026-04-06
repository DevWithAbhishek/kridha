// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { useTranslations } from 'next-intl';
// import { api } from '@/lib/api';

// interface LoginError { code: string; message: string; }

// export default function LoginPage() {
//     const t = useTranslations();
//     const router = useRouter();
//     const params = useSearchParams();

//     const [phone, setPhone] = useState('');
//     const [pin, setPin] = useState('');
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState<string | null>(null);

//     const redirectTo = params.get('redirect') ?? '/products';

//     async function handleLogin(e: React.FormEvent) {
//         e.preventDefault();
//         if (phone.length !== 10 || pin.length !== 4) return;

//         setLoading(true);
//         setError(null);

//         try {
//             // POST /api/auth/login — server sets HttpOnly cookies
//             // No token handling here. No localStorage.
//             await api.post('/auth/login', { phone, pin });
//             router.replace(redirectTo);
//         } catch (err: unknown) {
//             const e = err as { response?: { data?: LoginError } };
//             const code = e.response?.data?.code;
//             if (code === 'PIN_LOCKED') {
//                 setError(t('errors.PIN_LOCKED'));
//             } else if (code === 'INVALID_CREDENTIALS') {
//                 setError(t('errors.INVALID_CREDENTIALS'));
//             } else {
//                 setError(t('common.error'));
//             }
//         } finally {
//             setLoading(false);
//         }
//     }

//     return (
//         <div className="flex flex-col gap-6">
//             {/* Heading */}
//             <div className="text-center">
//                 <h1 className="text-2xl font-bold text-gray-900 mb-1">
//                     {t('auth.login')}
//                 </h1>
//                 <p className="text-sm text-gray-500">
//                     Kridha पर आपका स्वागत है
//                 </p>
//             </div>

//             {/* Form card */}
//             <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
//                 <form onSubmit={handleLogin} className="flex flex-col gap-4">

//                     {/* Phone */}
//                     <div className="flex flex-col gap-1.5">
//                         <label className="text-sm font-medium text-gray-700">
//                             {t('auth.phone')}
//                         </label>
//                         <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#1F9E87] focus-within:ring-2 focus-within:ring-[#1F9E87]/20 transition-all">
//                             <span className="px-3 py-3 bg-gray-50 text-sm text-gray-500 border-r border-gray-200 font-medium">
//                                 +91
//                             </span>
//                             <input
//                                 type="tel"
//                                 inputMode="numeric"
//                                 maxLength={10}
//                                 value={phone}
//                                 onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
//                                 placeholder="9876543210"
//                                 className="flex-1 px-3 py-3 text-sm text-gray-900 outline-none bg-white placeholder:text-gray-400"
//                                 required
//                             />
//                         </div>
//                     </div>

//                     {/* PIN */}
//                     <div className="flex flex-col gap-1.5">
//                         <label className="text-sm font-medium text-gray-700">
//                             {t('auth.pin')}
//                         </label>
//                         <input
//                             type="password"
//                             inputMode="numeric"
//                             maxLength={4}
//                             value={pin}
//                             onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
//                             placeholder="••••"
//                             className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-[#1F9E87] focus:ring-2 focus:ring-[#1F9E87]/20 transition-all placeholder:text-gray-400"
//                             required
//                         />
//                     </div>

//                     {/* Error */}
//                     {error && (
//                         <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
//                             <p className="text-sm text-red-700">{error}</p>
//                         </div>
//                     )}

//                     {/* Submit */}
//                     <button
//                         type="submit"
//                         disabled={loading || phone.length !== 10 || pin.length !== 4}
//                         className="w-full bg-[#1F9E87] text-white font-semibold py-3 rounded-xl hover:bg-[#178574] transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-sm"
//                     >
//                         {loading ? (
//                             <span className="flex items-center justify-center gap-2">
//                                 <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
//                                 {t('common.loading')}
//                             </span>
//                         ) : (
//                             t('auth.loginBtn')
//                         )}
//                     </button>
//                 </form>

//                 {/* Reset PIN */}
//                 <div className="mt-4 text-center">
//                     <Link href="/reset-pin" className="text-sm text-[#1F9E87] hover:underline font-medium">
//                         PIN भूल गए?
//                     </Link>
//                 </div>
//             </div>

//             {/* Signup link */}
//             <p className="text-center text-sm text-gray-500">
//                 नया account?{' '}
//                 <Link href="/signup" className="text-[#1F9E87] font-semibold hover:underline">
//                     {t('auth.createAccount')}
//                 </Link>
//             </p>
//         </div>
//     );
// }