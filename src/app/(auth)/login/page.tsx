import { Suspense } from 'react';
import AuthPage from './AuthPage';
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect?: string }>;
}) {
    const store = await cookies()
    const token = store.get('kridha_access')?.value

    // 🔥 MUST AWAIT
    const params = await searchParams;

    const redirectUrl = params.redirect
        ? decodeURIComponent(params.redirect)
        : '/'

    if (token) {
        redirect(redirectUrl)
    }

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthPage />
        </Suspense>
    );
}