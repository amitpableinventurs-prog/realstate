import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, Building2, MapPin,
  Maximize, User, Phone, Clock, RefreshCw, Search,
  ChevronLeft, ChevronRight, Images, Landmark, FileText,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "../services/apiClient";
import { cn, formatDate } from "../lib/utils";
import { getAdminSession } from "../lib/adminSession";
import DistrictOptions from "../components/DistrictOptions";
import { fetchDistricts } from "../lib/districts";

// ─── Image Gallery + Lightbox ─────────────────────────────────────────────────
const ImageGallery = ({ images, title }) => {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const imgs = (images || []).filter(Boolean);

  const openLightbox = (idx, e) => {
    e.stopPropagation();
    setLightboxIdx(idx);
  };

  const closeLightbox = () => setLightboxIdx(null);

  const navigate = (dir, e) => {
    e.stopPropagation();
    setLightboxIdx((i) => (i + dir + imgs.length) % imgs.length);
  };

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i - 1 + imgs.length) % imgs.length);
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i + 1) % imgs.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, imgs.length]);

  if (!imgs.length) {
    return (
      <div className="h-52 bg-[#F5F5F3] flex flex-col items-center justify-center gap-2 border-b border-[#E8E7E5]">
        <Building2 className="w-10 h-10 text-[#CCCCC9]" />
        <p className="text-xs text-[#9B9B99]">No images uploaded</p>
      </div>
    );
  }

  const count = imgs.length;

  return (
    <>
      {/* Gallery grid */}
      <div
        className={cn(
          "grid gap-0.5 overflow-hidden border-b border-[#E8E7E5]",
          count === 1 && "grid-cols-1",
          count === 2 && "grid-cols-2",
          count === 3 && "grid-cols-3",
          count >= 4 && "grid-cols-[2fr_1fr]"
        )}
        style={{ maxHeight: 260 }}
      >
        {/* Hero / main image */}
        <div
          className={cn(
            "relative overflow-hidden cursor-pointer group",
            count >= 4 ? "row-span-2" : "",
            count === 1 ? "aspect-[16/7]" : "aspect-[4/3]"
          )}
          onClick={(e) => openLightbox(0, e)}
        >
          <img
            src={imgs[0]}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
        </div>

        {/* Secondary images */}
        {count >= 4 ? (
          // Right column — 2 stacked
          <div className="grid grid-rows-2 gap-0.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="relative overflow-hidden cursor-pointer group"
                onClick={(e) => openLightbox(i, e)}
              >
                <img src={imgs[i]} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                {/* "See all" overlay on last thumb */}
                {i === 2 && count > 3 && (
                  <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1">
                    <Images className="w-5 h-5 text-white" />
                    <span className="text-white font-bold text-sm">{count} photos</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              </div>
            ))}
          </div>
        ) : count === 2 ? (
          <div className="relative overflow-hidden cursor-pointer group aspect-[4/3]" onClick={(e) => openLightbox(1, e)}>
            <img src={imgs[1]} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
          </div>
        ) : count === 3 ? (
          [1, 2].map((i) => (
            <div key={i} className="relative overflow-hidden cursor-pointer group aspect-[4/3]" onClick={(e) => openLightbox(i, e)}>
              <img src={imgs[i]} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
            </div>
          ))
        ) : null}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] backdrop-blur-lg flex flex-col items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-manrope">
              {lightboxIdx + 1} / {imgs.length}
            </div>

            {/* Main image */}
            <motion.img
              key={lightboxIdx}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              src={imgs[lightboxIdx]}
              alt=""
              className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Prev / Next */}
            {imgs.length > 1 && (
              <>
                <button
                  onClick={(e) => navigate(-1, e)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => navigate(1, e)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Thumbnail strip */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-4" onClick={(e) => e.stopPropagation()}>
              {imgs.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  className={cn(
                    "w-14 h-10 rounded overflow-hidden border-2 transition-all duration-150 flex-shrink-0",
                    i === lightboxIdx ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"
                  )}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Reject Modal ─────────────────────────────────────────────────────────────
const RejectModal = ({ listing, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState("");

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          className="absolute inset-0 bg-black/50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="relative bg-white rounded-2xl border border-[#E8E7E5] shadow-2xl w-full max-w-md p-6 z-10"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <X className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0F0C11] text-sm">Reject Listing</h3>
                <p className="text-xs text-[#9B9B99] mt-0.5 truncate max-w-[220px]">{listing.title}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-[#9B9B99] hover:text-[#0F0C11] p-1 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onConfirm(reason.trim()); }} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B6B6A] uppercase tracking-wider mb-2">
                Rejection reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="e.g. Missing price details, unclear photos, prohibited content…"
                className="w-full border border-[#E8E7E5] rounded-xl px-3 py-2.5 text-sm text-[#0F0C11] focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none"
                autoFocus
              />
              <p className="text-xs text-[#9B9B99] mt-1">
                The owner is notified and sees this reason in My Listings.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} disabled={loading}
                className="flex-1 py-2.5 text-sm font-medium text-[#6B6B6A] border border-[#E8E7E5] rounded-xl hover:bg-[#F5F5F3] transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading || !reason.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && (
                  <motion.span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }} />
                )}
                Reject Listing
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─── Properties (GET /api/v1/admin/properties) ────────────────────────────────

const TYPE_LABELS = { SELL: "For Sale", RENT: "For Rent", LEASE: "For Lease" };
const UNIT_LABELS = { KATHA: "Katha", DISMIL: "Dismil" };

const toCard = (p) => ({
  id: p.id,
  title: p.title,
  images: (p.images || []).map((i) => i.url),
  location: [p.address, p.district?.name, p.state?.name].filter(Boolean).join(", ") || "—",
  price: p.price?.label,
  typeLabel: TYPE_LABELS[p.listing_type],
  specs: [
    { icon: Maximize, text: `${p.area.value} ${UNIT_LABELS[p.area.unit] || p.area.unit}` },
    { icon: FileText, text: `Khata ${p.khata_number} · Khasra ${p.khasra_number}` },
  ],
  estimatedTotal: p.estimated_total,
  description: p.description,
  submitter: p.owner?.name || "Owner",
  contact: p.owner?.mobile,
  createdAt: p.created_at,
  district: p.district,
  status: p.status,
  rejectionReason: p.rejection_reason,
  approvedAt: p.approved_at,
});

const api = {
  list: async (params) => {
    const { data } = await apiClient.get("/api/v1/admin/properties", { params });
    return { items: (data.data || []).map(toCard), total: data.meta?.total ?? 0, totalPages: data.meta?.totalPages ?? 1 };
  },
  approve: (id) => apiClient.patch(`/api/v1/admin/properties/${id}/approve`),
  reject: (id, reason) => apiClient.patch(`/api/v1/admin/properties/${id}/reject`, { rejection_reason: reason }),
  moveDistrict: (id, districtId) => apiClient.put(`/api/v1/admin/properties/${id}`, { district_id: districtId }),
};

const STATUS_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_BADGE = {
  PENDING: { label: "Under Review", className: "text-amber-700 bg-amber-50 border-amber-200/60" },
  APPROVED: { label: "Approved", className: "text-emerald-700 bg-emerald-50 border-emerald-200/60" },
  REJECTED: { label: "Rejected", className: "text-red-700 bg-red-50 border-red-200/60" },
};

const PAGE_SIZE = 15;

// ─── Listing Card ─────────────────────────────────────────────────────────────
const ListingCard = ({ listing, onApprove, onReject, actionLoading, districts, onAssignDistrict }) => {
  const badge = STATUS_BADGE[listing.status] || STATUS_BADGE.PENDING;
  const canApprove = listing.status === "PENDING" || listing.status === "REJECTED";
  const canReject = listing.status === "PENDING" || listing.status === "APPROVED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      className="bg-white border border-[#E8E7E5] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Image gallery — full width at top */}
      <ImageGallery images={listing.images} title={listing.title} />

      {/* Property info */}
      <div className="p-5">
        {/* Title + badges */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-[#0F0C11] text-base leading-snug flex-1 min-w-0">
            {listing.title}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {listing.typeLabel && (
              <span className="text-xs font-medium text-[#6B6B6A] bg-[#F5F5F3] border border-[#E8E7E5] px-2 py-0.5 rounded-full">
                {listing.typeLabel}
              </span>
            )}
            <span className={cn("text-xs font-medium border px-2 py-0.5 rounded-full", badge.className)}>
              {badge.label}
            </span>
          </div>
        </div>

        {/* District + location */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {districts ? (
            // Super admin: move the listing to another district's queue
            <label className="flex items-center gap-1.5 text-xs text-[#6B6B6A]">
              <Landmark className="w-3.5 h-3.5 text-[#A3078F]" />
              <select
                value={listing.district?.id || ""}
                onChange={(e) => e.target.value && onAssignDistrict(listing, e.target.value)}
                disabled={!!actionLoading}
                className={cn(
                  "text-xs font-medium border rounded-full px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#A3078F]/20",
                  "text-[#7A0A74] bg-[#FAF1F9] border-[#EBC9E6]"
                )}
                title="District that reviews this property"
              >
                <DistrictOptions districts={districts} keepId={listing.district?.id} />
              </select>
            </label>
          ) : (
            listing.district && (
              <span className="flex items-center gap-1 text-xs font-medium text-[#7A0A74] bg-[#FAF1F9] border border-[#EBC9E6] px-2 py-0.5 rounded-full">
                <Landmark className="w-3 h-3" /> {listing.district.name}
              </span>
            )
          )}
          <p className="flex items-center gap-1.5 text-sm text-[#6B6B6A] min-w-0">
            <MapPin className="w-3.5 h-3.5 text-[#A3078F] shrink-0" />
            <span className="line-clamp-1">{listing.location}</span>
          </p>
        </div>

        {/* Specs */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="font-space-mono font-bold text-[#A3078F] text-base tabular-nums">
            {listing.price}
          </span>
          {listing.specs.length > 0 && <span className="text-[#CCCCC9]">·</span>}
          {listing.specs.map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1 text-xs text-[#6B6B6A]">
              <Icon className="w-3.5 h-3.5" /> {text}
            </span>
          ))}
          {listing.estimatedTotal != null && (
            <span className="text-xs text-[#9B9B99] bg-[#F5F5F3] px-2 py-0.5 rounded-full">
              Est. total ₹{listing.estimatedTotal.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {/* Description */}
        {listing.description && (
          <p className="text-xs text-[#9B9B99] line-clamp-2 leading-relaxed mb-4">
            {listing.description}
          </p>
        )}

        {/* Rejection reason / last decision */}
        {listing.status === "REJECTED" && listing.rejectionReason && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
            <span className="font-semibold">Reason:</span> {listing.rejectionReason}
          </p>
        )}
        {listing.status === "APPROVED" && listing.approvedAt && (
          <p className="text-xs text-[#9B9B99] mb-3">Approved on {formatDate(listing.approvedAt)}</p>
        )}

        {/* Submitter row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#F5F5F3] mb-4">
          <div className="flex items-center gap-1.5 text-xs text-[#6B6B6A]">
            <User className="w-3.5 h-3.5 text-[#9B9B99]" />
            <span className="font-medium">{listing.submitter}</span>
          </div>
          {listing.contact && (
            <div className="flex items-center gap-1.5 text-xs text-[#9B9B99]">
              <Phone className="w-3.5 h-3.5" />
              <span>{listing.contact}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-[#9B9B99] ml-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>Submitted {formatDate(listing.createdAt)}</span>
          </div>
        </div>

        {/* Action buttons — approved listings can be rejected and rejected ones approved */}
        <div className={cn("grid gap-3", canApprove && canReject ? "grid-cols-2" : "grid-cols-1")}>
          {canApprove && (
            <button
              onClick={() => onApprove(listing)}
              disabled={!!actionLoading}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all",
                actionLoading === `approve-${listing.id}` && "opacity-60 cursor-not-allowed"
              )}
            >
              {actionLoading === `approve-${listing.id}` ? (
                <motion.span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }} />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Approve
            </button>
          )}
          {canReject && (
            <button
              onClick={() => onReject(listing)}
              disabled={!!actionLoading}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:scale-[0.98] transition-all",
                actionLoading === `reject-${listing.id}` && "opacity-60 cursor-not-allowed"
              )}
            >
              {actionLoading === `reject-${listing.id}` ? (
                <motion.span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }} />
              ) : (
                <X className="w-4 h-4" />
              )}
              {listing.status === "APPROVED" ? "Disapprove" : "Reject"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const PendingListings = () => {
  const session = getAdminSession();
  const isSuperAdmin = session?.isSuperAdmin !== false;

  // Status and district filter live in the URL so the Districts page can link here
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStatus = (searchParams.get("status") || "").toUpperCase();
  const status = STATUS_TABS.some((t) => t.value === requestedStatus) ? requestedStatus : "PENDING";
  const districtFilter = isSuperAdmin ? searchParams.get("district") || "" : "";

  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [districts, setDistricts] = useState(null); // super admin only
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const setFilter = (key, value, defaultValue) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status, page, limit: PAGE_SIZE, ...(districtFilter && { district_id: districtFilter }) };
      const result = await api.list(params);
      setListings(result.items);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
    } catch (err) {
      setListings([]);
      toast.error(err.response?.data?.message || "Failed to fetch listings.");
    } finally {
      setLoading(false);
    }
  }, [status, page, districtFilter]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchDistricts().then(setDistricts).catch(() => setDistricts([]));
  }, [isSuperAdmin]);

  // A decided listing no longer matches the current status tab
  const removeListing = (id) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  const handleApprove = async (listing) => {
    setActionLoading(`approve-${listing.id}`);
    try {
      await api.approve(listing.id);
      removeListing(listing.id);
      toast.success("Listing approved and is now live!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve listing.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async (reason) => {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setActionLoading(`reject-${id}`);
    try {
      await api.reject(id, reason);
      removeListing(id);
      toast.success("Listing rejected. The owner has been notified.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject listing.");
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
    }
  };

  const handleAssignDistrict = async (listing, districtId) => {
    setActionLoading(`district-${listing.id}`);
    try {
      const { data } = await api.moveDistrict(listing.id, districtId);
      const updated = toCard(data.data);
      if (districtFilter && districtFilter !== districtId) removeListing(listing.id);
      else setListings((prev) => prev.map((l) => (l.id === listing.id ? updated : l)));
      toast.success(`Moved to ${updated.district?.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change district.");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = listings.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title?.toLowerCase().includes(q) ||
      l.location?.toLowerCase().includes(q) ||
      l.submitter?.toLowerCase().includes(q) ||
      l.contact?.toLowerCase().includes(q) ||
      l.specs.some((spec) => spec.text.toLowerCase().includes(q))
    );
  });

  const statusLabel = STATUS_TABS.find((t) => t.value === status).label.toLowerCase();

  const tabClass = (active) =>
    cn(
      "px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors",
      active ? "bg-[#A3078F] text-white shadow-sm" : "text-[#6B6B6A] hover:text-[#0F0C11] hover:bg-white"
    );

  const filterBar = (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <div className="flex gap-1 p-1 bg-[#EBEBEA]/60 rounded-xl">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => setFilter("status", t.value, "PENDING")} className={tabClass(t.value === status)}>
            {t.label}
          </button>
        ))}
      </div>
      {isSuperAdmin && (
        <select
          value={districtFilter}
          onChange={(e) => setFilter("district", e.target.value, "")}
          className="ml-auto px-3 py-2 bg-white border border-[#E8E7E5] rounded-lg text-sm text-[#0F0C11] focus:outline-none focus:ring-2 focus:ring-[#A3078F]/20 focus:border-[#A3078F]"
        >
          <option value="">All districts</option>
          {/* keepId: the filter may point at an inactive district */}
          <DistrictOptions districts={districts || []} keepId={districtFilter} />
        </select>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F3] px-6 py-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[#0F0C11] tracking-tight">Review Queue</h1>
              {!loading && total > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200/60">
                  {total} {statusLabel}
                </span>
              )}
              {!isSuperAdmin && session?.district && (
                <span className="flex items-center gap-1 text-xs font-semibold text-[#7A0A74] bg-[#FAF1F9] border border-[#EBC9E6] px-2.5 py-1 rounded-full">
                  <Landmark className="w-3 h-3" /> {session.district.name}
                </span>
              )}
            </div>
            <p className="text-sm text-[#9B9B99]">
              {isSuperAdmin
                ? "Approve or reject listings from every district."
                : `Approve or reject listings submitted in ${session?.district?.name || "your district"}.`}
            </p>
          </div>
          <button
            onClick={fetchListings}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6B6B6A] bg-white border border-[#E8E7E5] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] active:scale-[0.97] transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {filterBar}

        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white border border-[#E8E7E5] rounded-2xl overflow-hidden animate-pulse">
                <div className="h-52 bg-[#F5F5F3]" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-2/3 bg-[#EBEBEA] rounded" />
                  <div className="h-4 w-1/2 bg-[#EBEBEA] rounded" />
                  <div className="h-10 bg-[#EBEBEA] rounded-xl mt-4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {!loading && listings.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9B99]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by khata, district, owner or mobile…"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E8E7E5] rounded-xl text-sm text-[#0F0C11] focus:outline-none focus:ring-2 focus:ring-[#A3078F]/20 focus:border-[#A3078F] transition-all"
            />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {searchQuery ? <Search className="w-7 h-7 text-emerald-500" /> : <Check className="w-7 h-7 text-emerald-500" />}
            </div>
            <h3 className="font-semibold text-[#0F0C11] mb-1">
              {searchQuery ? "No results found" : status === "PENDING" ? "All clear!" : "Nothing here"}
            </h3>
            <p className="text-sm text-[#9B9B99]">
              {searchQuery
                ? `No listings match "${searchQuery}"`
                : status === "PENDING"
                  ? "No listings waiting for review right now."
                  : `No ${statusLabel} listings.`}
            </p>
          </div>
        )}

        {/* Cards */}
        {!loading && (
          <AnimatePresence>
            <div className="space-y-5">
              {filtered.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onApprove={handleApprove}
                  onReject={setRejectTarget}
                  actionLoading={actionLoading}
                  districts={isSuperAdmin ? districts || [] : null}
                  onAssignDistrict={handleAssignDistrict}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#6B6B6A] bg-white border border-[#E8E7E5] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-[#6B6B6A] tabular-nums">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#6B6B6A] bg-white border border-[#E8E7E5] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Reject modal */}
        {rejectTarget && (
          <RejectModal
            listing={rejectTarget}
            onClose={() => setRejectTarget(null)}
            onConfirm={handleRejectConfirm}
            loading={actionLoading === `reject-${rejectTarget.id}`}
          />
        )}
      </div>
    </div>
  );
};

export default PendingListings;
