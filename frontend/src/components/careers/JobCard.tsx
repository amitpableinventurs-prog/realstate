import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Briefcase, Clock, ArrowRight } from 'lucide-react';
import type { JobSummary, EmploymentType, WorkMode } from '../../services/api';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

const JobCard: React.FC<{ job: JobSummary }> = ({ job }) => (
  <Link
    to={`/careers/${job.slug}`}
    className="group block outline-none focus-visible:ring-2 focus-visible:ring-[#A3078F] rounded-2xl"
  >
    <article className="bg-white rounded-2xl border border-[#EDE7EF] p-6 md:p-7 hover:border-[#A3078F]/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 min-w-0">
          <span className="font-space-mono text-xs text-[#A3078F] uppercase tracking-widest">
            {job.department}
          </span>
          <h3 className="font-fraunces text-2xl text-[#1A0A1E] mt-2 mb-2 group-hover:text-[#8E0A82] transition-colors">
            {job.title}
          </h3>
          <p className="font-manrope text-sm text-[#4B5563] leading-relaxed mb-4 line-clamp-2">{job.summary}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-manrope text-sm text-[#6B7280]">
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{job.location}</span>
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              {EMPLOYMENT_TYPE_LABELS[job.employmentType]} · {WORK_MODE_LABELS[job.workMode]}
            </span>
            {job.experience && (
              <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" />{job.experience}</span>
            )}
          </div>
        </div>
        <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
          {job.salaryRange && (
            <span className="font-manrope text-sm font-semibold text-[#1A0A1E]">{job.salaryRange}</span>
          )}
          <span className="inline-flex items-center gap-2 font-manrope text-sm font-bold text-[#A3078F]">
            View & apply
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  </Link>
);

export default JobCard;
