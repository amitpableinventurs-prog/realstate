import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../common/Navbar';
import Footer from '../common/Footer';
import { useSEO } from '../../hooks/useSEO';
import { LEGAL } from '../../config/legal';

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

interface LegalPageProps {
  title: string;
  intro: React.ReactNode;
  seoDescription: string;
  sections: LegalSection[];
  /** Link to the other legal page, shown under the contents list */
  related: { to: string; label: string };
}

// Shared layout for the Terms of Service and Privacy Policy pages
const LegalPage: React.FC<LegalPageProps> = ({ title, intro, seoDescription, sections, related }) => {
  useSEO({ title: `${title} | ${LEGAL.brand}`, description: seoDescription });

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <Navbar />

      <header className="bg-white border-b border-[#E8E1EA]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
          <p className="font-manrope text-xs font-semibold uppercase tracking-widest text-[#A3078F] mb-3">Legal</p>
          <h1 className="font-fraunces text-4xl sm:text-5xl font-semibold text-[#1A0A1E] mb-3">{title}</h1>
          <p className="font-manrope text-sm text-[#6B7280]">Last updated: {LEGAL.lastUpdated}</p>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
        {/* Contents */}
        <nav aria-label="Contents" className="mb-10 lg:mb-0">
          <div className="lg:sticky lg:top-24 bg-white border border-[#E8E1EA] rounded-2xl p-5">
            <p className="font-manrope text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-3">Contents</p>
            <ol className="space-y-2 list-decimal list-inside font-manrope text-sm">
              {sections.map((s) => (
                <li key={s.id} className="text-[#9CA3AF]">
                  <a href={`#${s.id}`} className="text-[#374151] hover:text-[#A3078F] transition-[color]">{s.title}</a>
                </li>
              ))}
            </ol>
            <Link
              to={related.to}
              className="inline-block mt-5 font-manrope text-sm font-semibold text-[#A3078F] hover:text-[#7A0A74]"
            >
              {related.label} →
            </Link>
          </div>
        </nav>

        {/* Body */}
        <article className="bg-white border border-[#E8E1EA] rounded-2xl p-6 sm:p-10 font-manrope text-[15px] leading-relaxed text-[#374151]">
          <div className="mb-8 text-[#4B5563]">{intro}</div>
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 mb-10 last:mb-0">
              <h2 className="font-fraunces text-2xl font-semibold text-[#1A0A1E] mb-3">
                {i + 1}. {s.title}
              </h2>
              <div className="space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-[#1A0A1E] [&_a]:text-[#A3078F] [&_a:hover]:text-[#7A0A74]">
                {s.body}
              </div>
            </section>
          ))}
        </article>
      </div>

      <Footer />
    </div>
  );
};

/** Contact block used as the last section of both pages */
export const LegalContact: React.FC = () => (
  <>
    <p>
      For questions about this page, your account or your data, contact {LEGAL.brand} ({LEGAL.companyName}):
    </p>
    <ul>
      <li>Email: {LEGAL.email}</li>
      <li>Phone: {LEGAL.phone}</li>
      <li>Address: {LEGAL.address}</li>
    </ul>
    <p>
      <strong>Grievance Officer:</strong> {LEGAL.grievanceOfficer.name}, {LEGAL.grievanceOfficer.email}.
      We acknowledge complaints within 24 hours and aim to resolve them within 15 days.
    </p>
  </>
);

export default LegalPage;
