import mongoose from 'mongoose';

// Job openings, managed in the admin panel and listed on the website /careers.
const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 170 },
    department: { type: String, required: true, trim: true, maxlength: 60 },
    location: { type: String, required: true, trim: true, maxlength: 100 },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'internship'],
      default: 'full_time',
    },
    workMode: { type: String, enum: ['onsite', 'hybrid', 'remote'], default: 'onsite' },
    experience: { type: String, trim: true, maxlength: 60, default: '' },   // e.g. "2-4 years"
    salaryRange: { type: String, trim: true, maxlength: 60, default: '' },  // e.g. "₹6-9 LPA"
    summary: { type: String, required: true, trim: true, maxlength: 400 },
    description: { type: String, trim: true, maxlength: 10000, default: '' },
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    applications: { type: Number, default: 0 },
  },
  { timestamps: true }
);

jobSchema.index({ status: 1, createdAt: -1 });

const Job = mongoose.model('Job', jobSchema);

export default Job;
