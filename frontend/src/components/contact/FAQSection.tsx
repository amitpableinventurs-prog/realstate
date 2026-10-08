import React, { useState } from 'react';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      id: 1,
      question: "How do I find the right land?",
      answer: "Choose your state and district, then filter by price, area and listing type. Each listing shows photos, khata and khasra numbers and the map location, and you can contact the owner directly."
    },
    {
      id: 2,
      question: "What areas do you currently cover?",
      answer: "We currently cover major metropolitan areas including Ahmedabad, Mumbai, Delhi, Bangalore, and Pune. We're expanding to more cities across India and will update our coverage area regularly."
    },
    {
      id: 3,
      question: "Can I list my property exclusively with Bhumi Bazar?",
      answer: "Yes, we offer exclusive listing agreements with premium marketing benefits including professional photography and dedicated property consultant support throughout the selling process."
    },
    {
      id: 4,
      question: "How do I schedule a virtual tour?",
      answer: "You can schedule a virtual tour directly from any property listing page by clicking the 'Schedule Virtual Tour' button. Choose your preferred date and time, and our team will send you a confirmation with the video conference link."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="bg-white py-24">
      <div className="max-w-[1280px] mx-auto px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-3">
            <span className="font-space-mono text-xs text-[#A3078F] uppercase tracking-widest">
              Help Center
            </span>
          </div>
          <h2 className="font-syne font-bold text-4xl text-[#1A0A1E] mb-4">
            Common Questions
          </h2>
          <p className="font-manrope text-lg text-[#4B5563] leading-relaxed max-w-[640px] mx-auto">
            Find quick answers to your most pressing questions about buying, selling, and
            partnering with Bhumi Bazar.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-[800px] mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={faq.id}
              className="bg-[#F9F7FA] border border-[#E8E1EA] rounded-xl overflow-hidden transition-all"
            >
              {/* Question */}
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full flex items-center gap-4 p-6 text-left hover:bg-[#F2EFF3] transition-[background-color]"
              >
                {/* Number Badge */}
                <div className="w-8 h-8 bg-[#F9F7FA] border border-[#E8E1EA] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-syne font-bold text-sm text-[#A3078F]">
                    {String(faq.id).padStart(2, '0')}
                  </span>
                </div>

                {/* Question Text */}
                <h3 className="flex-1 font-syne font-bold text-lg text-[#1A0A1E]">
                  {faq.question}
                </h3>

                {/* Expand/Collapse Icon */}
                <span className={`material-icons text-[#A3078F] transition-transform ${
                  openIndex === index ? 'rotate-180' : ''
                }`}>
                  expand_more
                </span>
              </button>

              {/* Answer */}
              {openIndex === index && (
                <div className="px-6 pb-6 pl-[72px]">
                  <p className="font-manrope font-extralight text-sm text-[#4B5563] leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* View All Questions Link */}
        <div className="text-center mt-12">
          <a 
            href="#" 
            className="inline-flex items-center gap-2 font-manrope font-bold text-base text-[#A3078F] hover:text-[#7A0A74] transition-[color] group"
          >
            <span>Get Full Knowledge Base</span>
            <span className="material-icons text-lg group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;