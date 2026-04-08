'use client';
import { useLangStore } from '@/stores/langStore';

export function LanguageToggle() {
    const { lang, setLang } = useLangStore();

    const toggleLang = () => {
        const next = lang === 'hi' ? 'en' : 'hi';
        setLang(next);
        document.cookie = `kridha_lang=${next}; path=/; max-age=31536000; SameSite=Strict`;
    };

    return (
        <button
            onClick={toggleLang}
            className="flex items-center bg-kridha-secondary dark:bg-surface-dark rounded-pill px-3 py-1.5 gap-2 border border-border-DEFAULT dark:border-border-dark min-h-touch transition-all duration-fast"
        >
            <span
                className={`text-label-sm transition-opacity duration-fast ${lang === 'hi' ? 'opacity-100 font-semibold text-kridha-primary' : 'opacity-40 text-muted'
                    }`}
            >
                हिं
            </span>
            <span className="text-muted-DEFAULT">|</span>
            <span
                className={`text-label-sm transition-opacity duration-fast ${lang === 'en' ? 'opacity-100 font-semibold text-kridha-primary' : 'opacity-40 text-muted'
                    }`}
            >
                EN
            </span>
        </button>
    );
}