import { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { DealsSection } from '@/components/home/DealsSection';
import { HowItWorks } from '@/components/home/HowItWorks';
import { WhyKridha } from '@/components/home/WhyKridha';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { CtaBanner } from '@/components/home/CtaBanner';
import { KridhaFAQ } from '@/components/home/faq';

export const metadata: Metadata = {
    title: 'Kridha — किराना का भरोसेमंद साथी',
};

export default function HomePage() {
    return (
      <main>
        <Navbar />
        <HeroSection />
        {/* <DealsSection /> */}
        <HowItWorks />
        <WhyKridha />
        <TestimonialsSection />
        <CtaBanner />
        <KridhaFAQ/>
        <Footer />
      </main>
    );
}