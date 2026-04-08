import Image from 'next/image';
import { Button } from '@/components/ui/Button';

export function CtaBanner() {
    return (
        <section className="relative bg-gray-900 dark:bg-gray-950 py-16 overflow-hidden">
            <Image
                src="/images/social-media.webp"
                alt=""
                fill
                className="object-cover opacity-5"
            />
            <div className="relative max-w-page mx-auto px-page-x md:px-page-x-md">
                <div className="lg:flex lg:items-center lg:justify-between">
                    <div className="lg:w-1/2 mb-8 lg:mb-0">
                        <h2 className="text-display-sm font-bold text-white mb-4">
                            आज ही Kridha से जुड़ें
                        </h2>
                        <p className="text-body-lg text-gray-400 mb-6">
                            Start selling or buying fresh produce today
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button variant="primary" size="lg" asChild>
                                <a href="/signup">Buyer के रूप में</a>
                            </Button>
                            <Button variant="outline" size="lg" asChild className="border-white text-white hover:bg-white hover:text-gray-900">
                                <a href="/signup?role=seller">Supplier के रूप में</a>
                            </Button>
                        </div>
                    </div>
                    <div className="lg:w-1/2">
                        <div className="flex justify-center lg:justify-end gap-6">
                            <div className="flex items-center gap-1.5 text-gray-400 text-label-sm">
                                <span>🔒</span>
                                Razorpay secured
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-400 text-label-sm">
                                <span>📍</span>
                                Lucknow first
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-400 text-label-sm">
                                <span>⚡</span>
                                2 min signup
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}