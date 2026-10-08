import React from 'react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { useSEO } from '../hooks/useSEO';
import StructuredData from '../components/common/StructuredData';
import HeroSection from '../components/home/HeroSection';
import StatsSection from '../components/home/StatsSection';
import AIIntelligenceSection from '../components/home/AIIntelligenceSection';
import CuratedListingsSection from '../components/home/CuratedListingsSection';
import ProcessSection from '../components/home/ProcessSection';
import TrustSignalsSection from '../components/home/TrustSignalsSection';
import TestimonialsSection from '../components/home/TestimonialsSection';
import CTASection from '../components/home/CTASection';

const HomePage: React.FC = () => {
  useSEO({
    title: 'Buy, Sell & Rent Land in India',
    description: 'Bhumi Bazar helps you find plots and land for sale, rent or lease across India, with verified listings and direct owner contact.',
    url: 'https://buildestate.vercel.app',
  });

  return (
    <div className="bg-[#F8F6F9] min-h-screen">
      <StructuredData
        type="speakable"
        data={{ cssSelector: ['h1', '[data-speakable]'] }}
      />
      <StructuredData
        type="howTo"
        data={{
          howToName: 'How to Buy Land with Bhumi Bazar',
          howToDescription: 'Simple steps to find and buy land in India.',
          steps: [
            { name: 'Search', text: 'Pick your state and district, then filter by price, area and listing type.' },
            { name: 'Shortlist', text: 'Compare plots with photos, khata and khasra numbers, and save the ones you like.' },
            { name: 'Visit & Talk', text: 'See the location on the map, talk to the owner and book a visit to the land.' },
            { name: 'Close the Deal', text: 'Agree on the price with the owner and complete the paperwork with the help of our team.' },
          ],
        }}
      />

      {/* Sticky Navigation */}
      <Navbar />

      {/* Hero Section */}
      <HeroSection />

      {/* Stats Section */}
      <StatsSection />

      {/* Why choose us */}
      <AIIntelligenceSection />

      {/* Curated Listings Section */}
      <CuratedListingsSection />

      {/* The Path to Your New Beginning Section */}
      <ProcessSection />

      {/* Redefining Real Estate Section */}
      <TrustSignalsSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default HomePage;