'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface OtpEntryProps {
    onVerify: (otp: string) => Promise<void>;
    loading: boolean;
    error: string | null;
    attempts: number;
}

export function OtpEntry({ onVerify, loading, error, attempts }: OtpEntryProps) {
    const [otp, setOtp] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length === 4) {
            await onVerify(otp);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="text-h6 font-semibold">Buyer से OTP लें</label>
                <form onSubmit={handleSubmit} className="mt-3">
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        pattern="[0-9]*"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center text-display-md font-bold tracking-[0.5em] border-2 border-border rounded-xl px-4 py-3 focus:border-kridha-primary focus:shadow-focus-primary"
                        placeholder="0000"
                    />
                </form>
            </div>
            {attempts >= 2 && (
                <div className="text-error text-label-sm">
                    {3 - attempts} attempt बाकी है
                </div>
            )}
            {error && (
                <div className="bg-error-light border border-error/30 rounded-lg px-3 py-2 text-error text-label-sm">
                    {error}
                </div>
            )}
            <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleSubmit}
                loading={loading}
                disabled={otp.length !== 4}
            >
                Verify करें
            </Button>
        </div>
    );
}