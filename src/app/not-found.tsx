'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function NotFoundPage() {
    const router = useRouter();
    const [countdown, setCountdown] = useState(5);
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);


    // ✅ Separate effect for navigation
    useEffect(() => {
        if (countdown === 0) {
            router.push('/');
        }
    }, [countdown, router]);

    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-page-x py-8 relative">
            <Image
                src="/images/kridha_logo_nav.png"
                alt=""
                fill
                className="object-cover opacity-5"
            />
            <div className="max-w-form w-full bg-[var(--color-surface)] rounded-modal shadow-modal border border-[var(--color-border)] p-8 text-center relative z-10">
                <Image src="/images/kridha_logo_nav.png" alt="Kridha" width={48} height={48} className="mx-auto mb-6" />
                <div className="relative">
                    <div className="text-[8rem] font-bold text-kridha-secondary leading-none">404</div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <h1 className="text-display-md font-bold text-[var(--color-text)]">पेज नहीं मिला</h1>
                    </div>
                </div>
                <p className="text-body-md text-[var(--color-text-muted)] mt-4">
                    यह पेज exist नहीं करता। होम पर जाएं।
                </p>
                <p className="text-label-sm text-muted mt-2">
                    {countdown} seconds में redirect होगा...
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <Button variant="primary" size="lg" className="flex-1" asChild>
                        <Link href="/">होम पर जाएं</Link>
                    </Button>
                    <Button variant="ghost" size="lg" className="flex-1" asChild>
                        <Link href="/products">Products देखें</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}