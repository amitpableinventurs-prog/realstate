import { useState, useEffect, useCallback } from "react";
import {
  Trash2, Edit3, Search, Plus, Home, Maximize, MapPin, Grid3X3, List as ListIcon,
  RefreshCw, Building2, Check, X, Phone, ChevronLeft, ChevronRight, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import { cn } from "../lib/utils";

// All Properties — every listing (mobile app, website form, admin), with the same
// fields as the mobile screen: Khata, Khasra, Area, Price per Kattha/Dismil,
// Photos, Description, Location, Sale/Rent/Lease. Only "Live" ones are public.

const PAGE_SIZE = 20;

const STATUS = {
  active: { label: "Live", className: "bg-emerald-500 text-white" },
  pending: { label: "Pending", className: "bg-amber-400 text-[#17131A]" },
  rejected: { label: "Disapproved", className: "bg-red-500 text-white" },
  inactive: { label: "Hidden by owner", className: "bg-[#6B7280] text-white" },
};
const STATUS_TABS = [
  { value: "", label: "All", countKey: "all" },
  { value: "active", label: "Live", countKey: "active" },
  { value: "pending", label: "Pending", countKey: "pending" },
  { value: "rejected", label: "Disapproved", countKey: "rejected" },
];
const PROPERTY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "land", label: "Land" },
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "commercial", label: "Commercial" },
];
const LISTING_TYPE_BADGE = {
  sell: { label: "For Sale", className: "bg-[#A3078F]/85 text-white" },
  rent: { label: "For Rent", className: "bg-blue-600/85 text-white" },
  lease: { label: "For Lease", className: "bg-teal-600/85 text-white" },
};
const SOURCE_LABEL = { app: "App", website: "Website", admin: "Admin" };

const canApprove = (l) => l.status === "pending" || l.status === "rejected";
const canDisapprove = (l) => l.status === "pending" || l.status === "active";

const StatusBadge = ({ listing }) => {
  const s = STATUS[listing.status] || STATUS.pending;
  return <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full", s.className)}>{s.label}</span>;
};

const ReviewButtons = ({ listing, onApprove, onDisapprove, busy, compact = false }) => {
  if (!canApprove(listing) && !canDisapprove(listing)) return null;
  const size = compact ? "px-2.5 py-1.5 text-xs" : "flex-1 py-2 text-sm";
  return (
    <div className={cn("flex gap-2", !compact && "mt-3")}>
      {canApprove(listing) && (
        <button onClick={() => onApprove(listing)} disabled={!!busy}
          className={cn(size, "flex items-center justify-center gap-1.5 rounded-lg font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 transition-colors")}>
          <Check className="w-4 h-4" /> {busy === "approve" ? "Approving…" : "Approve"}
        </button>
      )}
      {canDisapprove(listing) && (
        <button onClick={() => onDisapprove(listing)} disabled={!!busy}
          className={cn(size, "flex items-center justify-center gap-1.5 rounded-lg font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors")}>
          <X className="w-4 h-4" /> Disapprove
        </button>
      )}
    </div>
  );
};

