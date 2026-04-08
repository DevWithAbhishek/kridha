import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

export async function Footer() {
    const t = await getTranslations('footer');

    return (
        <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400">
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <Image
                            src="/images/kridha_logo_footer.png"
                            alt="Kridha"
                            height={40}
                            width={160}
                            className="brightness-0 invert mb-4"
                        />
                        <p className="text-sm">{t('tagline')}</p>
                        <p className="text-xs mt-2">© 2026 Kridha</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white mb-4">{t('links_title')}</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/products" className="hover:text-white transition-colors">
                                    Products
                                </Link>
                            </li>
                            <li>
                                <Link href="#how" className="hover:text-white transition-colors">
                                    How it Works
                                </Link>
                            </li>
                            <li>
                                <Link href="/health" className="hover:text-white transition-colors">
                                    Health Status
                                </Link>
                            </li>
                            <li>
                                <Link href="/support" className="hover:text-white transition-colors">
                                    Support
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white mb-4">Legal</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/privacy" className="hover:text-white transition-colors">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="hover:text-white transition-colors">
                                    Terms of Service
                                </Link>
                            </li>
                        </ul>
                        <p className="text-xs mt-4">Razorpay secured</p>
                    </div>
                </div>
            </div>
            <div className="border-t border-gray-800 py-4">
                <p className="text-xs text-center">
                    Built with ❤️ for UP Tier-2 · NIT Allahabad - 24
                </p>
            </div>
        </footer>
    );
}