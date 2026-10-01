import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, MapPin, Briefcase, Clock, IndianRupee, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import LoadingState from '../components/common/LoadingState';
import { EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS } from '../components/careers/JobCard';
import { careersAPI, type Job, type JobApplicationInput } from '../services/api';
import { useSEO } from '../hooks/useSEO';

type FormState = Record<keyof JobApplicationInput, string>;
type FieldErrors = Partial<Record<keyof JobApplicationInput, string>>;

const EMPTY_FORM: FormState = {
  name: '', email: '', phone: '', resumeLink: '', linkedinUrl: '', experienceYears: '', coverLetter: '',
};

const isUrl = (value: string) => /^https?:\/\/\S+\.\S+/.test(value);

// Same rules as the backend, so most mistakes are caught before submitting
const validate = (form: FormState): FieldErrors => {
  const errors: FieldErrors = {};
  if (form.name.trim().length < 2) errors.name = 'Please enter your full name';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Please enter a valid email';
  if (!/^[+\d][\d\s-]{6,18}$/.test(form.phone.trim())) errors.phone = 'Please enter a valid phone number';
  if (!isUrl(form.resumeLink.trim())) errors.resumeLink = 'Please share a link to your resume';
  if (form.linkedinUrl.trim() && !isUrl(form.linkedinUrl.trim())) errors.linkedinUrl = 'Please enter a valid URL';
  if (form.experienceYears && !(Number(form.experienceYears) >= 0 && Number(form.experienceYears) <= 60)) {
    errors.experienceYears = 'Must be between 0 and 60';
  }
  return errors;
};

const inputClass = (hasError: boolean) =>
  `w-full font-manrope text-sm bg-white border rounded-xl px-4 py-2.5 outline-none transition-colors focus:ring-2 ${
    hasError ? 'border-[#DC2626] focus:ring-[#DC2626]/15' : 'border-[#E8E1EA] focus:border-[#A3078F] focus:ring-[#A3078F]/15'
  }`;

