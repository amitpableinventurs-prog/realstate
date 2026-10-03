import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, ArrowLeft } from 'lucide-react';
import AuthHeader from '../components/auth/AuthHeader';
import { useAuth } from '../contexts/AuthContext';
import { useStates, useDistricts } from '../hooks/useMasterData';
import { apiErrorMessage, apiFieldErrors } from '../services/api';
import { useI18n } from '../i18n/I18nContext';
import LanguageSwitcher from '../components/tools/LanguageSwitcher';

// "Tell us about you" (technical document 4.2 / 6.9): name, email, state and
// district after the first OTP login, and later profile edits. The mobile
// number comes from the login and is read-only.

const inputClass =
  'w-full bg-[#F5F0F6] border border-[#E8E1EA] rounded-lg px-4 py-3 font-manrope text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#A3078F] disabled:opacity-60';
const labelClass = 'block font-manrope font-extralight text-xs text-[#64748B] uppercase tracking-wider mb-2';

const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

const CompleteProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const { user, isAuthenticated, isLoading, updateProfile } = useAuth();
  const { t } = useI18n();

  const [form, setForm] = useState({ name: '', email: '', state_id: '', district_id: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const states = useStates();
  const { districts, loading: loadingDistricts } = useDistricts(form.state_id);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate(`/signin?next=${encodeURIComponent(`/complete-profile?next=${next}`)}`, { replace: true });
  }, [isLoading, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', email: user.email || '', state_id: user.state_id || '', district_id: user.district_id || '' });
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value, ...(key === 'state_id' && { district_id: '' }) }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      await updateProfile({ name: form.name.trim(), email: form.email.trim(), state_id: form.state_id, district_id: form.district_id });
      navigate(next, { replace: true });
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setError(apiErrorMessage(err, t('profile.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const completing = !user?.profile_complete;

  return (
    <div className="min-h-screen bg-[#FAF8FB] flex items-center justify-center py-12 px-4">
      <div className="max-w-[520px] w-full">
        <div className="flex justify-end mb-2"><LanguageSwitcher /></div>
        <AuthHeader />
        <div className="bg-white border border-[#E8E1EA] rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="font-syne font-bold text-3xl text-[#1A0A1E] mb-2">
              {completing ? t('profile.titleNew') : t('profile.titleEdit')}
            </h1>
            <p className="font-manrope font-extralight text-sm text-[#4B5563]">
              {completing ? t('profile.subtitleNew') : t('profile.subtitleEdit')}
            </p>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="font-manrope text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="cp-mobile" className={labelClass}>{t('profile.mobile')}</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input id="cp-mobile" value={user?.mobile || ''} disabled readOnly className={`${inputClass} pl-11`} />
              </div>
            </div>
            <div>
              <label htmlFor="cp-name" className={labelClass}>{t('profile.name')}</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input id="cp-name" value={form.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={80}
                  placeholder={t('profile.namePh')} className={`${inputClass} pl-11`} />
              </div>
              {errors.name && <p className="font-manrope text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="cp-email" className={labelClass}>{t('profile.email')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input id="cp-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={120}
                  placeholder="name@email.com" className={`${inputClass} pl-11`} />
              </div>
              {errors.email && <p className="font-manrope text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cp-state" className={labelClass}>{t('profile.state')}</label>
                <select id="cp-state" value={form.state_id} onChange={(e) => set('state_id', e.target.value)} required className={inputClass}>
                  <option value="">{t('profile.chooseState')}</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {errors.state_id && <p className="font-manrope text-xs text-red-600 mt-1">{errors.state_id}</p>}
              </div>
              <div>
                <label htmlFor="cp-district" className={labelClass}>{t('profile.district')}</label>
                <select id="cp-district" value={form.district_id} onChange={(e) => set('district_id', e.target.value)} required
                  disabled={!form.state_id || loadingDistricts} className={inputClass}>
                  <option value="">{!form.state_id ? t('profile.stateFirst') : loadingDistricts ? t('profile.loading') : t('profile.chooseDistrict')}</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.district_id && <p className="font-manrope text-xs text-red-600 mt-1">{errors.district_id}</p>}
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="w-full bg-[#A3078F] hover:bg-[#7A0A74] text-white font-manrope font-bold text-base py-3.5 rounded-xl transition-all shadow-lg disabled:opacity-60">
              {saving ? t('profile.saving') : completing ? t('profile.continue') : t('profile.save')}
            </button>
          </form>
        </div>
        <div className="text-center mt-6">
          <Link to="/" className="inline-flex items-center gap-2 font-manrope font-medium text-sm text-[#64748B] hover:text-[#A3078F]">
            <ArrowLeft className="w-4 h-4" /> {t('common.backHome')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
