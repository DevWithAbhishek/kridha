import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

export default function SupportPage() {
    const faqs = [
        {
            q: "Order कैसे cancel करें?",
            a: "Order detail page से cancel करें। Refund tiers लागू होंगे।",
        },
        {
            q: "Advance refund कब मिलेगा?",
            a: "3-5 working days में वापस मिलेगा।",
        },
    ];

    return (
        <div className="p-6 space-y-6">

            <div>
                <h1 className="text-h1">सहायता केंद्र</h1>
                <p className="text-muted">हम यहाँ हैं आपकी मदद के लिए</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">

                <Link
                    href="https://wa.me/91XXXXXXXXXX"
                    target="_blank"
                    className="p-4 border rounded-card bg-green-50"
                >
                    WhatsApp पर बात करें
                </Link>

                <Link
                    href="mailto:support@kridha.in"
                    className="p-4 border rounded-card bg-info-light"
                >
                    Email करें
                </Link>

                <div className="p-4 border rounded-card bg-kridha-secondary">
                    सोम-शनि 9am-6pm IST
                </div>
            </div>

            <Accordion.Root type="single" collapsible>
                {faqs.map((f, i) => (
                    <Accordion.Item key={i} value={`item-${i}`}>
                        <Accordion.Trigger className="flex justify-between w-full px-5 py-4">
                            {f.q}
                            <ChevronDown />
                        </Accordion.Trigger>
                        <Accordion.Content className="px-5 pb-4 text-muted">
                            {f.a}
                        </Accordion.Content>
                    </Accordion.Item>
                ))}
            </Accordion.Root>
        </div>
    );
}