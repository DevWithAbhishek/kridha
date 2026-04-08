import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface OtpDisplayProps {
    otp: string;
}

export function OtpDisplay({ otp }: OtpDisplayProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(otp);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-kridha-accent/15 border border-kridha-accent/40 rounded-2xl p-4 dark:bg-kridha-accent/10 dark:border-kridha-accent/30">
            <div className="text-label-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
                आपका OTP — विक्रेता को दिखाएं
            </div>
            <div className="flex gap-2 justify-center mb-4">
                {otp.split('').map((digit, index) => (
                    <div
                        key={index}
                        className="w-12 h-14 bg-white dark:bg-gray-800 rounded-xl border-2 border-kridha-accent/50 flex items-center justify-center text-display-sm font-bold text-text shadow-sm"
                    >
                        {digit}
                    </div>
                ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="w-full">
                <Copy className="w-4 h-4 mr-2" />
                {copied ? 'Copied!' : 'Copy OTP'}
            </Button>
        </div>
    );
}