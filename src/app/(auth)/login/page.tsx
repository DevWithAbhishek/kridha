import { Suspense } from 'react';
import AuthPage from './AuthPage';
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
    const store = await cookies()
    const token = store.get('kridha_access')?.value
    if (token) {
        // Don't verify JWT here — just check presence. Middleware will verify.
        // If cookie exists, assume logged in and redirect.
        redirect('/')
    }
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthPage />
        </Suspense>
    );
}