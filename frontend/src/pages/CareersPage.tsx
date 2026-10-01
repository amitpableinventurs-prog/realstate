import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sprout, Users, TrendingUp, HeartHandshake, Mail } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import LoadingState from '../components/common/LoadingState';
import JobCard, { WORK_MODE_LABELS } from '../components/careers/JobCard';
import { careersAPI, type JobSummary, type WorkMode } from '../services/api';
import { useSEO } from '../hooks/useSEO';

const PERKS = [
  { icon: Sprout, title: 'Real impact', text: 'Help families buy, sell and rent land and homes with confidence across India.' },
  { icon: TrendingUp, title: 'Grow fast', text: 'Small teams, real ownership and a learning budget for courses and books.' },
  { icon: Users, title: 'Flexible work', text: 'Remote and hybrid roles, plus on-ground teams in the cities we serve.' },
  { icon: HeartHandshake, title: 'Care for you', text: 'Health insurance for you and your family, and paid time off that you actually take.' },
];

const STEPS = [
  { title: 'Apply', text: 'Send your details and resume link. It takes five minutes.' },
  { title: 'Intro call', text: 'A 20-minute chat with our team about you and the role.' },
  { title: 'Skills round', text: 'A practical task or interview based on real work.' },
  { title: 'Offer', text: 'We aim to decide within two weeks of your first call.' },
];

