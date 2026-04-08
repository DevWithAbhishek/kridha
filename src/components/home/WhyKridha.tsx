import { getTranslations } from 'next-intl/server';

export async function WhyKridha() {
    const t = await getTranslations('why');

    const reasons = [
        { icon: '₹', title: t('reason1'), desc: 'Direct farmer to kirana' },
        { icon: '📍', title: t('reason2'), desc: 'Hyperlocal radius search' },
        { icon: '🛡️', title: t('reason3'), desc: 'Razorpay protection' },
        { icon: '⭐', title: t('reason4'), desc: 'Reliability scores' },
    ];

    return (
        <section className="bg-kridha-gradient py-section-y text-white">
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md text-center">
                <h2 className="text-display-sm font-bold mb-4">{t('title')}</h2>
                <p className="text-body-lg text-white/80 mb-12">{t('title')}</p>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {reasons.map((reason, index) => (
                        <div key={index} className="bg-white/10 backdrop-blur border border-white/20 rounded-card p-card">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl mb-4 mx-auto">
                                {reason.icon}
                            </div>
                            <h3 className="text-h5 font-bold mb-2">{reason.title}</h3>
                            <p className="text-body-sm text-white/80">{reason.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-8">
                    <div>
                        <div className="text-display-sm font-bold text-kridha-accent">50+</div>
                        <div className="text-body-sm text-white/80">suppliers</div>
                    </div>
                    <div>
                        <div className="text-display-sm font-bold text-kridha-accent">₹0</div>
                        <div className="text-body-sm text-white/80">delivery</div>
                    </div>
                    <div>
                        <div className="text-display-sm font-bold text-kridha-accent">100%</div>
                        <div className="text-body-sm text-white/80">advance safe</div>
                    </div>
                </div>
            </div>
        </section>
    );
}