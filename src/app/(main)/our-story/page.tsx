"use client";

import React, { useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
    Database,
    Lightbulb,
    Layers,
    Truck,
    TrendingUp,
    ShieldCheck,
    ArrowRight
} from "lucide-react";

/**
 * Interface for Stage Updates
 */
interface RoadmapStage {
    version: string;
    date: string;
    milestone: string;
    description: string;
}

const KRIDHA_COLORS = {
    primary: "#2A9D8F",
    bg: "#F9FAFB",
    surface: "#FFFFFF",
    text: "#111827",
    accent: "#E9F5F3"
};

/**
 * Mock function for roadmap fetching using TanStack Query pattern
 */
const fetchRoadmap = async (): Promise<RoadmapStage[]> => {
    return [
        {
            version: "2.0",
            date: "Current",
            milestone: "Stable Marketplace",
            description: "PostGIS discovery & 2-phase payments."
        },
        {
            version: "2.5",
            date: "Aug 2026",
            milestone: "Regional Expansion",
            description: "Scaling to Basti & Deoria clusters."
        },
        {
            version: "3.0",
            date: "Dec 2026",
            milestone: "Intelligent Supply Chain",
            description: "Predictive inventory for kirana owners."
        }
    ];
};

export default function KridhaStoryPage() {
    const { scrollYProgress } = useScroll();

    // Background parallax animation
    const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [1, 1, 1, 0.8]);

    const { data: roadmap } = useQuery({
        queryKey: ["roadmap"],
        queryFn: fetchRoadmap,
        staleTime: 1000 * 60 * 60,
    });

    return (
        <div className="relative min-h-screen overflow-hidden selection:bg-[#2A9D8F]/20" style={{ backgroundColor: KRIDHA_COLORS.bg }}>

            {/* Animated Background Elements */}
            <motion.div
                style={{ y: bgY }}
                className="fixed inset-0 pointer-events-none z-0"
            >
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#2A9D8F]/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#2A9D8F]/10 blur-[150px]" />
            </motion.div>

            {/* Hero Section: The Spark */}
            <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-[#2A9D8F]/10 text-[#2A9D8F] font-semibold text-sm">
                        <Lightbulb size={16} />
                        The Origin Story
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
                        From Industrial Systems <br />
                        <span style={{ color: KRIDHA_COLORS.primary }}>to Rural Commerce.</span>
                    </h1>
                    <p className="max-w-2xl mx-auto text-lg text-gray-600 leading-relaxed">
                        Born from the pneumatic pipelines of a 1200MW power plant, Kridha was built on a single truth:
                        <strong> Edge-failure design is not optional.</strong> We applied mechanical engineering
                        precision to the Tier-2 supply chain.
                    </p>
                </motion.div>
            </section>

            {/* Backend Heavy: The Architecture */}
            <section className="relative z-10 py-24 px-6 bg-white/50 backdrop-blur-sm border-y border-gray-100">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                    >
                        <Database className="mb-6 text-[#2A9D8F]" size={48} />
                        <h2 className="text-4xl font-bold mb-6">Backend-Heavy by Design</h2>
                        <p className="text-gray-600 mb-4 leading-relaxed">
                            While others focus on flashy storefronts, we built a fortress. Kridha handles 61 API endpoints
                            with strict system invariants[cite: 1, 2].
                        </p>
                        <ul className="space-y-4">
                            {[
                                "Pessimistic Locking for zero-stock errors",
                                "PostGIS-powered spatial discovery",
                                "2-Phase Advance+Pickup payments",
                                "Terminal state immutability[cite: 3]"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-gray-700">
                                    <ShieldCheck size={20} className="text-[#2A9D8F]" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="h-48 bg-gray-50 rounded-2xl border border-gray-100 p-6 flex flex-col justify-end">
                                <div className="text-3xl font-bold text-[#2A9D8F]">3x</div>
                                <div className="text-sm text-gray-500">Query Speedup[cite: 2]</div>
                            </div>
                            <div className="h-64 bg-[#2A9D8F] rounded-2xl p-6 flex flex-col justify-end text-white">
                                <div className="text-3xl font-bold">0</div>
                                <div className="text-sm opacity-80">Payment Mismatches</div>
                            </div>
                        </div>
                        <div className="space-y-4 pt-8">
                            <div className="h-64 bg-gray-900 rounded-2xl p-6 flex flex-col justify-end text-white">
                                <div className="text-3xl font-bold">19</div>
                                <div className="text-sm opacity-80">Invariants Enforced[cite: 1]</div>
                            </div>
                            <div className="h-48 bg-gray-50 rounded-2xl border border-gray-100 p-6 flex flex-col justify-end">
                                <div className="text-3xl font-bold text-[#2A9D8F]">100%</div>
                                <div className="text-sm text-gray-500">Cookie-Only Auth</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Differentiation: Separating from the Crowd */}
            <section className="relative z-10 py-32 px-6 overflow-hidden">
                <div className="max-w-4xl mx-auto text-center mb-20">
                    <h2 className="text-4xl font-bold mb-6 italic">How we separate from the crowd.</h2>
                    <p className="text-gray-600">We didn't build another delivery app. We built a trust layer.</p>
                </div>

                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: <Truck size={32} />,
                            title: "Logistics-Lite",
                            desc: "By removing delivery, we enable micro-orders (₹1,000) that Udaan won't touch[cite: 2]."
                        },
                        {
                            icon: <Layers size={32} />,
                            title: "Hindi-First i18n",
                            desc: "Notifications resolved at creation based on user preference, ensuring historical accuracy."
                        },
                        {
                            icon: <TrendingUp size={32} />,
                            title: "Tier-2 Mastery",
                            desc: "Optimized for Gorakhpur & Basti clusters. Built for Android-first kirana owners[cite: 2]."
                        }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -10 }}
                            className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-[#E9F5F3] flex items-center justify-center text-[#2A9D8F] mb-6">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                            <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Roadmap: Dec 2026 */}
            <section className="relative z-10 py-32 px-6">
                <div className="max-w-5xl mx-auto bg-gray-900 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-4xl md:text-5xl font-bold mb-12">The March to Stage 3.0</h2>
                        <div className="space-y-12">
                            {roadmap?.map((item, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.2 }}
                                    viewport={{ once: true }}
                                    className="flex gap-6"
                                >
                                    <div className="flex flex-col items-center">
                                        <div className="w-4 h-4 rounded-full bg-[#2A9D8F]" />
                                        {idx !== roadmap.length - 1 && <div className="w-px h-full bg-gray-700 my-2" />}
                                    </div>
                                    <div>
                                        <div className="text-[#2A9D8F] font-mono text-sm mb-1">{item.date} — v{item.version}</div>
                                        <h4 className="text-2xl font-bold mb-2">{item.milestone}</h4>
                                        <p className="text-gray-400">{item.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="mt-16 bg-[#2A9D8F] hover:bg-[#238b7d] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-colors"
                        >
                            Join the Evolution <ArrowRight size={20} />
                        </motion.button>
                    </div>

                    {/* Abstract roadmap decor */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#2A9D8F]/10 blur-[80px] -mr-32 -mt-32" />
                </div>
            </section>

            {/* Simple Footer */}
            <footer className="relative z-10 py-12 text-center text-gray-500 text-sm">
                © 2026 Kridha — किराना का भरोसेमंद साथी
            </footer>
        </div>
    );
}