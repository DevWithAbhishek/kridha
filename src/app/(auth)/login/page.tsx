import { Suspense } from 'react';
import AuthPage from './Authpage';

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <AuthPage />
        </Suspense>
    );
}