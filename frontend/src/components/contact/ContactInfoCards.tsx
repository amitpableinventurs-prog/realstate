import React from 'react';
import type { PlatformContact } from '../../services/api';

const ContactInfoCards: React.FC<{ contact: PlatformContact }> = ({ contact }) => {
  return (
    <div className="space-y-6">
      {/* Visit Our Office Card */}
      <div className="bg-white border border-[#E8E1EA] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[rgba(163,7,143,0.1)] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-icons text-2xl text-[#A3078F]">
              location_on
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-syne font-bold text-lg text-[#1A0A1E] mb-2">
              Visit Our Office
            </h3>
            <p className="font-manrope font-extralight text-sm text-[#4B5563] leading-relaxed mb-3">
              502, Devpath Building,<br />
              Near Torrent Lab,<br />
              Ashram Road, Ahmedabad
            </p>
            <a 
              href="https://maps.google.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-manrope font-medium text-sm text-[#A3078F] hover:text-[#7A0A74] transition-[color]"
            >
              <span>Get Directions</span>
              <span className="material-icons text-sm">
                arrow_forward
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Call or Email Us Card */}
      <div className="bg-white border border-[#E8E1EA] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[rgba(163,7,143,0.1)] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-icons text-2xl text-[#A3078F]">
              phone
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-syne font-bold text-lg text-[#1A0A1E] mb-3">
              Call or Email Us
            </h3>
            <div className="space-y-2">
              {contact.whatsapp && <a
                href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-manrope font-extralight text-sm text-[#4B5563] hover:text-[#A3078F] transition-[color]"
              >
                <span className="material-icons text-base">
                  chat
                </span>
                <span>{contact.whatsapp}</span>
              </a>}
              {contact.email && <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 font-manrope font-extralight text-sm text-[#4B5563] hover:text-[#A3078F] transition-[color]"
              >
                <span className="material-icons text-base">
                  email
                </span>
                <span>{contact.email}</span>
              </a>}
              {!contact.whatsapp && !contact.email && <p className="font-manrope text-sm text-[#6B7280]">Contact details are temporarily unavailable.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Business Hours Card */}
      <div className="bg-white border border-[#E8E1EA] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[rgba(163,7,143,0.1)] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-icons text-2xl text-[#A3078F]">
              schedule
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-syne font-bold text-lg text-[#1A0A1E] mb-3">
              Business Hours
            </h3>
            <div className="space-y-2 font-manrope font-extralight text-sm text-[#4B5563]">
              <div className="flex justify-between items-center">
                <span>Mon - Fri:</span>
                <span className="font-medium text-[#1A0A1E]">09:00 - 18:00</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Saturday:</span>
                <span className="font-medium text-[#1A0A1E]">10:00 - 16:00</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Sunday:</span>
                <span className="font-medium text-[#1A0A1E]">Closed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactInfoCards;
