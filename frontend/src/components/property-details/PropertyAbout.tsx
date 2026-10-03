import React from 'react';
import { useI18n } from '../../i18n/I18nContext';

interface PropertyAboutProps {
  description?: string;
}

const PropertyAbout: React.FC<PropertyAboutProps> = ({ description = '' }) => {
  const { t } = useI18n();
  return (
    <div className="mb-12">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 bg-[#A3078F] rounded-full" />
        <h2 className="font-syne text-2xl text-[#0F172A]">
          {t('details.about')}
        </h2>
      </div>

      {/* Description (as written by the owner) */}
      <div className="space-y-4">
        {description.split('\n\n').map((paragraph, index) => (
          <p
            key={index}
            className="font-manrope font-extralight text-base text-[#64748B] leading-relaxed"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
};

export default PropertyAbout;
