import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import PageTransition from './components/common/PageTransition';
import ScrollToTop from './components/common/ScrollToTop';
import StructuredData from './components/common/StructuredData';

// Lazy load pages for better performance (Code Splitting)
const HomePage = lazy(() => import('./pages/HomePage'));
const PropertyDetailsPage = lazy(() => import('./pages/PropertyDetailsPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const AboutUsPage = lazy(() => import('./pages/AboutUsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage'));
const AddPropertyPage = lazy(() => import('./pages/AddPropertyPage'));
const MyListingsPage = lazy(() => import('./pages/MyListingsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const JobDetailsPage = lazy(() => import('./pages/JobDetailsPage'));

function NotFoundPage() {
  return (
    <PageTransition className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8FB]">
      <h1 className="font-fraunces text-6xl font-bold text-[#A3078F] mb-4">404</h1>
      <p className="font-manrope text-xl text-[#374151] mb-8">Page not found</p>
      <a href="/" className="bg-[#A3078F] text-white font-manrope font-bold px-8 py-3 rounded-lg hover:bg-[#8E0A82] transition-all">
        Go Home
      </a>
    </PageTransition>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8FB]">
      <div className="w-12 h-12 border-4 border-[#A3078F] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <>
      {/* Global structured data */}
      <StructuredData type="website" />
      <StructuredData type="organization" />
      <StructuredData type="localBusiness" />

      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
          {/* Approved land properties with search, filters and sort (technical document 8.2) */}
          <Route path="/properties" element={<PageTransition><SearchPage /></PageTransition>} />
          <Route path="/search" element={<PageTransition><SearchPage /></PageTransition>} />
          <Route path="/property/:id" element={<PageTransition><PropertyDetailsPage /></PageTransition>} />
          <Route path="/properties/:id" element={<PageTransition><PropertyDetailsPage /></PageTransition>} />
          {/* The AI Hub was replaced by plain search; keep old links working */}
          <Route path="/ai-hub" element={<Navigate to="/search" replace />} />
          <Route path="/about" element={<PageTransition><AboutUsPage /></PageTransition>} />
          <Route path="/terms" element={<PageTransition><TermsPage /></PageTransition>} />
          <Route path="/privacy" element={<PageTransition><PrivacyPage /></PageTransition>} />
          <Route path="/contact" element={<PageTransition><ContactPage /></PageTransition>} />
          <Route path="/blog" element={<PageTransition><BlogPage /></PageTransition>} />
          <Route path="/blog/:slug" element={<PageTransition><BlogPostPage /></PageTransition>} />
          <Route path="/careers" element={<PageTransition><CareersPage /></PageTransition>} />
          <Route path="/careers/:slug" element={<PageTransition><JobDetailsPage /></PageTransition>} />
          <Route path="/signin" element={<PageTransition><SignInPage /></PageTransition>} />
          {/* Mobile number + OTP login; a new account is created on first login */}
          <Route path="/login" element={<Navigate to="/signin" replace />} />
          <Route path="/signup" element={<Navigate to="/signin" replace />} />
          <Route path="/complete-profile" element={<PageTransition><CompleteProfilePage /></PageTransition>} />
          <Route path="/profile" element={<PageTransition><CompleteProfilePage /></PageTransition>} />
          <Route path="/add-property" element={<PageTransition><AddPropertyPage /></PageTransition>} />
          <Route path="/list-property" element={<PageTransition><AddPropertyPage /></PageTransition>} />
          <Route path="/my-listings" element={<PageTransition><MyListingsPage /></PageTransition>} />
          <Route path="/my-properties" element={<PageTransition><MyListingsPage /></PageTransition>} />
          <Route path="/dashboard" element={<PageTransition><DashboardPage /></PageTransition>} />
          <Route path="/wishlist" element={<PageTransition><DashboardPage tab="saved" /></PageTransition>} />
          <Route path="/enquiries" element={<PageTransition><DashboardPage tab="enquiries" /></PageTransition>} />
          <Route path="/notifications" element={<PageTransition><DashboardPage tab="notifications" /></PageTransition>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <I18nProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoutes />
        </Suspense>
        <Toaster position="top-center" richColors />
      </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
