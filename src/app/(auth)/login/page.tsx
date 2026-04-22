import { Suspense } from 'react';
import AuthPage from './AuthPage';

export default async function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthPage />
        </Suspense>
    );
}