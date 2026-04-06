import { ReactNode } from 'react';
import Link from 'next/link';
import { LanguageToggle } from '@/components/shared/LanguageToggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#FFFEF7] flex flex-col">
            {/* Minimal nav */}
            <header className="px-4 py-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FED700] flex items-center justify-center">
                        <span className="font-bold text-sm text-gray-900">K</span>
                    </div>
                    <span className="font-bold text-gray-900 text-lg">Kridha</span>
                </Link>
                <LanguageToggle />
            </header>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-sm">{children}</div>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-gray-400 pb-6 px-4">
                किराना का भरोसेमंद साथी · UP के लिए बनाया गया
            </p>
        </div>
    );
}