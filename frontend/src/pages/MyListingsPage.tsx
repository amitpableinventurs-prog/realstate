import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { listingsAPI, type UserListing } from '../services/api';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

// ── Types ─────────────────────────────────────────────────────────────────────

// Listings posted with the "Register your property" form (same API as the mobile app)
type Listing = UserListing;

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: 'Under Review',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-400',
  },
  active: {
    label: 'Live',
    bg: 'bg-green-100',
    text: 'text-green-800',
    dot: 'bg-green-500',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
  },
  inactive: {
    label: 'Hidden',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
  },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

const MyListingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast.error('Please sign in to view your listings.');
      navigate('/signin', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // ── Fetch listings ──────────────────────────────────────────

  const fetchListings = useCallback(async () => {
    setFetchLoading(true);
    try {
      const res = await listingsAPI.mine();
      setListings(res.data.data ?? []);
    } catch {
      toast.error('Failed to load your listings. Please try again.');
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchListings();
  }, [isAuthenticated, fetchListings]);

  // ── Delete ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await listingsAPI.delete(deleteTarget.id);
      setListings((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast.success('Listing deleted successfully.');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete listing.';
      toast.error(msg);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── Loading / auth ──────────────────────────────────────────

  if (isLoading || fetchLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8FB]">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="h-8 w-48 bg-[#E8E1EA] rounded animate-pulse mb-10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white border border-[#E8E1EA] rounded-2xl overflow-hidden">
                <div className="h-44 bg-[#E8E1EA] animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-[#E8E1EA] rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-[#E8E1EA] rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────

  if (!fetchLoading && listings.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF8FB]">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 bg-[#F3EDF4] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[#A3078F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h2 className="font-fraunces text-3xl font-bold text-[#1A0A1E] mb-3">No listings yet</h2>
          <p className="font-manrope text-[#6B7280] mb-8">
            You haven't posted any properties. List your first property and reach thousands of buyers.
          </p>
          <Link
            to="/add-property"
            className="inline-block bg-[#A3078F] text-white font-manrope font-semibold px-8 py-3 rounded-xl hover:bg-[#8E0A82] transition-[background-color]"
          >
            + List a Property
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Main view ───────────────────────────────────────────────

  const counts = {
    all: listings.length,
    active: listings.filter((l) => l.status === 'active').length,
    pending: listings.filter((l) => l.status === 'pending').length,
    rejected: listings.filter((l) => l.status === 'rejected').length,
    inactive: listings.filter((l) => l.status === 'inactive').length,
  };

  return (
    <div className="min-h-screen bg-[#FAF8FB]">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-fraunces text-4xl font-bold text-[#1A0A1E]">My Listings</h1>
            <p className="font-manrope text-[#6B7280] mt-1">
              {counts.all} {counts.all === 1 ? 'property' : 'properties'} total
            </p>
          </div>
          <Link
            to="/add-property"
            className="inline-flex items-center gap-2 bg-[#A3078F] text-white font-manrope font-semibold px-5 py-2.5 rounded-xl hover:bg-[#8E0A82] transition-[background-color] self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Listing
          </Link>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {(['active', 'pending', 'rejected', 'inactive'] as const).map((status) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} className="bg-white border border-[#E8E1EA] rounded-xl p-4">
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-manrope font-medium ${cfg.bg} ${cfg.text} mb-2`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </div>
                <p className="font-fraunces text-2xl font-bold text-[#1A0A1E]">{counts[status]}</p>
              </div>
            );
          })}
        </div>

        {/* ── Listing cards ── */}
        <div className="space-y-4">
          {listings.map((listing) => {
            const cfg = STATUS_CONFIG[listing.status] ?? STATUS_CONFIG.pending;
            const coverImage = listing.coverImage;
            const place = [listing.address, listing.district?.name, listing.district?.state].filter(Boolean).join(', ');

            return (
              <div
                key={listing.id}
                className="bg-white border border-[#E8E1EA] rounded-2xl overflow-hidden flex flex-col sm:flex-row"
              >
                {/* Thumbnail */}
                <div className="sm:w-48 sm:flex-shrink-0 h-44 sm:h-auto bg-[#F3EDF4] relative">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-[#D6CFDA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-5 flex flex-col justify-between gap-3">
                  <div>
                    {/* Title row */}
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                      <h3 className="font-fraunces text-lg font-semibold text-[#1A0A1E] leading-snug">
                        {listing.title}
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-manrope font-semibold ${cfg.bg} ${cfg.text} flex-shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Meta */}
                    <p className="font-manrope text-sm text-[#6B7280] mb-2 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {place || '—'}
                    </p>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-manrope text-sm text-[#374151]">
                      <span className="font-semibold text-[#A3078F]">{listing.priceLabel}</span>
                      {listing.unitPriceLabel && <span className="text-[#6B7280]">({listing.unitPriceLabel})</span>}
                      <span>·</span>
                      <span>{listing.area.label}</span>
                      {listing.khataNo && <><span>·</span><span>Khata {listing.khataNo}</span></>}
                      {listing.khasraNo && <><span>·</span><span>Khasra {listing.khasraNo}</span></>}
                      <span>·</span>
                      <span>{listing.typeLabel}</span>
                    </div>
                  </div>

                  {/* Rejection reason */}
                  {listing.status === 'rejected' && listing.rejectionReason && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-manrope text-xs font-semibold text-red-700 mb-0.5">Rejection Reason</p>
                        <p className="font-manrope text-xs text-red-600">{listing.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {listing.status === 'pending' && (
                    <p className="font-manrope text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Waiting for admin approval — it will appear on the website once approved.
                    </p>
                  )}

                  {/* Footer: date + actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#F3EDF4]">
                    <p className="font-manrope text-xs text-[#9CA3AF]">
                      Listed {formatDate(listing.createdAt)}
                    </p>

                    <div className="flex items-center gap-2">
                      {/* View live listing (active only) */}
                      {listing.status === 'active' && (
                        <Link
                          to={`/property/${listing.id}`}
                          className="font-manrope text-xs font-medium text-[#A3078F] hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Live
                        </Link>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(listing)}
                        className="flex items-center gap-1.5 font-manrope text-xs font-semibold text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-[background-color]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-[#1A0A1E]">{deleteTarget?.title}</strong> will be permanently
              removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default MyListingsPage;
