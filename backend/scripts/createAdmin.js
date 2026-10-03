import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../models/adminModel.js';

// Creates the super admin from ADMIN_EMAIL / ADMIN_PASSWORD (once).
//   node scripts/createAdmin.js

dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const run = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables');
  }
  await mongoose.connect(process.env.MONGO_URI);
  if (await Admin.exists({ email })) {
    console.log('Admin user already exists');
    return;
  }
  const admin = new Admin({ email, name: 'Super Admin' });
  await admin.setPassword(process.env.ADMIN_PASSWORD);
  await admin.save();
  console.log(`Admin user created: ${email}`);
};

run()
  .catch((error) => {
    console.error('Error creating admin user:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
