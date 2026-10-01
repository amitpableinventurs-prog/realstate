import mongoose from 'mongoose';
import validator from 'validator';
import Job from '../models/jobModel.js';
import JobApplication from '../models/jobApplicationModel.js';
import { uniqueSlug } from '../utils/slugify.js';

const EMPLOYMENT_TYPES = Job.schema.path('employmentType').enumValues;
const WORK_MODES = Job.schema.path('workMode').enumValues;
const APPLICATION_STATUSES = JobApplication.schema.path('status').enumValues;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isHttpUrl = (url) => validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true });

const serializeJob = (job, { full = false, admin = false } = {}) => ({
  id: job._id,
  title: job.title,
  slug: job.slug,
  department: job.department,
  location: job.location,
  employmentType: job.employmentType,
  workMode: job.workMode,
  experience: job.experience || null,
  salaryRange: job.salaryRange || null,
  summary: job.summary,
  isOpen: job.status === 'open',
  postedAt: job.createdAt,
  ...((full || admin) && {
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
  }),
  ...(admin && { status: job.status, applications: job.applications, updatedAt: job.updatedAt }),
});

const parseJobInput = (body = {}, { partial }) => {
  const data = {};
  const errors = {};
  const text = (key, max, required) => {
    if (body[key] === undefined) {
      if (required && !partial) errors[key] = `${key} is required`;
      return;
    }
    const value = String(body[key] ?? '').trim();
    if (required && !value) errors[key] = `${key} is required`;
    else if (value.length > max) errors[key] = `Must be at most ${max} characters`;
    else data[key] = value;
  };
  const list = (key) => {
    if (body[key] === undefined) return;
    const items = Array.isArray(body[key]) ? body[key] : String(body[key]).split('\n');
    data[key] = items.map((i) => String(i).trim()).filter(Boolean).slice(0, 20);
  };
  const oneOf = (key, allowed) => {
    if (body[key] === undefined) return;
    if (!allowed.includes(body[key])) errors[key] = `Must be one of ${allowed.join(', ')}`;
    else data[key] = body[key];
  };

  text('title', 150, true);
  text('department', 60, true);
  text('location', 100, true);
  text('summary', 400, true);
  text('description', 10000, false);
  text('experience', 60, false);
  text('salaryRange', 60, false);
  text('slug', 150, false);
  list('responsibilities');
  list('requirements');
  oneOf('employmentType', EMPLOYMENT_TYPES);
  oneOf('workMode', WORK_MODES);
  oneOf('status', ['open', 'closed']);

  return { data, errors };
};

// ── Public ───────────────────────────────────────────────────────────────────

// GET /api/careers/jobs?department=&workMode=&employmentType=&q=
export const listOpenJobs = async (req, res) => {
  try {
    const filter = { status: 'open' };
    if (req.query.department) filter.department = String(req.query.department);
    if (WORK_MODES.includes(req.query.workMode)) filter.workMode = req.query.workMode;
    if (EMPLOYMENT_TYPES.includes(req.query.employmentType)) filter.employmentType = req.query.employmentType;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: rx }, { summary: rx }, { location: rx }, { department: rx }];
    }

    const [jobs, departments] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }),
      Job.aggregate([
        { $match: { status: 'open' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      jobs: jobs.map((j) => serializeJob(j)),
      departments: departments.map((d) => ({ name: d._id, count: d.count })),
    });
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({ success: false, message: 'Failed to load openings' });
  }
};

// GET /api/careers/jobs/:slug — closed jobs are still returned (isOpen: false) so old links work
export const getJob = async (req, res) => {
  try {
    const job = await Job.findOne({ slug: String(req.params.slug).toLowerCase() });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, job: serializeJob(job, { full: true }) });
  } catch (error) {
    console.error('Error loading job:', error);
    res.status(500).json({ success: false, message: 'Failed to load job' });
  }
};

