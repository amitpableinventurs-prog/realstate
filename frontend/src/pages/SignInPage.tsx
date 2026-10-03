import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, KeyRound, ArrowLeft } from 'lucide-react';
import AuthHeader from '../components/auth/AuthHeader';
import { useAuth } from '../contexts/AuthContext';
import { apiErrorMessage } from '../services/api';
import { useI18n } from '../i18n/I18nContext';
import LanguageSwitcher from '../components/tools/LanguageSwitcher';

// Login and sign-up in one: mobile number → OTP (technical document 4.2).
// A new account then fills in "Tell us about you" on /complete-profile.

const inputClass =
  'w-full bg-[#F5F0F6] border border-[#E8E1EA] rounded-lg pl-12 pr-4 py-3.5 font-manrope text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#A3078F] transition-[border-color]';
const labelClass = 'block font-manrope font-extralight text-xs text-[#64748B] uppercase tracking-wider mb-2';

// Only same-site paths are followed after login
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const { sendOtp, verifyOtp, isAuthenticated, user } = useAuth();
  const { t } = useI18n();

  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpInput = useRef<HTMLInputElement>(null);

  // Already signed in
  useEffect(() => {
    if (isAuthenticated) navigate(user?.profile_complete ? next : `/complete-profile?next=${encodeURIComponent(next)}`, { replace: true });
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const requestOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const { devOtp, resendAfter } = await sendOtp(mobile);
      setStep('otp');
      setResendIn(resendAfter);
      setInfo(devOtp ? t('signin.devOtp', { otp: devOtp }) : t('signin.otpSentInfo', { mobile }));
      setTimeout(() => otpInput.current?.focus(), 50);
    } catch (err) {
      setError(apiErrorMessage(err, t('signin.sendFailed')));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await verifyOtp(mobile, otp);
      navigate(result.profile_complete ? next : `/complete-profile?next=${encodeURIComponent(next)}`, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, t('signin.verifyFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8FB] flex items-center justify-center py-12 px-4">
      <div className="max-w-[480px] w-full">
        <div className="flex justify-end mb-2"><LanguageSwitcher /></div>
        <AuthHeader />

        <div className="bg-white border border-[#E8E1EA] rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="font-syne font-bold text-3xl text-[#1A0A1E] mb-2">
              {step === 'mobile' ? t('signin.title') : t('signin.otpTitle')}
            </h1>
            <p className="font-manrope font-extralight text-sm text-[#4B5563]">
              {step === 'mobile' ? t('signin.subtitle') : t('signin.otpSent', { mobile })}
            </p>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="font-manrope text-sm text-red-600">{error}</p>
            </div>
          )}
          {info && !error && step === 'otp' && (
            <div className="bg-[#FDF4FC] border border-[#EBC9E6] rounded-lg p-3 mb-4">
              <p className="font-manrope text-sm text-[#7A0A74]">{info}</p>
            </div>
          )}

          {step === 'mobile' ? (
            <form onSubmit={(e) => { e.preventDefault(); requestOtp(); }} className="space-y-5">
              <div>
                <label htmlFor="mobile" className={labelClass}>{t('signin.mobile')}</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <span className="absolute left-11 top-1/2 -translate-y-1/2 font-manrope text-sm text-[#64748B]">+91</span>
                  <input
                    id="mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    pattern="[6-9][0-9]{9}"
                    title={t('signin.mobileTitle')}
                    required
                    className={`${inputClass} pl-[4.5rem]`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy || mobile.length !== 10}
                className="w-full bg-[#A3078F] hover:bg-[#7A0A74] text-white font-manrope font-bold text-base py-3.5 rounded-xl transition-all shadow-lg disabled:opacity-60"
              >
                {busy ? t('signin.sending') : t('signin.getOtp')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label htmlFor="otp" className={labelClass}>{t('signin.otp')}</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    id="otp"
                    ref={otpInput}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('signin.otpPh')}
                    required
                    className={`${inputClass} tracking-[0.4em]`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="w-full bg-[#A3078F] hover:bg-[#7A0A74] text-white font-manrope font-bold text-base py-3.5 rounded-xl transition-all shadow-lg disabled:opacity-60"
              >
                {busy ? t('signin.verifying') : t('signin.verify')}
              </button>
              <div className="flex items-center justify-between font-manrope text-sm">
                <button type="button" onClick={() => { setStep('mobile'); setOtp(''); setError(null); }}
                  className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#A3078F]">
                  <ArrowLeft className="w-4 h-4" /> {t('signin.changeNumber')}
                </button>
                <button type="button" onClick={requestOtp} disabled={busy || resendIn > 0}
                  className="font-semibold text-[#A3078F] hover:text-[#7A0A74] disabled:text-[#94A3B8]">
                  {resendIn > 0 ? t('signin.resendIn', { s: resendIn }) : t('signin.resend')}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-manrope font-medium text-sm text-[#64748B] hover:text-[#A3078F] transition-[color]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('common.backHome')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