// Reason is required; the owner sees it in their listings (and by email for website users)
const DisapproveModal = ({ listing, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onConfirm(reason.trim()); }}
        className="relative bg-white rounded-2xl border border-[#E6D6E8] shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="font-bold text-[#17131A]">Disapprove property</h3>
          <p className="text-xs text-[#9CA3AF] mt-0.5 line-clamp-1">{listing.title}</p>
        </div>
        <div>
          <label htmlFor="disapprove-reason" className="block text-sm font-semibold text-[#17131A] mb-1.5">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea id="disapprove-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} autoFocus
            placeholder="e.g. Khasra number does not match, photos unclear…"
            className="w-full border border-[#E6D6E8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A3078F] focus:ring-2 focus:ring-[#A3078F]/15 resize-none" />
          <p className="text-xs text-[#9CA3AF] mt-1">The property is hidden from the website and app; the owner sees this reason.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-[#5A5856] border border-[#E6D6E8] rounded-xl hover:bg-[#FAF8FB]">Cancel</button>
          <button type="submit" disabled={loading || !reason.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-50">
            {loading ? "Disapproving…" : "Disapprove"}
          </button>
        </div>
      </form>
    </div>
  );
};

const placeOf = (l) => [l.address, l.district?.name, l.district?.state].filter(Boolean).join(", ") || "—";

const ActionIcons = ({ listing, onDelete }) => (
  <div className="flex items-center gap-1.5">
    <Link to={`/update/${listing.id}`} title="Edit"
      className="p-2 bg-[#FAF8FB] border border-[#E6D6E8] text-[#5A5856] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] transition-all">
      <Edit3 className="w-4 h-4" />
    </Link>
    <button onClick={() => onDelete(listing)} title="Delete"
      className="p-2 bg-[#FAF8FB] border border-[#E6D6E8] text-[#5A5856] rounded-lg hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all">
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

// ─── Grid card ────────────────────────────────────────────────────────────────
const ListingGridCard = ({ listing, onApprove, onDisapprove, onDelete, busy }) => {
  const typeBadge = LISTING_TYPE_BADGE[listing.listingType];
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      className="bg-white rounded-2xl border border-[#E6D6E8] shadow-card hover:shadow-card-hover overflow-hidden group transition-shadow">
      <div className="relative h-48 overflow-hidden bg-[#F5F0F6]">
        {listing.coverImage ? (
          <img src={listing.coverImage} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Building2 className="w-12 h-12 text-[#E6D6E8]" /></div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {typeBadge && <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full", typeBadge.className)}>{typeBadge.label}</span>}
          <span className="px-2.5 py-1 bg-[#17131A]/80 text-[#FAF8FB] text-xs font-semibold rounded-full capitalize">{listing.propertyType}</span>
        </div>
        <div className="absolute top-3 right-3"><StatusBadge listing={listing} /></div>
        {listing.mediaCount > 1 && (
          <span className="absolute bottom-3 right-3 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full">{listing.mediaCount} photos</span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-[#17131A] text-base mb-1 line-clamp-1">{listing.title}</h3>
        <div className="flex items-center gap-1 text-[#9CA3AF] text-xs mb-3">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="line-clamp-1">{placeOf(listing)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5A5856] mb-3">
          <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5 text-[#A3078F]" />{listing.area?.label}</span>
          {listing.khataNo && <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-[#A3078F]" />Khata {listing.khataNo}</span>}
          {listing.khasraNo && <span>Khasra {listing.khasraNo}</span>}
        </div>

        <div className="flex items-end justify-between gap-2 pt-3 border-t border-[#F5F0F6]">
          <div className="min-w-0">
            <div className="text-lg font-bold text-[#A3078F] leading-tight">{listing.priceLabel}</div>
            {listing.unitPriceLabel && <div className="text-xs text-[#9CA3AF]">{listing.unitPriceLabel}</div>}
          </div>
          <ActionIcons listing={listing} onDelete={onDelete} />
        </div>

        <div className="flex items-center justify-between text-xs text-[#9CA3AF] mt-2">
          <span className="flex items-center gap-1 truncate"><Phone className="w-3 h-3" />{listing.owner?.name ? `${listing.owner.name} · ` : ""}{listing.contactPhone}</span>
          <span className="flex-shrink-0">{SOURCE_LABEL[listing.postedFrom] || "App"}</span>
        </div>

        {listing.status === "rejected" && listing.rejectionReason && (
          <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 line-clamp-2">
            <span className="font-semibold">Reason:</span> {listing.rejectionReason}
          </p>
        )}
        <ReviewButtons listing={listing} onApprove={onApprove} onDisapprove={onDisapprove} busy={busy} />
      </div>
    </motion.div>
  );
};

// ─── List row ─────────────────────────────────────────────────────────────────
const ListingRow = ({ listing, onApprove, onDisapprove, onDelete, busy }) => (
  <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
    className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-[#E6D6E8] hover:border-[#A3078F]/30 hover:shadow-card transition-all">
    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F5F0F6] flex-shrink-0">
      {listing.coverImage
        ? <img src={listing.coverImage} alt={listing.title} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center"><Building2 className="w-6 h-6 text-[#E6D6E8]" /></div>}
    </div>
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="font-semibold text-[#17131A] text-sm truncate">{listing.title}</h3>
        <StatusBadge listing={listing} />
      </div>
      <div className="text-xs text-[#9CA3AF] truncate">
        {placeOf(listing)} · {listing.area?.label}{listing.khataNo ? ` · Khata ${listing.khataNo}` : ""}{listing.khasraNo ? ` · Khasra ${listing.khasraNo}` : ""}
      </div>
    </div>
    <div className="text-right flex-shrink-0">
      <div className="font-bold text-[#A3078F] text-sm">{listing.priceLabel}</div>
      <div className="text-xs text-[#9CA3AF]">{listing.unitPriceLabel || listing.typeLabel}</div>
    </div>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <ReviewButtons listing={listing} onApprove={onApprove} onDisapprove={onDisapprove} busy={busy} compact />
      <ActionIcons listing={listing} onDelete={onDelete} />
    </div>
  </motion.div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const PropertyListings = () => {
  const [listings, setListings] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [busy, setBusy] = useState({}); // { [id]: "approve" | "disapprove" }
  const [disapproveTarget, setDisapproveTarget] = useState(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/api/v1/app/admin/listings", {
        params: { page, limit: PAGE_SIZE, ...(status && { status }) },
      });
      setListings(data.data || []);
      setCounts(data.counts || {});
      setTotalPages(Math.max(1, data.pagination?.totalPages || 1));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch properties");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const setCardBusy = (id, action) => setBusy((prev) => {
    const next = { ...prev };
    if (action) next[id] = action;
    else delete next[id];
    return next;
  });

  // After a decision the card changes tab, so reload the page and counts
  const decide = async (listing, body, success) => {
    setCardBusy(listing.id, body.status === "active" ? "approve" : "disapprove");
    try {
      await apiClient.patch(`/api/v1/app/admin/listings/${listing.id}`, body);
      toast.success(success);
      setDisapproveTarget(null);
      await fetchListings();
    } catch (error) {
      toast.error(error.response?.data?.message || "Action failed");
    } finally {
      setCardBusy(listing.id, null);
    }
  };

  const handleApprove = (listing) =>
    decide(listing, { status: "active" }, `"${listing.title}" approved — now live on the website and app`);

  const handleDisapprove = (reason) =>
    decide(disapproveTarget, { status: "rejected", rejectionReason: reason }, `"${disapproveTarget.title}" disapproved and hidden`);

  const handleDelete = async (listing) => {
    if (!window.confirm(`Delete "${listing.title}"? Its photos are deleted too. This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/admin/listings/${listing.id}`);
      toast.success("Property deleted");
      await fetchListings();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete property");
    }
  };

  const q = searchTerm.trim().toLowerCase();
  const visible = listings.filter((l) =>
    (filterType === "all" || l.propertyType === filterType) &&
    (!q || [l.title, l.description, l.khataNo, l.khasraNo, l.address, l.district?.name, l.contactPhone]
      .some((f) => f?.toLowerCase().includes(q)))
  );

  const cardProps = (l) => ({
    listing: l, onApprove: handleApprove, onDisapprove: setDisapproveTarget, onDelete: handleDelete, busy: busy[l.id],
  });

  return (
    <div className="min-h-screen pt-8 pb-12 px-4 bg-[#FAF8FB]">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#17131A] mb-1">Properties</h1>
            <p className="text-[#5A5856] text-sm">
              <span className="font-semibold text-[#A3078F]">{counts.all ?? 0}</span> listings from the app, website and admin
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchListings} disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E6D6E8] text-[#17131A] rounded-xl text-sm font-medium hover:border-[#A3078F] hover:text-[#A3078F] transition-all shadow-card disabled:opacity-60">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link to="/add"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#A3078F] hover:bg-[#7A0A74] text-white rounded-xl text-sm font-semibold transition-all shadow-lg">
              <Plus className="w-4 h-4" /> Add Property
            </Link>
          </div>
        </motion.div>

        {/* Status tabs — only "Live" listings are shown publicly */}
        <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((t) => (
            <button key={t.countKey} role="tab" aria-selected={status === t.value}
              onClick={() => { setStatus(t.value); setPage(1); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
                status === t.value ? "bg-[#A3078F] border-[#A3078F] text-white shadow-sm" : "bg-white border-[#E6D6E8] text-[#5A5856] hover:border-[#A3078F] hover:text-[#A3078F]"
              )}>
              {t.label}
              <span className={cn(
                "min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs tabular-nums",
                status === t.value ? "bg-white/25" : t.countKey === "pending" && counts.pending ? "bg-amber-100 text-amber-800" : "bg-[#F5F0F6]"
              )}>
                {counts[t.countKey] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 border border-[#E6D6E8] shadow-card mb-6">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input type="text" placeholder="Search title, khata, khasra, district, phone…" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search properties"
                className="w-full pl-9 pr-4 py-2.5 bg-[#FAF8FB] border border-[#E6D6E8] rounded-xl text-sm text-[#17131A] placeholder-[#9CA3AF] outline-none focus:border-[#A3078F] focus:ring-2 focus:ring-[#A3078F]/15" />
            </div>
            <div className="flex flex-wrap items-center gap-1 bg-[#FAF8FB] rounded-xl p-1">
              {PROPERTY_TYPES.map((t) => (
                <button key={t.value} onClick={() => setFilterType(t.value)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    filterType === t.value ? "bg-[#17131A] text-[#FAF8FB] shadow-sm" : "text-[#5A5856] hover:text-[#17131A]")}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center bg-[#FAF8FB] border border-[#E6D6E8] rounded-xl p-1">
              <button onClick={() => setViewMode("grid")} aria-label="Grid view"
                className={cn("p-1.5 rounded-lg transition-all", viewMode === "grid" ? "bg-[#17131A] text-white" : "text-[#9CA3AF] hover:text-[#5A5856]")}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} aria-label="List view"
                className={cn("p-1.5 rounded-lg transition-all", viewMode === "list" ? "bg-[#17131A] text-white" : "text-[#9CA3AF] hover:text-[#5A5856]")}>
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Listings */}
        {loading && listings.length === 0 ? (
          <div className="flex justify-center py-24">
            <div className="w-12 h-12 border-4 border-[#A3078F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#E6D6E8]">
            <div className="w-16 h-16 bg-[#F5F0F6] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Home className="w-8 h-8 text-[#E6D6E8]" />
            </div>
            <h3 className="text-lg font-bold text-[#17131A] mb-2">No properties found</h3>
            <p className="text-sm text-[#9CA3AF] mb-6">
              {searchTerm || filterType !== "all" || status ? "Try another tab or filter" : "Add the first property, or wait for listings from the app and website"}
            </p>
            {!searchTerm && filterType === "all" && !status && (
              <Link to="/add" className="inline-block px-6 py-3 bg-[#A3078F] text-white rounded-xl font-semibold text-sm hover:bg-[#7A0A74] transition-colors">
                Add Property
              </Link>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence>
              {visible.map((l) => <ListingGridCard key={l.id} {...cardProps(l)} />)}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {visible.map((l) => <ListingRow key={l.id} {...cardProps(l)} />)}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#5A5856] bg-white border border-[#E6D6E8] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-[#5A5856] tabular-nums">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#5A5856] bg-white border border-[#E6D6E8] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {disapproveTarget && (
          <DisapproveModal listing={disapproveTarget} onClose={() => setDisapproveTarget(null)}
            onConfirm={handleDisapprove} loading={busy[disapproveTarget.id] === "disapprove"} />
        )}
      </div>
    </div>
  );
};

export default PropertyListings;
