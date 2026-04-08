import Image from 'next/image';
import { MapPin, ShieldCheck, Clock3, Star } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function FeaturesSection() {
    const t = await getTranslations('features');

    return (
        <section className="py-section-y">
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md grid gap-10 lg:grid-cols-[1fr_420px] items-center">
                <div className="space-y-8">
                    <div>
                        <h2 className="text-h1 font-bold">{t('title')}</h2>
                        <p className="text-body-lg text-[var(--color-text-muted)] mt-4">
                            किराना खरीदना अब और आसान
                        </p>
                    </div>

                    <div className="space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-lg bg-kridha-secondary flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-kridha-primary" />
                            </div>
                            <div>
                                <h3 className="text-h6 font-semibold">{t('f1_title')}</h3>
                                <p className="text-body-sm text-[var(--color-text-muted)]">{t('f1_desc')}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-lg bg-kridha-secondary flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-kridha-primary" />
                            </div>
                            <div>
                                <h3 className="text-h6 font-semibold">{t('f2_title')}</h3>
                                <p className="text-body-sm text-[var(--color-text-muted)]">{t('f2_desc')}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-lg bg-kridha-secondary flex items-center justify-center">
                                <Clock3 className="w-5 h-5 text-kridha-primary" />
                            </div>
                            <div>
                                <h3 className="text-h6 font-semibold">{t('f3_title')}</h3>
                                <p className="text-body-sm text-[var(--color-text-muted)]">{t('f3_desc')}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-lg bg-kridha-secondary flex items-center justify-center">
                                <Star className="w-5 h-5 text-kridha-primary" />
                            </div>
                            <div>
                                <h3 className="text-h6 font-semibold">{t('f4_title')}</h3>
                                <p className="text-body-sm text-[var(--color-text-muted)]">{t('f4_desc')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block">
                    <Image
                        src="/images/meeting-img.webp"
                        alt="Kridha feature illustration"
                        width={560}
                        height={420}
                        className="rounded-2xl shadow-xl object-cover"
                    />
                </div>
            </div>
        </section>
    );
}