import React, { useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/types';
import LanguageSwitcher from '../tools/LanguageSwitcher';

const navLinks: { path: string; label: TranslationKey }[] = [
  { path: '/', label: 'nav.home' },
  { path: '/properties', label: 'nav.properties' },
  { path: '/search', label: 'nav.search' },
  { path: '/blog', label: 'nav.blog' },
  { path: '/about', label: 'nav.about' },
  { path: '/contact', label: 'nav.contact' },
];

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 100], [0.8, 0.95]);

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    closeMobileMenu();
    setIsUserMenuOpen(false);
    navigate('/');
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Initials avatar
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <>
    {/* Skip-to-main-content — keyboard accessibility */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-[#A3078F] focus:text-white focus:font-manrope focus:font-bold focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
    >
      {t('nav.skip')}
    </a>
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{ backgroundColor: `rgba(255, 255, 255, ${bgOpacity.get()})` }}
      className="sticky top-0 z-50 border-b border-[#E6D6E8] backdrop-blur-md"
    >
      <div className="max-w-[1280px] mx-auto px-8 flex items-center justify-between h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0" onClick={closeMobileMenu}>
          <img src="/logo.png" alt="Bhumi Bazar" width="36" height="36" className="h-9 w-auto" />
          <span className="font-fraunces text-2xl font-bold text-[#111827]">Bhumi Bazar</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`font-manrope transition-[color] ${
                isActive(link.path)
                  ? 'text-[#A3078F] font-semibold'
                  : 'text-[#374151] hover:text-[#A3078F]'
              }`}
            >
              {t(link.label)}
            </Link>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          {isAuthenticated && user ? (
            <>
              <Link
                to="/add-property"
                className="bg-[#A3078F] text-white font-manrope font-bold px-5 py-2 rounded-xl hover:bg-[#8E0A82] transition-[background-color,box-shadow] hover:shadow-md active:scale-[0.96] transition-transform"
              >
                {t('nav.listProperty')}
              </Link>

              {/* User avatar dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  aria-expanded={isUserMenuOpen}
                  aria-label="User menu"
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-[#FAF8FB] transition-[background-color,border-color] border border-transparent hover:border-[#E6D6E8] active:scale-[0.96]"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#A3078F] text-white font-manrope font-bold text-xs flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <span className="font-manrope font-semibold text-[#1A0A1E] max-w-[100px] truncate">
                    {user.name ? user.name.split(' ')[0] : t('nav.account')}
                  </span>
                  <span className="font-material-icons text-[#9CA3AF] text-lg" aria-hidden="true">
                    {isUserMenuOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[#E6D6E8] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] py-2 z-50">
                    <div className="px-4 py-2.5 border-b border-[#F3F0F4] mb-1">
                      <p className="font-manrope text-xs text-[#9CA3AF]">{t('nav.signedInAs')}</p>
                      <p className="font-manrope text-sm font-semibold text-[#1A0A1E] truncate">{user.mobile}</p>
                    </div>
                    {[
                      { to: '/dashboard', icon: 'dashboard', label: t('nav.dashboard') },
                      { to: '/my-listings', icon: 'home_work', label: t('nav.myListings') },
                      { to: '/wishlist', icon: 'favorite_border', label: t('nav.saved') },
                      { to: '/enquiries', icon: 'forum', label: t('nav.enquiries') },
                      { to: '/notifications', icon: 'notifications_none', label: t('nav.notifications') },
                      { to: '/profile', icon: 'person_outline', label: t('nav.profile') },
                    ].map(({ to, icon, label }) => (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setIsUserMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 font-manrope text-sm transition-[background-color,color] mx-1 rounded-xl ${
                          isActive(to) ? 'text-[#A3078F] font-semibold bg-[#FAF8FB]' : 'text-[#374151] hover:bg-[#FAF8FB] hover:text-[#A3078F]'
                        }`}
                      >
                        <span className="font-material-icons text-base" aria-hidden="true">{icon}</span>
                        {label}
                      </Link>
                    ))}
                    <div className="border-t border-[#F3F0F4] mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 font-manrope text-sm text-[#374151] hover:bg-red-50 hover:text-red-500 transition-[background-color,color] mx-1 rounded-xl"
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        <span className="font-material-icons text-base" aria-hidden="true">logout</span>
                        {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className="font-manrope font-semibold text-[#374151] hover:text-[#A3078F] transition-[color] px-4 py-2"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/add-property"
                className="bg-[#A3078F] text-white font-manrope font-bold px-6 py-2 rounded-xl hover:bg-[#8E0A82] transition-[background-color,box-shadow] hover:shadow-md active:scale-[0.96]"
              >
                {t('nav.listProperty')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-[#374151] hover:text-[#A3078F] transition-[color]"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
        >
          <span className="font-material-icons text-2xl" aria-hidden="true">
            {isMobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-[#E6D6E8] shadow-lg py-4 px-8 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`font-manrope text-base py-2.5 transition-[color] ${
                isActive(link.path) ? 'text-[#A3078F] font-semibold' : 'text-[#374151]'
              }`}
              onClick={closeMobileMenu}
            >
              {t(link.label)}
            </Link>
          ))}

          <LanguageSwitcher className="self-start -ml-2" />

          <div className="border-t border-gray-100 mt-2 pt-3 flex flex-col gap-1">
            {isAuthenticated && user ? (
              <>
                <p className="font-manrope text-xs text-[#9CA3AF] mb-1">
                  {t('nav.signedInAs')} <span className="font-semibold text-[#374151]">{user.name || user.mobile}</span>
                </p>
                <Link to="/dashboard" className="font-manrope text-base py-2.5 text-[#374151] hover:text-[#A3078F] transition-[color]" onClick={closeMobileMenu}>{t('nav.dashboard')}</Link>
                <Link to="/my-listings" className="font-manrope text-base py-2.5 text-[#374151] hover:text-[#A3078F] transition-[color]" onClick={closeMobileMenu}>{t('nav.myListings')}</Link>
                <Link to="/wishlist" className="font-manrope text-base py-2.5 text-[#374151] hover:text-[#A3078F] transition-[color]" onClick={closeMobileMenu}>{t('nav.saved')}</Link>
                <Link to="/enquiries" className="font-manrope text-base py-2.5 text-[#374151] hover:text-[#A3078F] transition-[color]" onClick={closeMobileMenu}>{t('nav.enquiries')}</Link>
                <Link to="/profile" className="font-manrope text-base py-2.5 text-[#374151] hover:text-[#A3078F] transition-[color]" onClick={closeMobileMenu}>{t('nav.profile')}</Link>
                <Link
                  to="/add-property"
                  className="mt-2 bg-[#A3078F] text-white font-manrope font-bold text-sm px-6 py-3 rounded-lg hover:bg-[#8E0A82] transition-all text-center"
                  onClick={closeMobileMenu}
                >
                  {t('nav.listProperty')}
                </Link>
                <button onClick={handleLogout} className="font-manrope text-base py-2.5 text-left text-[#374151] hover:text-red-500 transition-[color]">
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/signin" className="font-manrope font-semibold text-base py-2.5 text-[#374151]" onClick={closeMobileMenu}>{t('nav.loginSignup')}</Link>
                <Link
                  to="/add-property"
                  className="mt-2 bg-[#A3078F] text-white font-manrope font-bold text-sm px-6 py-3 rounded-lg hover:bg-[#8E0A82] transition-all text-center"
                  onClick={closeMobileMenu}
                >
                  {t('nav.listProperty')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </motion.nav>
    </>
  );
};

export default Navbar;