const CareersPage: React.FC = () => {
  useSEO({
    title: 'Careers — Join the Bhumi Bazar Team',
    description: 'Open roles at Bhumi Bazar in engineering, sales, operations and customer success. Help build India\'s trusted marketplace for land and property.',
  });

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [departments, setDepartments] = useState<{ name: string; count: number }[]>([]);
  const [department, setDepartment] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All open jobs are loaded once; filtering happens in the browser
  useEffect(() => {
    careersAPI
      .listJobs()
      .then(({ data }) => {
        setJobs(data.jobs);
        setDepartments(data.departments);
      })
      .catch(() => setError('Failed to load openings. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) =>
      (!department || job.department === department) &&
      (!workMode || job.workMode === workMode) &&
      (!q || [job.title, job.summary, job.location, job.department].some((f) => f.toLowerCase().includes(q)))
    );
  }, [jobs, department, workMode, search]);

  const cityCount = new Set(jobs.map((j) => j.location.split(',')[0].trim())).size;

  const chipClass = (active: boolean) =>
    `shrink-0 font-manrope text-sm px-4 py-2 rounded-full border transition-colors ${
      active
        ? 'bg-[#1A0A1E] text-white border-[#1A0A1E]'
        : 'bg-white text-[#374151] border-[#E8E1EA] hover:border-[#A3078F] hover:text-[#A3078F]'
    }`;

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#1A0A1E] py-20 md:py-24">
        <div className="max-w-[1280px] mx-auto px-6 md:px-8 text-center">
          <span className="font-space-mono text-xs text-[#E08AD6] uppercase tracking-widest">Careers at Bhumi Bazar</span>
          <h1 className="font-fraunces text-4xl md:text-6xl text-white mt-4 mb-6 max-w-[900px] mx-auto leading-tight">
            Help India buy and sell land with confidence
          </h1>
          <p className="font-manrope text-lg text-[#D1D5DB] leading-relaxed max-w-[672px] mx-auto mb-10">
            We are building a trusted marketplace for land and property, with verified records and honest listings.
            Come build it with us.
          </p>
          <div className="flex flex-wrap justify-center gap-10">
            <div>
              <p className="font-fraunces text-4xl text-white">{loading ? '–' : jobs.length}</p>
              <p className="font-manrope text-sm text-[#9CA3AF] mt-1">Open roles</p>
            </div>
            <div>
              <p className="font-fraunces text-4xl text-white">{loading ? '–' : departments.length}</p>
              <p className="font-manrope text-sm text-[#9CA3AF] mt-1">Teams hiring</p>
            </div>
            <div>
              <p className="font-fraunces text-4xl text-white">{loading ? '–' : cityCount}</p>
              <p className="font-manrope text-sm text-[#9CA3AF] mt-1">Locations</p>
            </div>
          </div>
          <a href="#openings" className="inline-block mt-10 font-manrope font-bold text-white bg-[#A3078F] hover:bg-[#8E0A82] px-7 py-3 rounded-xl transition-colors">
            See open roles
          </a>
        </div>
      </section>

      {/* Why join */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1280px] mx-auto px-6 md:px-8">
          <h2 className="font-fraunces text-3xl md:text-4xl text-[#1A0A1E] text-center mb-12">Why work with us</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-white rounded-2xl border border-[#EDE7EF] p-7">
                <div className="w-12 h-12 rounded-xl bg-[#A3078F]/10 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[#A3078F]" />
                </div>
                <h3 className="font-syne font-bold text-lg text-[#1A0A1E] mb-2">{title}</h3>
                <p className="font-manrope text-sm text-[#4B5563] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Openings */}
      <section id="openings" className="pb-20 scroll-mt-24">
        <div className="max-w-[1080px] mx-auto px-6 md:px-8">
          <h2 className="font-fraunces text-3xl md:text-4xl text-[#1A0A1E] mb-8">Open positions</h2>

          <div className="flex flex-col gap-4 mb-8">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button type="button" onClick={() => setDepartment('')} className={chipClass(!department)}>
                All teams
              </button>
              {departments.map((d) => (
                <button key={d.name} type="button" onClick={() => setDepartment(d.name)} className={chipClass(department === d.name)}>
                  {d.name} <span className="opacity-60">({d.count})</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search roles</span>
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by role or city"
                  className="w-full font-manrope text-sm bg-white border border-[#E8E1EA] rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#A3078F] focus:ring-2 focus:ring-[#A3078F]/15"
                />
              </label>
              <label className="sm:w-48">
                <span className="sr-only">Work mode</span>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as WorkMode | '')}
                  className="w-full font-manrope text-sm bg-white border border-[#E8E1EA] rounded-xl px-4 py-2.5 outline-none focus:border-[#A3078F]"
                >
                  <option value="">Any work mode</option>
                  {(Object.keys(WORK_MODE_LABELS) as WorkMode[]).map((mode) => (
                    <option key={mode} value={mode}>{WORK_MODE_LABELS[mode]}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading && <LoadingState message="Loading openings…" />}
          {error && !loading && <p className="font-manrope text-center text-[#B91C1C] py-12">{error}</p>}

          {!loading && !error && (
            filteredJobs.length > 0 ? (
              <div className="space-y-4">
                {filteredJobs.map((job) => <JobCard key={job.id} job={job} />)}
              </div>
            ) : (
              <div className="text-center bg-white rounded-2xl border border-[#EDE7EF] py-14 px-6">
                <p className="font-fraunces text-2xl text-[#1A0A1E] mb-2">
                  {jobs.length ? 'No roles match your filters' : 'No open roles right now'}
                </p>
                <p className="font-manrope text-sm text-[#6B7280]">
                  We are always happy to hear from great people — see below.
                </p>
              </div>
            )
          )}
        </div>
      </section>

      {/* Hiring process */}
      <section className="bg-white py-16 md:py-20 border-t border-[#EDE7EF]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-8">
          <h2 className="font-fraunces text-3xl md:text-4xl text-[#1A0A1E] text-center mb-12">How we hire</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="font-fraunces text-5xl text-[#A3078F]/30">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-syne font-bold text-lg text-[#1A0A1E] mt-2 mb-2">{step.title}</h3>
                <p className="font-manrope text-sm text-[#4B5563] leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-16 bg-[#F9F7FA] rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="w-14 h-14 shrink-0 rounded-full bg-[#A3078F]/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-[#A3078F]" />
            </div>
            <div className="flex-1">
              <p className="font-fraunces text-2xl text-[#1A0A1E] mb-1">Don't see your role?</p>
              <p className="font-manrope text-[#4B5563]">
                Send your resume to <a href="mailto:careers@bhumibazar.com" className="text-[#A3078F] font-semibold hover:underline">careers@bhumibazar.com</a> and
                tell us how you would like to help.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CareersPage;
