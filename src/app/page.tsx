'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';

// Stat counter animation
function AnimatedStat({
    target,
    label,
    suffix = '',
}: {
    target: number;
    label: string;
    suffix?: string;
}) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const step = Math.ceil(target / 40);
        const timer = setInterval(() => {
            start += step;
            if (start >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(start);
            }
        }, 25);
        return () => clearInterval(timer);
    }, [target]);

    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-extrabold text-kridha-primary">
                {count.toLocaleString('en-IN')}
                {suffix}
            </span>
            <span className="text-xs text-muted text-center">{label}</span>
        </div>
    );
}

export default function HomePage() {
    const [menu, setMenu] = useState(false);

    return (
        <main className="min-h-screen bg-background font-[Inter,sans-serif]">
            {/* NAVBAR */}
            <header className="sticky top-0 z-30 w-full bg-background/95 border-b border-gray-200/50 backdrop-blur">
                <nav className="max-w-7xl mx-auto flex items-center justify-between h-16 px-3 md:px-8">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kridha-primary to-kridha-primary/80 flex items-center justify-center shadow-md">
                            <span className="text-surface font-bold text-lg">K</span>
                        </div>
                        <span className="text-xl font-bold text-text tracking-tight hidden sm:inline">Kridha</span>
                    </Link>
                    <div className="hidden md:flex items-center gap-8 ml-6 text-sm">
                        <a href="#features" className="text-muted hover:text-kridha-primary font-medium transition">Features</a>
                        <a href="#deals" className="text-muted hover:text-kridha-primary font-medium transition">Top Deals</a>
                        <a href="#how" className="text-muted hover:text-kridha-primary font-medium transition">How it Works</a>
                    </div>
                    <div className="hidden md:flex items-center gap-3">
                        <Link href="/login" className="px-4 py-2 rounded-lg text-sm text-muted hover:text-kridha-primary transition">Login</Link>
                        <Link href="/signup" className="bg-kridha-primary text-surface font-semibold px-5 py-2 rounded-lg text-sm shadow hover:bg-kridha-primary/90 transition">Get started</Link>
                    </div>
                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-kridha-secondary"
                        onClick={() => setMenu(s => !s)}
                        aria-label="Toggle menu"
                    >
                        {menu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </nav>
                {/* Mobile Menu */}
                {menu && (
                    <div className="md:hidden border-t border-gray-200 bg-background/95 backdrop-blur">
                        <div className="flex flex-col px-5 py-4 gap-2">
                            <a onClick={() => setMenu(false)} href="#features" className="py-2 text-sm font-medium text-muted hover:text-kridha-primary transition">Features</a>
                            <a onClick={() => setMenu(false)} href="#deals" className="py-2 text-sm font-medium text-muted hover:text-kridha-primary transition">Top Deals</a>
                            <a onClick={() => setMenu(false)} href="#how" className="py-2 text-sm font-medium text-muted hover:text-kridha-primary transition">How it Works</a>
                            <Link onClick={() => setMenu(false)} href="/login" className="py-2 text-sm font-medium text-kridha-primary">Login</Link>
                            <Link onClick={() => setMenu(false)} href="/signup" className="bg-kridha-primary text-surface font-semibold w-full py-2 rounded-lg text-center text-sm mt-2">Get started</Link>
                        </div>
                    </div>
                )}
            </header>

            {/* HERO SECTION */}
            <section className="w-full px-4 pt-10 pb-12 md:pt-20 md:pb-24 bg-background relative">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 items-center">
                    <div className="flex flex-col gap-7 lg:gap-10">
                        <h1 className="text-[2rem] sm:text-3xl md:text-5xl font-bold text-text leading-[1.19]">
                            The <span className="text-kridha-primary">Easiest way</span> to source for your Kirana.
                        </h1>
                        <p className="text-muted md:text-lg text-base max-w-lg">
                            Buy direct from trusted suppliers & micro-mills in your city. Explore nearby inventory, pre-book at best prices, and pick up at your convenience.
                        </p>
                        <div className="flex flex-col xs:flex-row gap-3 mt-2">
                            <Link href="/signup" className="flex items-center justify-center gap-2 bg-kridha-primary text-surface font-semibold px-7 py-3 rounded-xl hover:scale-105 hover:shadow-lg transition text-base">
                                Start for Free <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link href="/login" className="flex items-center justify-center gap-2 border-2 border-kridha-primary text-kridha-primary font-semibold px-7 py-3 rounded-xl hover:bg-kridha-primary/10 transition text-base">
                                Log In
                            </Link>
                        </div>
                        {/* Trust meter */}
                        <div className="flex items-center gap-3 pt-4">
                            <div className="flex -space-x-3">
                                <div className="bg-kridha-primary text-surface w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ring-2 ring-surface">र</div>
                                <div className="bg-kridha-accent text-[#222] w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ring-2 ring-surface">स</div>
                                <div className="bg-red-500 text-surface w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ring-2 ring-surface">म</div>
                            </div>
                            <p className="text-xs text-muted">50+ suppliers joined last week.</p>
                        </div>
                    </div>
                    {/* Card Visual */}
                    <div className="hidden lg:flex justify-center">
                        <div className="w-96 rounded-3xl border border-gray-200 bg-surface shadow-2xl overflow-hidden mt-2 hover:scale-105 transition">
                            <div className="bg-gradient-to-br from-kridha-primary to-kridha-primary/90 px-6 py-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-surface/70 font-semibold text-xs">ORDER SUMMARY</span>
                                    <span className="bg-kridha-accent/20 text-accent font-semibold text-xs px-3 py-0.5 rounded-full">
                                        ACTIVE
                                    </span>
                                </div>
                                <p className="text-surface font-bold text-xl tracking-tight">20kg Wheat</p>
                                <p className="text-surface/70 text-xs">Raj Mills · 4.5 km</p>
                            </div>
                            <div className="px-6 py-5">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span>Deal Price</span>
                                        <span className="text-kridha-primary font-semibold">₹1020</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span>Payment</span>
                                        <span className="font-semibold">5% Advance</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted pt-2">
                                        <span>Pickup @ supplier</span>
                                        <span>Tue 11:00–14:00</span>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    {[4, 8, 2, 1].map((n) => (
                                        <span key={n} className="block bg-kridha-accent/20 border border-kridha-accent rounded-lg w-10 h-12 text-xl font-bold flex items-center justify-center text-kridha-primary"> {n} </span>
                                    ))}
                                </div>
                            </div>
                            <span className="absolute -top-3 -right-3 bg-red-500 text-surface font-bold text-xs px-3 py-1.5 rounded-full shadow-lg">10% DEAL</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* CATEGORY CAROUSEL */}
            <section className="pt-6 pb-0 px-0 mb-2 bg-surface" id="features">
                <div className="max-w-7xl mx-auto px-4 flex gap-3 snap-x snap-mandatory overflow-x-auto scrollbar-hide md:justify-center">
                    {[
                        { icon: '🌾', label: 'Grains' },
                        { icon: '🫘', label: 'Pulses' },
                        { icon: '🥛', label: 'Dairy' },
                        { icon: '🍅', label: 'Veggies' },
                        { icon: '🛢️', label: 'Oils' },
                        { icon: '🌶️', label: 'Spices' },
                        { icon: '🥫', label: 'Packaged' },
                        { icon: '🍪', label: 'Bakery' },
                        { icon: '🍹', label: 'Beverages' },
                    ].map((cat, i) => (
                        <div key={i} className="w-20 flex-shrink-0 snap-center flex flex-col justify-center items-center py-4 px-2">
                            <div className="w-14 h-14 mb-1 flex items-center justify-center bg-kridha-secondary rounded-xl text-2xl">{cat.icon}</div>
                            <span className="text-xs text-muted font-medium text-center">{cat.label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* TOP DEALS SECTION */}
            <section id="deals" className="bg-kridha-secondary py-10 px-4 md:px-0">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-extrabold text-text">🔥 Top Deals Today</h2>
                        <Link href="/deals" className="text-sm text-kridha-primary font-semibold hover:underline">See all</Link>
                    </div>
                    <div className="flex gap-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
                        {[1, 2, 3, 4, 5].map((deal) => (
                            <Link key={deal} href={`/product/${deal}`} className="w-60 flex-shrink-0 snap-center bg-surface border border-gray-100 rounded-2xl flex flex-col p-4 hover:shadow-lg transition shadow-md">
                                <div className="h-32 w-full bg-gray-200 rounded-xl flex items-center justify-center mb-2 overflow-hidden">
                                    <span className="text-3xl">🛒</span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-kridha-primary font-semibold">Mustard Oil</span>
                                    <span className="text-xs bg-red-500 text-surface rounded-full px-2 py-0.5 font-bold">-12%</span>
                                </div>
                                <span className="text-muted text-xs">Patel Exports · 2km</span>
                                <div className="flex items-end gap-2 mt-2">
                                    <span className="text-xl font-bold text-text">₹160</span>
                                    <span className="line-through text-xs text-muted">₹180</span>
                                </div>
                                <span className="block text-xs text-muted">Pickup: Today</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* STATS SECTION */}
            <section className="py-12 bg-background border-y border-gray-100">
                <div className="max-w-6xl mx-auto px-3 grid grid-cols-2 sm:grid-cols-4 gap-8">
                    <AnimatedStat target={159} label="Registered suppliers" suffix="+" />
                    <AnimatedStat target={10} label="Km radius search" />
                    <AnimatedStat target={0} label="Delivery charges" />
                    <AnimatedStat target={1000} label="Active buyers" suffix="+" />
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section id="how" className="py-16 px-4 bg-surface max-w-7xl mx-auto">
                <h2 className="text-center text-2xl md:text-3xl font-extrabold text-text mb-8">How it Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    {[
                        {
                            icon: "🔍",
                            title: "Search",
                            desc: "Browse products and deals from trusted suppliers within your city.",
                        },
                        {
                            icon: "💵",
                            title: "Book & Pay",
                            desc: "Pay just 5% advance online to block inventory. Confirm instantly.",
                        },
                        {
                            icon: "🤝",
                            title: "Pickup & Inspect",
                            desc: "Visit the supplier, inspect goods, and pay the remaining amount on pickup.",
                        }
                    ].map((step, idx) => (
                        <div key={idx} className="flex flex-col gap-3 items-center bg-kridha-secondary/40 p-6 rounded-xl border border-gray-100 text-center hover:scale-105 hover:shadow-md transition">
                            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-kridha-primary/10 text-2xl">{step.icon}</div>
                            <h3 className="text-base font-bold text-text">{step.title}</h3>
                            <p className="text-xs text-muted">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* TESTIMONIALS AND SOCIAL PROOF */}
            <section className="py-10 bg-background">
                <div className="max-w-6xl mx-auto px-4">
                    <h2 className="text-lg md:text-xl font-bold text-text mb-5">Trusted by the best in the business</h2>
                    <div className="flex items-center gap-5 overflow-x-auto scrollbar-hide">
                        {[
                            { name: 'Ramesh', role: 'Retailer', review: `Lowest prices. Fast pickup — no delivery delays. Highly recommended!` },
                            { name: 'Suresh', role: 'Supplier', review: `Advance payments made my cashflow reliable. Inventory always fresh.` },
                            { name: 'Mohan', role: 'Retailer', review: `Search & book system is a game changer. No more endless calls or bargaining.` },
                        ].map((t, i) => (
                            <div key={i} className="bg-surface border border-gray-100 p-5 rounded-xl flex flex-col min-w-[220px] shadow hover:shadow-lg transition mb-2">
                                <span className="font-bold text-kridha-primary mb-1">“</span>
                                <span className="text-xs text-muted mb-2 flex-1">{t.review}</span>
                                <span className="text-sm font-medium text-text">{t.name} <span className="text-xs text-muted">• {t.role}</span></span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-gray-100 bg-background/75 px-4 py-10">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-kridha-accent flex items-center justify-center">
                            <span className="font-bold text-xs text-text">K</span>
                        </div>
                        <span className="font-bold text-text">Kridha</span>
                    </div>
                    <p className="text-xs text-muted mt-2 md:mt-0 text-center">
                        B2B+B2C self-pickup marketplace • Built with Next.js, Prisma, PostgreSQL, Redis & Razorpay
                    </p>
                    <p className="text-xs text-muted text-center">
                        &copy; {new Date().getFullYear()} Kridha
                    </p>
                </div>
            </footer>
        </main>
    );
}