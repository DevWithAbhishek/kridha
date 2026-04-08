'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

// Proper mount detection without useEffect
function useMounted() {
    return useSyncExternalStore(
        () => () => { },   // no-op subscribe
        () => true,       // client snapshot
        () => false       // server snapshot
    );
}


export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme();
    const mounted = useMounted();

    if (!mounted) {
        return <div className="w-9 h-9 rounded-btn" />;
    }

    const dark = resolvedTheme === 'dark';

    return (
        <button
            type="button"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 rounded-btn flex items-center justify-center bg-kridha-secondary dark:bg-surface-dark hover:bg-kridha-primary/20 transition-all duration-normal focus-visible:shadow-focus-primary outline-none"
            onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
            {dark ? (
                <Sun className="w-5 h-5 text-kridha-accent" />
            ) : (
                <Moon className="w-5 h-5 text-kridha-primary" />
            )}
        </button>
    );
}