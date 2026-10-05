import React from 'react';
import { useI18n } from '../../i18n/I18nContext';

const ContactHeroSection: React.FC = () => {
  const { t } = useI18n();
  return (
    <section className="bg-[#F9F7FA] border-b border-[rgba(232,225,234,0.5)] py-20">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="text-center">
          {/* Label */}
          <div className="flex justify-center mb-4">
            <span className="font-space-mono text-xs text-[#A3078F] uppercase tracking-widest">
              {t('contact.label')}
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="font-fraunces text-6xl text-[#1A0A1E] mb-6">
            {t('contact.title')}
          </h1>

          {/* Subtitle */}
          <p className="font-manrope text-lg text-[#4B5563] leading-relaxed max-w-[672px] mx-auto">
            {t('contact.subtitle')}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ContactHeroSection;
