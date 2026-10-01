import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import apiClient from '../services/apiClient';
import ListingForm from '../components/ListingForm';

// Admin "Edit" for any listing (app, website or admin-added), same fields as Add.
// Editing keeps the listing's current review status.
const UpdateListing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.get(`/api/admin/listings/${id}`)
      .then(({ data }) => setListing(data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load the listing'));
  }, [id]);

  const handleSubmit = async (formData) => {
    await apiClient.patch(`/api/admin/listings/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    toast.success('Listing updated');
    navigate('/list');
  };

  return (
    <div className="min-h-screen pt-8 pb-12 px-4 bg-[#FAF8FB]">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button onClick={() => navigate('/list')}
            className="flex items-center gap-2 text-sm text-[#5A5856] hover:text-[#A3078F] mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Properties
          </button>
          <h1 className="text-3xl font-bold text-[#17131A] mb-1">Edit Property</h1>
          {listing && <p className="text-[#5A5856] line-clamp-1">{listing.title}</p>}
        </motion.div>

        {error ? (
          <p className="text-center py-16 text-[#5A5856]">{error}</p>
        ) : !listing ? (
          <div className="flex justify-center py-24">
            <div className="w-12 h-12 border-4 border-[#A3078F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ListingForm listing={listing} onSubmit={handleSubmit} submitLabel="Save changes" />
        )}
      </div>
    </div>
  );
};

export default UpdateListing;
