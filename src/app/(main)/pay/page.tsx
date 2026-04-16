'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface RazorpayOptions {
    key: string | undefined;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    image: string;
    handler: () => void;
    modal: {
        ondismiss: () => undefined;
    };
}

interface RazorpayInstance {
    open: () => void;
}

declare global {
    interface Window {
        Razorpay?: (options: RazorpayOptions) => RazorpayInstance;
    }
}

export default function PayPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId') ?? '';
    const advance = Number(searchParams.get('advance') ?? '0');
    const razorpayOrderId = searchParams.get('razorpayOrderId') ?? '';

    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [paid, setPaid] = useState(false);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => setScriptLoaded(true);
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    function openCheckout() {
        if (!scriptLoaded || !window.Razorpay || !razorpayOrderId) return;

        const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            order_id: razorpayOrderId,
            amount: advance * 100,
            currency: 'INR',
            name: 'Kridha',
            description: 'Advance payment',
            image: '/images/kridha_logo_nav.png',
            handler: () => {
                setPaid(true);
                router.push(`/dashboard/orders/${orderId}`);
            },
            modal: {
                ondismiss: () => undefined,
            },
        };

        window.Razorpay(options).open();
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-page-x py-10">
            <div className="max-w-form w-full bg-[var(--color-surface)] rounded-modal border border-[var(--color-border)] shadow-modal p-8 text-center">
                <Image src="/images/kridha_logo_nav.png" alt="Kridha" width={40} height={40} className="mx-auto mb-6" />
                <h1 className="text-h3 font-bold mb-3">Advance भुगतान करें</h1>
                <p className="text-display-sm font-bold text-kridha-primary mb-2">₹{advance}</p>
                <p className="text-label-sm text-[var(--color-text-muted)] mb-6 font-mono">Order ID: {orderId}</p>

                <div className="rounded-card bg-kridha-secondary/30 p-4 text-body-sm mb-6">
                    यह advance आपके order की पुष्टि करेगा। बाकी पैसे pickup पर
                </div>

                {paid ? (
                    <div className="space-y-4">
                        <div className="text-kridha-primary text-3xl">✔</div>
                        <p className="text-h6 font-semibold">Advance pay हो गया!</p>
                        <Button variant="primary" size="lg" className="w-full" onClick={() => router.push(`/dashboard/orders/${orderId}`)}>
                            View Order
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Button variant="primary" size="lg" className="w-full" onClick={openCheckout}>
                            Pay Now
                        </Button>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/cart')}>
                            Go Back
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}