import React from 'react';

const SimpleFooter: React.FC = () => {
  return (
    <footer className="bg-[#F2EFF3] border-t border-[#E8E1EA] py-8">
      <div className="max-w-[1280px] mx-auto px-8 text-center">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-3">
          <img src="/logo.png" alt="" width="28" height="24" loading="lazy" decoding="async" className="h-6 w-auto" />
          <span className="font-manrope font-extralight text-sm text-[#1E293B] uppercase tracking-widest">
            Bhumi Bazar
          </span>
        </div>

        {/* Copyright */}
        <p className="font-manrope font-extralight text-xs text-[#94A3B8]">
          © 2023 Bhumi Bazar. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default SimpleFooter;