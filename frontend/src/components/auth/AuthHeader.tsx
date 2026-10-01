import React from 'react';
import { Link } from 'react-router-dom';

const AuthHeader: React.FC = () => {
  return (
    <Link to="/" className="flex items-center justify-center gap-3 mb-8">
      <img src="/logo.png" alt="" width="47" height="40" className="h-10 w-auto" />
      <span className="font-fraunces text-3xl font-bold text-[#111827]">Bhumi Bazar</span>
    </Link>
  );
};

export default AuthHeader;