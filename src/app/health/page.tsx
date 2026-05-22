'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type HealthState = {
    status: 'ok' | 'down' | 'unknown';
    db: string;
    redis: string;
};

const fallbackHealth: HealthState = {
    status: 'unknown',
    db: 'checking',
    redis: 'checking',
};

export default function HealthPage() {
    const [health, setHealth] = useState<HealthState>(fallbackHealth);
    const [lastChecked, setLastChecked] = useState('...');
    const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

    async function loadHealth() {
        try {
            const res = await fetch('/api/health');
            const json = await res.json();
            setHealth({
                status: json.status ?? 'unknown',
                db: json.db ?? 'checking',
                redis: json.redis ?? 'checking',
            });
        } catch {
            setHealth(fallbackHealth);
        } finally {
            setLastChecked(new Date().toLocaleTimeString());
        }
    }

    useEffect(() => {
        loadHealth();
        const interval = setInterval(loadHealth, 10000);
        setTimer(interval);
        return () => {
            if (interval) clearInterval(interval);
            if (timer) clearInterval(timer);
        };
    }, []);

    const isOk = health.status === 'ok';
    const indicatorClass = isOk ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse';

    return (
        <div className="bg-gray-900 min-h-screen text-white">
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md py-16">
                <div className="flex flex-col items-center gap-6">
                    <Image
                        src="/images/kridha_logo_nav.png"
                        alt="Kridha"
                        width={180}
                        height={48}
                        className="brightness-0 invert"
                    />
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center ${indicatorClass}`}>
                            <span className="text-h3 font-bold text-white">
                                {health.status === 'ok' ? 'LIVE' : health.status === 'down' ? 'DOWN' : '...'}
                            </span>
                        </div>
                        <div className="text-label-sm text-gray-300">Auto-refreshing every 10s</div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3 w-full">
                        <div className="rounded-card bg-gray-800 border border-gray-700 p-6">
                            <div className="flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full ${health.db === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse-slow`} />
                                <div>
                                    <div className="font-semibold">Supabase PostgreSQL</div>
                                    <p className="text-label-sm text-gray-400">{health.db === 'ok' ? 'Connected' : 'Disconnected'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-card bg-gray-800 border border-gray-700 p-6">
                            <div className="flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full ${health.redis === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse-slow`} />
                                <div>
                                    <div className="font-semibold">Upstash Redis</div>
                                    <p className="text-label-sm text-gray-400">{health.redis === 'ok' ? 'Connected' : 'Disconnected'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-card bg-gray-800 border border-gray-700 p-6">
                            <div className="flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse-slow`} />
                                <div>
                                    <div className="font-semibold">API Server</div>
                                    <p className="text-label-sm text-gray-400">{health.status === 'ok' ? 'Running' : 'Down'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-gray-400 text-label-sm">
                        Last checked: {lastChecked}
                    </div>

                    <div className="text-gray-500 text-label-sm">Version 2026.1</div>
                </div>
            </div>
        </div>
    );
}