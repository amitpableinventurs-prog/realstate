import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import apiClient from '../services/apiClient';
import ListingForm from '../components/ListingForm';

// Admin "Add Property" — same fields as the mobile app / website listing form.
// Listings added by the admin are live immediately (the admin is the approver).
const AddListing = () => {
  const navigate = useNavigate();
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = async (formData) => {
    await apiClient.post('/api/admin/listings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    toast.success('Property added — it is live on the website and app', {
      action: { label: 'View all', onClick: () => navigate('/list') },
    });
    setFormKey((k) => k + 1); // fresh, empty form for the next property
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen pt-8 pb-12 px-4 bg-[#FAF8FB]">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-[#17131A] mb-1">Add Property</h1>
          <p className="text-[#5A5856]">Register a property with the same details as the Bhumi Bazar app. It goes live immediately.</p>
        </motion.div>
        <ListingForm key={formKey} onSubmit={handleSubmit} submitLabel="Register Property" />
      </div>
    </div>
  );
};

export default AddListing;
