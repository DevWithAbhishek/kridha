import Image from 'next/image';

const testimonials = [
    {
        quote: 'Kridha से सरसों का तेल सीधे mill से मिला। advance दिया, pickup किया। एकदम सही।',
        name: 'Ramesh Gupta',
        role: 'Kirana owner',
    },
    {
        quote: 'Price tiers से bulk में सस्ता पड़ा। No middleman.',
        name: 'Suresh Yadav',
        role: 'Mill owner',
    },
    {
        quote: 'OTP से pickup — trust बना। पैसे safe रहे।',
        name: 'Mohan Singh',
        role: 'Supplier',
    },
];

export function TestimonialsSection() {
    return (
        <section className="bg-background-subtle dark:bg-gray-800 py-section-y">
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {testimonials.map((testimonial, index) => (
                        <div key={index} className="bg-[var(--color-surface)] dark:bg-surface-dark rounded-card shadow-card p-card border border-[var(--color-border)]">
                            <div className="flex mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className="text-kridha-accent">★</span>
                                ))}
                            </div>
                            <blockquote className="text-body-md italic text-[var(--color-text)] mb-4">
                                `${testimonial.quote}`
                            </blockquote>
                            <div className="flex items-center gap-3">
                                <Image
                                    src="/images/profile-default.png"
                                    alt={testimonial.name}
                                    width={40}
                                    height={40}
                                    className="rounded-full object-cover"
                                />
                                <div>
                                    <div className="text-h6 font-semibold">{testimonial.name}</div>
                                    <div className="text-label-sm text-muted">{testimonial.role}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}