// POST /api/careers/jobs/:slug/apply
export const applyForJob = async (req, res) => {
  try {
    const job = await Job.findOne({ slug: String(req.params.slug).toLowerCase() });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (job.status !== 'open') {
      return res.status(400).json({ success: false, message: 'This position is no longer accepting applications' });
    }

    const body = req.body || {};
    const str = (key) => (typeof body[key] === 'string' ? body[key].trim() : '');
    const name = str('name');
    const email = str('email').toLowerCase();
    const phone = str('phone');
    const resumeLink = str('resumeLink');
    const linkedinUrl = str('linkedinUrl');
    const coverLetter = str('coverLetter');
    const experienceYears = body.experienceYears === undefined || body.experienceYears === ''
      ? undefined
      : Number(body.experienceYears);

    const errors = {};
    if (name.length < 2 || name.length > 100) errors.name = 'Please enter your full name';
    if (!validator.isEmail(email)) errors.email = 'Please enter a valid email';
    if (!/^[+\d][\d\s-]{6,18}$/.test(phone)) errors.phone = 'Please enter a valid phone number';
    if (!isHttpUrl(resumeLink)) errors.resumeLink = 'Please share a link to your resume (Google Drive, Dropbox, etc.)';
    if (linkedinUrl && !isHttpUrl(linkedinUrl)) errors.linkedinUrl = 'Please enter a valid URL';
    if (experienceYears !== undefined && (!Number.isFinite(experienceYears) || experienceYears < 0 || experienceYears > 60)) {
      errors.experienceYears = 'Must be between 0 and 60';
    }
    if (coverLetter.length > 3000) errors.coverLetter = 'Must be at most 3000 characters';
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });
    }

    try {
      await JobApplication.create({
        job: job._id,
        jobTitle: job.title,
        name, email, phone, resumeLink, linkedinUrl, coverLetter, experienceYears,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'You have already applied for this position' });
      }
      throw error;
    }
    await Job.updateOne({ _id: job._id }, { $inc: { applications: 1 } });

    res.status(201).json({ success: true, message: 'Application submitted. Our team will get back to you soon.' });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ success: false, message: 'Failed to submit application' });
  }
};

// ── Admin ────────────────────────────────────────────────────────────────────

// GET /api/careers/admin/jobs
export const adminListJobs = async (req, res) => {
  try {
    const jobs = await Job.find().sort({ status: -1, createdAt: -1 }); // open first
    res.json({ success: true, jobs: jobs.map((j) => serializeJob(j, { admin: true })) });
  } catch (error) {
    console.error('Error listing jobs (admin):', error);
    res.status(500).json({ success: false, message: 'Failed to load jobs' });
  }
};

// POST /api/careers/admin/jobs
export const adminCreateJob = async (req, res) => {
  try {
    const { data, errors } = parseJobInput(req.body, { partial: false });
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });
    }
    data.slug = await uniqueSlug(Job, data.slug || `${data.title} ${data.location}`);
    const job = await Job.create(data);
    res.status(201).json({ success: true, message: 'Job created', job: serializeJob(job, { admin: true }) });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ success: false, message: 'Failed to create job' });
  }
};

// PUT /api/careers/admin/jobs/:id
export const adminUpdateJob = async (req, res) => {
  try {
    const job = mongoose.isValidObjectId(req.params.id) && await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const { data, errors } = parseJobInput(req.body, { partial: true });
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });
    }
    if (data.slug !== undefined) {
      data.slug = await uniqueSlug(Job, data.slug || `${data.title || job.title} ${data.location || job.location}`, job._id);
    }
    job.set(data);
    await job.save();
    res.json({ success: true, message: 'Job updated', job: serializeJob(job, { admin: true }) });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ success: false, message: 'Failed to update job' });
  }
};

// DELETE /api/careers/admin/jobs/:id — applications are kept (they store the job title)
export const adminDeleteJob = async (req, res) => {
  try {
    const job = mongoose.isValidObjectId(req.params.id) && await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, message: 'Job deleted' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ success: false, message: 'Failed to delete job' });
  }
};

// GET /api/careers/admin/applications?job=&status=
export const adminListApplications = async (req, res) => {
  try {
    const filter = {};
    if (mongoose.isValidObjectId(req.query.job)) filter.job = req.query.job;
    if (APPLICATION_STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const [applications, counts] = await Promise.all([
      JobApplication.find(filter).sort({ createdAt: -1 }).limit(500),
      JobApplication.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    res.json({
      success: true,
      applications: applications.map((a) => ({
        id: a._id,
        jobId: a.job,
        jobTitle: a.jobTitle,
        name: a.name,
        email: a.email,
        phone: a.phone,
        resumeLink: a.resumeLink,
        linkedinUrl: a.linkedinUrl || null,
        experienceYears: a.experienceYears ?? null,
        coverLetter: a.coverLetter || null,
        status: a.status,
        createdAt: a.createdAt,
      })),
      counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    });
  } catch (error) {
    console.error('Error listing applications:', error);
    res.status(500).json({ success: false, message: 'Failed to load applications' });
  }
};

// PATCH /api/careers/admin/applications/:id  { status }
export const adminUpdateApplication = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of ${APPLICATION_STATUSES.join(', ')}` });
    }
    const application = mongoose.isValidObjectId(req.params.id) &&
      await JobApplication.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, message: 'Application updated' });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, message: 'Failed to update application' });
  }
};
