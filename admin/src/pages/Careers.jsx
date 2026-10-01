import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Plus, Pencil, Trash2, ExternalLink, RefreshCw, AlertCircle,
  Check, X, Users, MapPin, Mail, Phone, FileText, Linkedin, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../services/apiClient';
import { websiteurl } from '../config/constants';
import { cn } from '../lib/utils';

const EMPLOYMENT_TYPES = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship' };
const WORK_MODES = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };
const APPLICATION_STATUSES = {
  new: { label: 'New', className: 'bg-blue-50 text-blue-700' },
  reviewing: { label: 'Reviewing', className: 'bg-amber-50 text-amber-700' },
  shortlisted: { label: 'Shortlisted', className: 'bg-purple-50 text-purple-700' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },
  hired: { label: 'Hired', className: 'bg-green-50 text-green-700' },
};

const EMPTY_FORM = {
  title: '',
  department: '',
  location: '',
  employmentType: 'full_time',
  workMode: 'onsite',
  experience: '',
  salaryRange: '',
  summary: '',
  description: '',
  responsibilities: '',
  requirements: '',
  status: 'open',
};

const inputClass = (error) => cn(
  'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2',
  error ? 'border-red-400 focus:ring-red-200' : 'border-[#E6E0E9] focus:ring-[#A3078F]/30 focus:border-[#A3078F]'
);

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Careers = () => {
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [counts, setCounts] = useState({});
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const fetchJobs = useCallback(async () => {
    const { data } = await apiClient.get('/api/careers/admin/jobs');
    setJobs(data.jobs || []);
  }, []);

  const fetchApplications = useCallback(async () => {
    const { data } = await apiClient.get('/api/careers/admin/applications', {
      params: { job: jobFilter || undefined, status: statusFilter || undefined },
    });
    setApplications(data.applications || []);
    setCounts(data.counts || {});
  }, [jobFilter, statusFilter]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchJobs(), fetchApplications()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load careers data');
    } finally {
      setLoading(false);
    }
  }, [fetchJobs, fetchApplications]);

  useEffect(() => { refresh(); }, [refresh]);

  const totalApplications = Object.values(counts).reduce((a, b) => a + b, 0);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(job) {
    setForm({
      title: job.title,
      department: job.department,
      location: job.location,
      employmentType: job.employmentType,
      workMode: job.workMode,
      experience: job.experience || '',
      salaryRange: job.salaryRange || '',
      summary: job.summary,
      description: job.description || '',
      responsibilities: job.responsibilities.join('\n'),
      requirements: job.requirements.join('\n'),
      status: job.status,
    });
    setFieldErrors({});
    setEditingId(job.id);
    setShowForm(true);
  }

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function handleSave() {
    const missing = ['title', 'department', 'location', 'summary'].filter((k) => !form[k].trim());
    if (missing.length) {
      setFieldErrors(Object.fromEntries(missing.map((k) => [k, 'Required'])));
      toast.error('Please fill in the required fields');
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await apiClient.put(`/api/careers/admin/jobs/${editingId}`, form);
        toast.success('Job updated');
      } else {
        await apiClient.post('/api/careers/admin/jobs', form);
        toast.success('Job posted');
      }
      setShowForm(false);
      fetchJobs();
    } catch (err) {
      setFieldErrors(err.response?.data?.errors || {});
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleOpen(job) {
    const status = job.status === 'open' ? 'closed' : 'open';
    try {
      await apiClient.put(`/api/careers/admin/jobs/${job.id}`, { status });
      toast.success(status === 'open' ? 'Job reopened' : 'Job closed');
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  }

  async function handleDelete(id) {
    try {
      await apiClient.delete(`/api/careers/admin/jobs/${id}`);
      toast.success('Job deleted');
      setDeleteConfirm(null);
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  }

  async function updateApplicationStatus(application, status) {
    try {
      await apiClient.patch(`/api/careers/admin/applications/${application.id}`, { status });
      toast.success(`Marked as ${APPLICATION_STATUSES[status].label.toLowerCase()}`);
      fetchApplications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  }

  function viewApplicationsFor(job) {
    setJobFilter(job.id);
    setStatusFilter('');
    setTab('applications');
  }

  return (
    <div className="min-h-screen bg-[#FAF8FB] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#A3078F] rounded-xl flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#17131A]">Careers</h1>
              <p className="text-sm text-[#6B7280]">Job openings on the website and the applications they receive</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={refresh} className="p-2 text-[#6B7280] hover:text-[#17131A] hover:bg-white rounded-lg transition-colors" title="Refresh">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            {tab === 'jobs' && (
              <button onClick={openCreate} className="flex items-center gap-2 bg-[#A3078F] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A0A74] transition-colors">
                <Plus className="h-4 w-4" /> Post a Job
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-[#E6E0E9] rounded-xl p-1 w-fit mb-6">
          {[
            { value: 'jobs', label: 'Openings', count: jobs.length },
            { value: 'applications', label: 'Applications', count: totalApplications, badge: counts.new },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5',
                tab === t.value ? 'bg-[#17131A] text-white' : 'text-[#6B7280] hover:text-[#17131A]'
              )}
            >
              {t.label} <span className="opacity-60">{t.count}</span>
              {t.badge > 0 && <span className="bg-[#A3078F] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{t.badge} new</span>}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : tab === 'jobs' ? (
          /* ── Openings ── */
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl border border-[#E6E0E9] overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', job.status === 'open' ? 'bg-green-500' : 'bg-[#D1D5DB]')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#17131A]">{job.title}</span>
                      <span className="text-xs bg-[#F3F0F4] text-[#6B7280] px-2 py-0.5 rounded-full">{job.department}</span>
                      {job.status === 'closed' && <span className="text-xs bg-[#F3F0F4] text-[#9CA3AF] px-2 py-0.5 rounded-full">Closed</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9CA3AF] mt-1">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                      <span>{EMPLOYMENT_TYPES[job.employmentType]} · {WORK_MODES[job.workMode]}</span>
                      {job.salaryRange && <span>{job.salaryRange}</span>}
                      <span>Posted {formatDate(job.postedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => viewApplicationsFor(job)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#17131A] hover:bg-[#F3F0F4] rounded-lg transition-colors"
                      title="View applications"
                    >
                      <Users className="h-3.5 w-3.5" /> {job.applications}
                    </button>
                    <a
                      href={`${websiteurl}/careers/${job.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[#9CA3AF] hover:text-[#17131A] hover:bg-[#F3F0F4] rounded-lg transition-colors"
                      title="View on website"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button onClick={() => toggleOpen(job)} className="px-2.5 py-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#17131A] hover:bg-[#F3F0F4] rounded-lg transition-colors">
                      {job.status === 'open' ? 'Close' : 'Reopen'}
                    </button>
                    <button onClick={() => openEdit(job)} className="p-2 text-[#9CA3AF] hover:text-[#17131A] hover:bg-[#F3F0F4] rounded-lg transition-colors" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(job.id)} className="p-2 text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {deleteConfirm === job.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
                        <span className="text-sm text-red-700">
                          Delete <strong>{job.title}</strong>? Its applications are kept. Consider closing it instead.
                        </span>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => setDeleteConfirm(null)} className="flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#17131A] px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                          <button onClick={() => handleDelete(job.id)} className="flex items-center gap-1 text-sm text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors">
                            <Check className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {!jobs.length && (
              <div className="text-center py-16 text-[#9CA3AF]">
                <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No job openings yet. Post your first role.</p>
              </div>
            )}
          </div>
        ) : (
          /* ── Applications ── */
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <select className="border border-[#E6E0E9] bg-white rounded-lg px-3 py-2 text-sm" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
                <option value="">All jobs</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
              <select className="border border-[#E6E0E9] bg-white rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {Object.entries(APPLICATION_STATUSES).map(([value, s]) => (
                  <option key={value} value={value}>{s.label} ({counts[value] || 0})</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {applications.map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-[#E6E0E9] overflow-hidden">
                  <div className="flex flex-wrap items-center gap-4 p-4">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#17131A]">{a.name}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', APPLICATION_STATUSES[a.status].className)}>
                          {APPLICATION_STATUSES[a.status].label}
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7280] mt-0.5">
                        {a.jobTitle}{a.experienceYears !== null && ` · ${a.experienceYears} yrs experience`} · Applied {formatDate(a.createdAt)}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7280] mt-2">
                        <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:text-[#A3078F]"><Mail className="h-3 w-3" />{a.email}</a>
                        <a href={`tel:${a.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 hover:text-[#A3078F]"><Phone className="h-3 w-3" />{a.phone}</a>
                        <a href={a.resumeLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#A3078F] hover:underline"><FileText className="h-3 w-3" />Resume</a>
                        {a.linkedinUrl && (
                          <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#A3078F] hover:underline"><Linkedin className="h-3 w-3" />LinkedIn</a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="border border-[#E6E0E9] rounded-lg px-2.5 py-1.5 text-sm"
                        value={a.status}
                        onChange={(e) => updateApplicationStatus(a, e.target.value)}
                        aria-label={`Status for ${a.name}`}
                      >
                        {Object.entries(APPLICATION_STATUSES).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
                      </select>
                      {a.coverLetter && (
                        <button
                          onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                          className="p-2 text-[#9CA3AF] hover:text-[#17131A] hover:bg-[#F3F0F4] rounded-lg transition-colors"
                          title="Cover letter"
                        >
                          {expanded === a.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {expanded === a.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <p className="border-t border-[#E6E0E9] bg-[#FAF8FB] px-4 py-3 text-sm text-[#374151] whitespace-pre-line">{a.coverLetter}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {!applications.length && (
                <div className="text-center py-16 text-[#9CA3AF]">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No applications match these filters.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create / Edit modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between p-5 border-b border-[#E6E0E9] sticky top-0 bg-white z-10">
                  <h2 className="font-bold text-lg text-[#17131A]">{editingId ? 'Edit Job' : 'Post a Job'}</h2>
                  <button onClick={() => setShowForm(false)} className="p-1.5 text-[#9CA3AF] hover:text-[#17131A] rounded-lg hover:bg-[#F3F0F4] transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: 'title', label: 'Job title *', placeholder: 'Field Sales Executive' },
                      { key: 'department', label: 'Department *', placeholder: 'Sales', list: 'job-departments' },
                      { key: 'location', label: 'Location *', placeholder: 'Thane, Maharashtra' },
                      { key: 'experience', label: 'Experience', placeholder: '1-3 years' },
                      { key: 'salaryRange', label: 'Salary range', placeholder: '₹3.5-5 LPA' },
                    ].map(({ key, label, placeholder, list }) => (
                      <div key={key}>
                        <label className="block text-sm font-semibold text-[#17131A] mb-1">{label}</label>
                        <input className={inputClass(fieldErrors[key])} value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder={placeholder} list={list} />
                        {fieldErrors[key] && <p className="text-xs text-red-600 mt-1">{fieldErrors[key]}</p>}
                      </div>
                    ))}
                    <datalist id="job-departments">
                      {[...new Set(jobs.map((j) => j.department))].map((d) => <option key={d} value={d} />)}
                    </datalist>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-[#17131A] mb-1">Type</label>
                        <select className={inputClass()} value={form.employmentType} onChange={(e) => setField('employmentType', e.target.value)}>
                          {Object.entries(EMPLOYMENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#17131A] mb-1">Work mode</label>
                        <select className={inputClass()} value={form.workMode} onChange={(e) => setField('workMode', e.target.value)}>
                          {Object.entries(WORK_MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#17131A] mb-1">Summary *</label>
                    <textarea rows={2} maxLength={400} className={inputClass(fieldErrors.summary)} value={form.summary} onChange={(e) => setField('summary', e.target.value)} placeholder="One or two sentences shown in the job list" />
                    {fieldErrors.summary && <p className="text-xs text-red-600 mt-1">{fieldErrors.summary}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#17131A] mb-1">About the role</label>
                    <textarea rows={3} className={inputClass()} value={form.description} onChange={(e) => setField('description', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#17131A] mb-1">Responsibilities</label>
                      <textarea rows={5} className={inputClass()} value={form.responsibilities} onChange={(e) => setField('responsibilities', e.target.value)} placeholder="One per line" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#17131A] mb-1">Requirements</label>
                      <textarea rows={5} className={inputClass()} value={form.requirements} onChange={(e) => setField('requirements', e.target.value)} placeholder="One per line" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.status === 'open'} onChange={(e) => setField('status', e.target.checked ? 'open' : 'closed')} className="rounded" />
                    <span className="text-sm font-semibold text-[#17131A]">Open for applications</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#E6E0E9] sticky bottom-0 bg-white">
                  <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#17131A] rounded-lg hover:bg-[#F3F0F4] transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-[#A3078F] hover:bg-[#7A0A74] rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Post Job'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Careers;
