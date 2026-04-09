import { Suspense } from 'react';
import AuthPage from './AuthPage';

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <AuthPage />
        </Suspense>
    );
}