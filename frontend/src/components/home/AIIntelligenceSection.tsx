import React from 'react';

const AIIntelligenceSection: React.FC = () => {
  return (
    <section className="bg-[#F8F6F9] py-24">
      <div className="max-w-[1280px] mx-auto px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="font-space-mono text-sm text-[#A3078F] uppercase tracking-widest mb-4">Why Choose Us?</div>
          <h2 className="font-fraunces text-5xl text-[#111827] mb-6">Land Buying, Made Simple</h2>
          <p className="font-manrope font-light text-lg text-[#4b5563] max-w-[740px] mx-auto">
            Clear details, direct contact with owners and local support, so you can buy or sell land with confidence.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 shadow-[0px_20px_25px_-5px_rgba(229,231,235,0.5)]">
            <div className="w-14 h-14 bg-[rgba(163,7,143,0.1)] rounded-xl flex items-center justify-center mb-6">
              <span className="font-material-icons text-3xl text-[#A3078F]" aria-hidden="true">verified</span>
            </div>
            <h3 className="font-syne font-bold text-2xl text-[#111827] mb-4">Verified Listings</h3>
            <p className="font-manrope text-base text-[#6b7280] leading-relaxed">
              Every plot is reviewed before it goes live, with khata and khasra numbers, area and price shown clearly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 shadow-[0px_20px_25px_-5px_rgba(229,231,235,0.5)]">
            <div className="w-14 h-14 bg-[rgba(163,7,143,0.1)] rounded-xl flex items-center justify-center mb-6">
              <span className="font-material-icons text-3xl text-[#A3078F]" aria-hidden="true">call</span>
            </div>
            <h3 className="font-syne font-bold text-2xl text-[#111827] mb-4">Talk to the Owner</h3>
            <p className="font-manrope text-base text-[#6b7280] leading-relaxed">
              Call or WhatsApp the seller directly, and book a visit to see the land for yourself.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 shadow-[0px_20px_25px_-5px_rgba(229,231,235,0.5)]">
            <div className="w-14 h-14 bg-[rgba(163,7,143,0.1)] rounded-xl flex items-center justify-center mb-6">
              <span className="font-material-icons text-3xl text-[#A3078F]" aria-hidden="true">location_city</span>
            </div>
            <h3 className="font-syne font-bold text-2xl text-[#111827] mb-4">Find Land Near You</h3>
            <p className="font-manrope text-base text-[#6b7280] leading-relaxed">
              Search by state and district, and see each plot on the map with photos and videos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIIntelligenceSection;
