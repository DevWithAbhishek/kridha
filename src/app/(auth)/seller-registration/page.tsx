// src/app/(auth)/register-as-seller/page.tsx
import { Suspense } from 'react';
import RegisterAsSellerPage from './RegisterAsSellerPage';

export default function Page() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center text-muted-DEFAULT">लोड हो रहा है...</div>}>
            <RegisterAsSellerPage />
        </Suspense>
    );
}