import mongoose from 'mongoose';

const appFeedbackSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['APP_RATING', 'FEEDBACK'],
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  name: { type: String, trim: true, maxlength: 80 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  rating: { type: Number, min: 1, max: 5 },
  message: { type: String, trim: true, maxlength: 2000 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

appFeedbackSchema.index({ created_at: -1 });
appFeedbackSchema.index({ type:  1, created_at: -1 });

const AppFeedback = mongoose.model('AppFeedback', appFeedbackSchema);

export default AppFeedback;
