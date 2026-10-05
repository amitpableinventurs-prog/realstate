import React, { useState } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { contactAPI } from '../../services/api';
import { useI18n } from '../../i18n/I18nContext';

const ContactFormCard: React.FC = () => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear status when user starts typing again
    if (status !== 'idle') setStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');

    try {
      // Map frontend fields to backend schema
      await contactAPI.submit({
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phoneNumber,
        message: formData.message,
      });

      setStatus('success');
      setStatusMessage(t('contact.success'));
      setFormData({ firstName: '', lastName: '', email: '', phoneNumber: '', message: '' });
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(
        err.response?.data?.message || t('contact.error')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E8E1EA] rounded-2xl p-8 shadow-sm">
      {/* Card Header */}
      <div className="mb-8">
        <h2 className="font-syne font-bold text-2xl text-[#1A0A1E] mb-2">
          {t('contact.formTitle')}
        </h2>
        <p className="font-manrope font-extralight text-sm text-[#4B5563]">
          {t('contact.formIntro')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* First Name & Last Name Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block font-manrope font-extralight text-xs text-[#64748B] uppercase tracking-wider mb-2">
              {t('contact.firstName')}
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="John"
              className="w-full bg-[#F5F0F6] border border-[#E8E1EA] rounded-lg px-4 py-3 font-manrope font-extralight text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#A3078F] transition-[border-color]"
              required
            />
          </div>

          <div>
            <label className="block font-manrope font-extralight text-xs text-[#64748B] uppercase tracking-wider mb-2">
              {t('contact.lastName')}
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Doe"
              className="w-full bg-[#F5F0F6] border border-[#E8E1EA] rounded-lg px-4 py-3 font-manrope font-extralight text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#A3078F] transition-[border-color]"
              required
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block font-manrope font-extralight text-xs text-[#64748B] uppercase tracking-wider mb-2">
            {t('profile.email')}
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="john.doe@example.com"
            className="w-full bg-[#F5F0F6] border border-[#E8E1EA] rounded-lg px-4 py-3 font-manrope font-extralight text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#A3078F] transition-[border-color]"
            required
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className="block font-manrope font-extralight text-xs text-[#64748B] uppercase tracking-wider mb-2">
            {t('schedule.phone')}
          </label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            placeholder="+91 98765 43210"
            className="w-full bg-[#F5F0F6] border border-[#E8E1EA] rounded-lg px-4 py-3 font-manrope font-extralight text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#A3078F] transition-[border-color]"
            required
          />
        </div>

        {/* Message */}
        <div>
          <label className="block font-manrope font-extralight text-xs text-[#64748B] uppercase tracking-wider mb-2">
            {t('contact.message')}
          </label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            placeholder="Tell us about your inquiry..."
            rows={5}
            className="w-full bg-[#F5F0F6] border border-[#E8E1EA] rounded-lg px-4 py-3 font-manrope font-extralight text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#A3078F] transition-[border-color] resize-none"
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#A3078F] hover:bg-[#7A0A74] disabled:opacity-60 disabled:cursor-not-allowed text-white font-manrope font-bold text-base py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('contact.sending')}
            </>
          ) : (
            t('contact.send')
          )}
        </button>

        {/* Status Message */}
        {status === 'success' && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <p className="font-manrope text-sm text-green-700">{statusMessage}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="font-manrope text-sm text-red-700">{statusMessage}</p>
          </div>
        )}
      </form>
    </div>
  );
};

export default ContactFormCard;
