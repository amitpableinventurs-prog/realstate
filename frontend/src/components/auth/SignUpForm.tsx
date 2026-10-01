import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone, MapPin, ChevronDown } from 'lucide-react';
import { districtsAPI, type District, type IndianState, type SignUpData } from '../../services/api';

interface SignUpFormProps {
  onSubmit: (data: SignUpData) => void;
}

const labelClass = 'block font-manrope font-extralight text-xs text-[#64748B] uppercase tracking-wider mb-2';
const inputClass =
  'w-full bg-[#F5F0F6] border border-[#E8E1EA] rounded-lg pl-12 pr-4 py-3.5 font-manrope font-extralight text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#A3078F] transition-[border-color]';
const selectClass = `${inputClass} appearance-none pr-10 disabled:opacity-60`;
const iconClass = 'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] pointer-events-none';

// Same details as the app's "Tell us about you" screen, plus a password
const SignUpForm: React.FC<SignUpFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = React.useState({
    fullName: '',
    email: '',
    phone: '',
    state: '',
    district: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [states, setStates] = React.useState<IndianState[] | null>(null);
  const [districts, setDistricts] = React.useState<District[]>([]);
  const [loadingDistricts, setLoadingDistricts] = React.useState(false);

  React.useEffect(() => {
    districtsAPI.states()
      .then((res) => setStates(res.data.states))
      .catch(() => setStates([]));
  }, []);

  // District list follows the chosen state
  React.useEffect(() => {
    setDistricts([]);
    if (!formData.state) return;
    let cancelled = false;
    setLoadingDistricts(true);
    districtsAPI.list({ state: formData.state })
      .then((res) => { if (!cancelled) setDistricts(res.data.districts); })
      .catch(() => { if (!cancelled) setDistricts([]); })
      .finally(() => { if (!cancelled) setLoadingDistricts(false); });
    return () => { cancelled = true; };
  }, [formData.state]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormError(null);
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      // A new state clears the district chosen for the old one
      ...(name === 'state' && { district: '' }),
    }));
  };

  // Digits only, max 10 (the +91 prefix is shown separately)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    setFormData((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      setFormError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    onSubmit({
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone,
      state: formData.state,
      district: formData.district,
      password: formData.password,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label htmlFor="su-name" className={labelClass}>Name</label>
        <div className="relative">
          <User className={iconClass} />
          <input
            id="su-name"
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder="Your full name"
            autoComplete="name"
            className={inputClass}
            required
            minLength={2}
            maxLength={80}
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="su-email" className={labelClass}>Email</label>
        <div className="relative">
          <Mail className={iconClass} />
          <input
            id="su-email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="name@email.com"
            autoComplete="email"
            className={inputClass}
            required
          />
        </div>
      </div>

      {/* Mobile number */}
      <div>
        <label htmlFor="su-phone" className={labelClass}>Mobile number</label>
        <div className="relative">
          <Phone className={iconClass} />
          <span className="absolute left-12 top-1/2 -translate-y-1/2 font-manrope text-sm text-[#0F172A] pointer-events-none">
            +91
          </span>
          <input
            id="su-phone"
            type="tel"
            name="phone"
            inputMode="numeric"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="9876543210"
            autoComplete="tel-national"
            className={`${inputClass} pl-[5.25rem]`}
            required
            pattern="[6-9][0-9]{9}"
            title="10-digit mobile number"
          />
        </div>
      </div>

      {/* State & District */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="su-state" className={labelClass}>State</label>
          <div className="relative">
            <MapPin className={iconClass} />
            <select
              id="su-state"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              disabled={states === null}
              className={selectClass}
              required
            >
              <option value="">{states === null ? 'Loading…' : 'Choose state'}</option>
              {states?.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          </div>
        </div>
        <div>
          <label htmlFor="su-district" className={labelClass}>District</label>
          <div className="relative">
            <MapPin className={iconClass} />
            <select
              id="su-district"
              name="district"
              value={formData.district}
              onChange={handleInputChange}
              disabled={!formData.state || loadingDistricts}
              className={selectClass}
              required
            >
              <option value="">
                {!formData.state ? 'Choose a state first' : loadingDistricts ? 'Loading…' : 'Choose district'}
              </option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Password */}
      <div>
        <label htmlFor="su-password" className={labelClass}>Password</label>
        <div className="relative">
          <Lock className={iconClass} />
          <input
            id="su-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className={`${inputClass} pr-12`}
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#A3078F] transition-[color]"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="su-confirm" className={labelClass}>Confirm Password</label>
        <div className="relative">
          <Lock className={iconClass} />
          <input
            id="su-confirm"
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            className={`${inputClass} pr-12`}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#A3078F] transition-[color]"
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="agreeToTerms"
            checked={formData.agreeToTerms}
            onChange={handleInputChange}
            className="w-4 h-4 mt-0.5 rounded border-[#E8E1EA] text-[#A3078F] focus:ring-[#A3078F]"
            required
          />
          <span className="font-manrope font-extralight text-sm text-[#4B5563] leading-relaxed">
            I agree to the{' '}
            {/* New tab, so the half-filled form isn't lost */}
            <Link to="/terms" target="_blank" rel="noopener" className="text-[#A3078F] hover:text-[#7A0A74] font-medium">
              Terms & Conditions
            </Link>
            {' '}and{' '}
            <Link to="/privacy" target="_blank" rel="noopener" className="text-[#A3078F] hover:text-[#7A0A74] font-medium">
              Privacy Policy
            </Link>
          </span>
        </label>
      </div>

      {formError && (
        <p role="alert" className="font-manrope text-sm text-red-600">{formError}</p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full bg-[#A3078F] hover:bg-[#7A0A74] text-white font-manrope font-bold text-base py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl"
      >
        Create Account
      </button>
    </form>
  );
};

export default SignUpForm;
