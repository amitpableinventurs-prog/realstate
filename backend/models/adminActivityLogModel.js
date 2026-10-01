import mongoose from 'mongoose';

const adminActivityLogSchema = new mongoose.Schema({
  adminEmail: {
    type: String,
    required: true,
    trim: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'approve_property',
      'reject_property',
      'delete_property',
      'bulk_approve_properties',
      'bulk_reject_properties',
      'bulk_delete_properties',
      'suspend_user',
      'ban_user',
      'unban_user',
      'delete_user',
      'bulk_suspend_users',
      'bulk_ban_users',
      'approve_listing',
      'reject_listing',
      'assign_district',
      'create_district',
      'update_district',
      'delete_district',
      'create_district_admin',
      'update_district_admin',
      'delete_district_admin',
      'update_listing',
      'restore_listing',
      'create_state',
      'update_state',
      'delete_state'
    ]
  },
  // property = website listing, listing = mobile app listing
  targetType: {
    type: String,
    required: true,
    enum: ['property', 'listing', 'user', 'appointment', 'district', 'admin', 'state']
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'targetType'
  },
  targetName: {
    type: String,
    default: ''
  },
  metadata: {
    reason: String,
    count: Number,
    affectedIds: [mongoose.Schema.Types.ObjectId],
    previousStatus: String,
    newStatus: String,
    days: Number,
    district: String
  },
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
adminActivityLogSchema.index({ adminEmail: 1, createdAt: -1 });
adminActivityLogSchema.index({ action: 1, createdAt: -1 });
adminActivityLogSchema.index({ targetType: 1, createdAt: -1 });
adminActivityLogSchema.index({ targetId: 1 });
adminActivityLogSchema.index({ createdAt: -1 });

const AdminActivityLog = mongoose.model('AdminActivityLog', adminActivityLogSchema);

export default AdminActivityLog;
