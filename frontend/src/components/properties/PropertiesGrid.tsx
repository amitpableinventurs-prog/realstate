import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Maximize2 } from 'lucide-react';
import PropertyCard from './PropertyCard';
import { useI18n } from '../../i18n/I18nContext';
import { useLandText } from '../../i18n/useLandText';
import type { Property } from '../../utils/propertyDisplay';

const fallbackImages = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800",
  "https://images.unsplash.com/photo-1500076656116-558758c991c1?w=800",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?w=800",
];

interface PropertiesGridProps {
  properties: Property[];
  viewMode?: 'grid' | 'list';
  /** Save / unsave a property (wishlist); hides the heart when not given */
  onToggleSave?: (property: Property) => void;
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const badgeTone = (p: Property) => (['SOLD', 'RENTED', 'LEASED'].includes(p.status) ? 'closed' as const : p.listingType);

// List view row — more compact than the card
const PropertyRow: React.FC<{ property: Property; index: number }> = ({ property, index }) => {
  const text = useLandText();
  const title = text.title(property);
  return (
    <Link to={`/property/${property._id}`} className="group block outline-none focus-visible:ring-2 focus-visible:ring-[#A3078F] rounded-2xl">
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-shadow duration-300 flex gap-0">
        <div className="relative w-52 shrink-0 overflow-hidden">
          <img
            src={property.image[0] || fallbackImages[index % fallbackImages.length]}
            alt={title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded font-space-mono text-[10px] font-bold text-white bg-[#10B981]">
            {text.badge(property)}
          </div>
        </div>
        <div className="flex-1 px-6 py-5 flex flex-col justify-between">
          <div>
            <h3 className="font-fraunces text-lg font-semibold text-[#1A0A1E] mb-1 leading-snug">{title}</h3>
            <div className="flex items-center gap-1 mb-3">
              <MapPin className="w-3.5 h-3.5 text-[#A3078F] shrink-0" />
              <span className="font-manrope text-sm text-[#6B7280]">{property.location}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-manrope text-sm text-[#6B7280]">
              {text.specs(property).map((spec, i) => (
                <span key={spec} className="flex items-center gap-1.5">
                  {i === 0 && <Maximize2 className="w-4 h-4" />}{spec}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="font-fraunces text-2xl font-bold text-[#A3078F] tabular-nums">{text.price(property)}</p>
            {text.estTotal(property) && (
              <p className="font-manrope text-xs text-[#6B7280] tabular-nums">{text.estTotal(property)}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

const PropertiesGrid: React.FC<PropertiesGridProps> = ({ properties, viewMode = 'grid', onToggleSave }) => {
  const { t } = useI18n();
  const text = useLandText();
  return (
    <div className="max-w-[1440px] mx-auto px-6 pb-16 pt-4">
      {viewMode === 'grid' ? (
        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {properties.map((property, index) => (
            <motion.div key={property._id} variants={item}>
              <PropertyCard
                id={property._id}
                image={property.image[0] || fallbackImages[index % fallbackImages.length]}
                images={property.media.filter((item) => item.type === 'IMAGE').map((item) => item.url)}
                name={text.title(property)}
                price={text.price(property)}
                subPrice={text.estTotal(property)}
                location={property.location}
                specs={text.specs(property)}
                badge={text.badge(property)}
                badgeTone={badgeTone(property)}
                tags={[t('property.land')]}
                saved={property.isSaved}
                onToggleSave={onToggleSave ? () => onToggleSave(property) : undefined}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-4">
          {properties.map((property, index) => (
            <motion.div key={property._id} variants={item}>
              <PropertyRow property={property} index={index} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default PropertiesGrid;
