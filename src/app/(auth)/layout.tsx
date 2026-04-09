import Image from 'next/image';
import { LanguageToggle } from '@/components/shared/LanguageToggle';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

interface AuthLayoutProps {
    children: React.ReactNode;
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
    const store = await cookies()
    const token = store.get('kridha_access')?.value
    if (token) {
        // Don't verify JWT here — just check presence. Middleware will verify.
        // If cookie exists, assume logged in and redirect.
        redirect('/')
    }
    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
            <header className="px-page-x py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Image src="/images/kridha_logo_nav.png" alt="Kridha" width={36} height={36} />
                    <span className="text-h5 font-bold text-kridha-primary">Kridha</span>
                </div>
                <div className="flex gap-2">
                    <LanguageToggle />
                    <ThemeToggle />
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center px-page-x py-8">
                <div className="max-w-form mx-auto w-full">{children}</div>
            </main>

            <div className="pb-6 text-center text-label-sm text-[var(--color-text-muted)]">
                किराना का भरोसेमंद साथी · UP के लिए
            </div>
        </div>
    );
}