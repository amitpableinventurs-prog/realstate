import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import EmiCalculator from '../components/tools/EmiCalculator';
import { useSEO } from '../hooks/useSEO';
import { useI18n } from '../i18n/I18nContext';
import { EMI_PLANS } from '../utils/emi';

// Stand-alone EMI calculator (/emi-calculator): any amount, no property needed.
// It uses the same calculator and plans as the "Buyer tools" card.

const EmiCalculatorPage: React.FC = () => {
  const { t } = useI18n();

  useSEO({
    title: 'EMI Calculator',
    description: 'Work out the monthly EMI on a land loan with Bhoomi Bazar: pick a period from 3 to 24 months and see the instalment, interest and total payable.',
    url: 'https://buildestate.vercel.app/emi-calculator',
  });

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <Navbar />

      <section className="bg-[#F9F7FA] border-b border-[rgba(232,225,234,0.5)] py-14 md:py-20">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 text-center">
          <span className="font-space-mono text-xs text-[#A3078F] uppercase tracking-widest">{t('tools.title')}</span>
          <h1 className="font-fraunces text-4xl md:text-6xl text-[#1A0A1E] mt-4 mb-5">{t('emi.title')}</h1>
          <p className="font-manrope text-lg text-[#4B5563] leading-relaxed max-w-[672px] mx-auto">{t('emi.subtitle')}</p>
        </div>
      </section>

      <main className="max-w-[1080px] mx-auto px-4 md:px-8 py-10 md:py-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="bg-white rounded-2xl border border-[#E8E1EA] p-5 md:p-8">
          <EmiCalculator />
        </div>

        <aside className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E8E1EA] p-6">
            <h2 className="font-fraunces text-xl text-[#1A0A1E] mb-4">{t('emiPage.plans')}</h2>
            <table className="w-full font-manrope text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[#6B7280]">
                  <th className="pb-2 font-semibold">{t('emi.period')}</th>
                  <th className="pb-2 font-semibold text-right">{t('emiPage.rate')}</th>
                </tr>
              </thead>
              <tbody>
                {EMI_PLANS.map((plan) => (
                  <tr key={plan.months} className="border-t border-[#F1ECF2]">
                    <td className="py-2.5 text-[#374151]">{t('emi.months', { n: plan.months })}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-[#1A0A1E]">{plan.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1EA] p-6">
            <h2 className="font-fraunces text-xl text-[#1A0A1E] mb-3">{t('emiPage.howTitle')}</h2>
            <p className="font-mono text-sm text-[#A3078F] bg-[#FAF8FB] rounded-lg px-3 py-2 mb-3 overflow-x-auto whitespace-nowrap">
              EMI = P × r × (1+r)ⁿ ÷ ((1+r)ⁿ − 1)
            </p>
            <p className="font-manrope text-sm text-[#4B5563] leading-relaxed">{t('emiPage.howText')}</p>
          </div>

          <div className="rounded-2xl bg-[#1A0A1E] p-6 text-white">
            <h2 className="font-fraunces text-xl mb-2">{t('emiPage.ctaTitle')}</h2>
            <p className="font-manrope text-sm text-white/70 mb-4">{t('emiPage.ctaText')}</p>
            <Link
              to="/properties"
              className="inline-flex items-center gap-2 bg-[#A3078F] hover:bg-[#8E0A82] text-white font-manrope font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
            >
              {t('emiPage.cta')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </aside>
      </main>

      <Footer />
    </div>
  );
};

export default EmiCalculatorPage;
