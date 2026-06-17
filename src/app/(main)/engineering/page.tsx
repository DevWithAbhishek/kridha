import { Metadata } from 'next';
import {EngineeringHighlights, HowIBuiltKridha} from "@/components/home/Sections"
import { ArchitecturePreview, SecurityHighlights } from '@/components/home/arch-security';
import {EngineeringChallengesSolved, PerformanceTesting} from "@/components/home/performance"

export const metadata: Metadata = {
    title: 'Kridha - for local Kiranas',
};

export default function Engineering() {
    return (
      <main>
        <HowIBuiltKridha />
        <EngineeringHighlights />
        <ArchitecturePreview/>
        <SecurityHighlights />
        <EngineeringChallengesSolved />
        <PerformanceTesting />
      </main>
    );
}