const ListSection: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
  items.length ? (
    <section className="mt-10">
      <h2 className="font-fraunces text-2xl text-[#1A0A1E] mb-4">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 font-manrope text-[#374151] leading-relaxed">
            <CheckCircle2 className="w-5 h-5 text-[#A3078F] shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

const JobDetailsPage: React.FC = () => {
  const { slug = '' } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useSEO({
    title: job ? `${job.title} — Careers` : 'Careers',
    description: job?.summary,
  });

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    careersAPI
      .getJob(slug)
      .then(({ data }) => {
        if (cancelled) return;
        setJob(data.job);
        setStatus('ready');
      })
      .catch((err) => !cancelled && setStatus(err.response?.status === 404 ? 'not-found' : 'error'));
    return () => { cancelled = true; };
  }, [slug]);

  const setField = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await careersAPI.apply(slug, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        resumeLink: form.resumeLink.trim(),
        linkedinUrl: form.linkedinUrl.trim() || undefined,
        experienceYears: form.experienceYears === '' ? undefined : Number(form.experienceYears),
        coverLetter: form.coverLetter.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.errors) setErrors(data.errors);
      setSubmitError(data?.message || 'Could not submit your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`apply-${key}`} className="block font-manrope text-sm font-semibold text-[#1A0A1E] mb-1.5">{label}</label>
      <input
        id={`apply-${key}`}
        value={form[key]}
        onChange={setField(key)}
        aria-invalid={Boolean(errors[key])}
        className={inputClass(Boolean(errors[key]))}
        {...props}
      />
      {errors[key] && <p className="font-manrope text-xs text-[#DC2626] mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <Navbar />

      {status === 'loading' && <LoadingState message="Loading role…" />}

      {(status === 'not-found' || status === 'error') && (
        <div className="text-center py-28 px-6">
          <p className="font-fraunces text-3xl text-[#1A0A1E] mb-3">
            {status === 'not-found' ? 'Role not found' : 'Something went wrong'}
          </p>
          <p className="font-manrope text-[#6B7280] mb-8">
            {status === 'not-found' ? 'This position may have been removed.' : 'Please try again later.'}
          </p>
          <Link to="/careers" className="font-manrope font-bold text-white bg-[#A3078F] hover:bg-[#8E0A82] px-6 py-3 rounded-xl transition-colors">
            See open roles
          </Link>
        </div>
      )}

      {status === 'ready' && job && (
        <main className="max-w-[1180px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <Link to="/careers#openings" className="inline-flex items-center gap-2 font-manrope text-sm text-[#6B7280] hover:text-[#A3078F] transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> All open roles
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10 items-start">
            {/* Role details */}
            <div className="bg-white rounded-2xl border border-[#EDE7EF] p-7 md:p-10">
              <span className="font-space-mono text-xs text-[#A3078F] uppercase tracking-widest">{job.department}</span>
              <h1 className="font-fraunces text-4xl md:text-5xl text-[#1A0A1E] leading-tight mt-3 mb-5">{job.title}</h1>
              <div className="flex flex-wrap gap-x-6 gap-y-2 font-manrope text-sm text-[#4B5563] pb-7 border-b border-[#EDE7EF]">
                <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{job.location}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />{EMPLOYMENT_TYPE_LABELS[job.employmentType]} · {WORK_MODE_LABELS[job.workMode]}
                </span>
                {job.experience && <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" />{job.experience}</span>}
                {job.salaryRange && <span className="inline-flex items-center gap-1.5"><IndianRupee className="w-4 h-4" />{job.salaryRange}</span>}
              </div>

              <p className="font-manrope text-lg text-[#374151] leading-relaxed mt-7">{job.summary}</p>
              {job.description && (
                <p className="font-manrope text-[#4B5563] leading-relaxed mt-4 whitespace-pre-line">{job.description}</p>
              )}
              <ListSection title="What you'll do" items={job.responsibilities} />
              <ListSection title="What we're looking for" items={job.requirements} />
              <p className="font-manrope text-xs text-[#9CA3AF] mt-10">
                Posted {formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })}
              </p>
            </div>

            {/* Apply */}
            <aside className="bg-white rounded-2xl border border-[#EDE7EF] p-7 lg:sticky lg:top-28">
              {!job.isOpen ? (
                <div className="text-center py-6">
                  <p className="font-fraunces text-2xl text-[#1A0A1E] mb-2">Applications closed</p>
                  <p className="font-manrope text-sm text-[#6B7280] mb-6">This position is no longer accepting applications.</p>
                  <Link to="/careers#openings" className="font-manrope font-bold text-[#A3078F] hover:underline">See other open roles</Link>
                </div>
              ) : submitted ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-14 h-14 text-[#16A34A] mx-auto mb-4" />
                  <p className="font-fraunces text-2xl text-[#1A0A1E] mb-2">Application sent!</p>
                  <p className="font-manrope text-sm text-[#4B5563] mb-6">
                    Thanks, {form.name.split(' ')[0]}. Our team will review your application and get back to you at {form.email}.
                  </p>
                  <Link to="/careers#openings" className="font-manrope font-bold text-[#A3078F] hover:underline">See other open roles</Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <h2 className="font-fraunces text-2xl text-[#1A0A1E]">Apply for this role</h2>
                  {field('name', 'Full name *', { autoComplete: 'name' })}
                  {field('email', 'Email *', { type: 'email', autoComplete: 'email' })}
                  {field('phone', 'Phone *', { type: 'tel', autoComplete: 'tel', placeholder: '+91 98765 43210' })}
                  {field('resumeLink', 'Resume link *', { type: 'url', placeholder: 'Google Drive or Dropbox link' })}
                  {field('linkedinUrl', 'LinkedIn profile', { type: 'url', placeholder: 'https://linkedin.com/in/…' })}
                  {field('experienceYears', 'Years of experience', { type: 'number', min: 0, max: 60, inputMode: 'numeric' })}
                  <div>
                    <label htmlFor="apply-coverLetter" className="block font-manrope text-sm font-semibold text-[#1A0A1E] mb-1.5">
                      Why are you a good fit?
                    </label>
                    <textarea
                      id="apply-coverLetter"
                      rows={4}
                      maxLength={3000}
                      value={form.coverLetter}
                      onChange={setField('coverLetter')}
                      className={`${inputClass(Boolean(errors.coverLetter))} resize-y`}
                    />
                  </div>
                  <p className="font-manrope text-xs text-[#6B7280]">
                    Make sure your resume link is shared so anyone with the link can view it.
                  </p>
                  {submitError && (
                    <p role="alert" className="font-manrope text-sm text-[#DC2626] bg-[#FEF2F2] rounded-lg px-3 py-2">{submitError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full font-manrope font-bold text-white bg-[#A3078F] hover:bg-[#8E0A82] py-3 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Submit application'}
                  </button>
                </form>
              )}
            </aside>
          </div>
        </main>
      )}

      <Footer />
    </div>
  );
};

export default JobDetailsPage;
