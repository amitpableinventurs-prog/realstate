import mongoose from 'mongoose';

// Applications submitted from the website careers page
const jobApplicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    jobTitle: { type: String, required: true }, // snapshot, survives job edits/deletion
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    resumeLink: { type: String, required: true, trim: true, maxlength: 500 }, // Google Drive / Dropbox / portfolio
    linkedinUrl: { type: String, trim: true, maxlength: 300, default: '' },
    experienceYears: { type: Number, min: 0, max: 60 },
    coverLetter: { type: String, trim: true, maxlength: 3000, default: '' },
    status: {
      type: String,
      enum: ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'],
      default: 'new',
    },
  },
  { timestamps: true }
);

// One application per email per job
jobApplicationSchema.index({ job: 1, email: 1 }, { unique: true });
jobApplicationSchema.index({ status: 1, createdAt: -1 });

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);

export default JobApplication;
