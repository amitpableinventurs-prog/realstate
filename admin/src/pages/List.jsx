import { useState, useEffect } from "react";
import {
  Trash2, Edit3, Search, Plus, Home, BedDouble, Bath,
  Maximize, MapPin, Grid3X3, List as ListIcon, RefreshCw,
  Building2, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import { cn, formatPrice } from "../lib/utils";

const PROPERTY_TYPES = ["all", "House", "Apartment", "Office", "Villa"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
];

// Review status of a website property. Only "active" (Live) is shown on the website.
const STATUS = {
  active: { label: "Live", className: "bg-emerald-500 text-white" },
  pending: { label: "Pending", className: "bg-amber-400 text-[#17131A]" },
  rejected: { label: "Disapproved", className: "bg-red-500 text-white" },
  expired: { label: "Expired", className: "bg-[#6B7280] text-white" },
};
const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Live" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Disapproved" },
];
const statusOf = (property) => property.status || "active";
const canApprove = (property) => ["pending", "rejected"].includes(statusOf(property));
const canDisapprove = (property) => ["pending", "active"].includes(statusOf(property));

const StatusBadge = ({ property }) => {
  const s = STATUS[statusOf(property)] || STATUS.active;
  return <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full", s.className)}>{s.label}</span>;
};

// Approve / Disapprove buttons — `busy` is the action in progress for this card
const ReviewButtons = ({ property, onApprove, onDisapprove, busy, compact = false }) => {
  if (!canApprove(property) && !canDisapprove(property)) return null;
  const size = compact ? "px-2.5 py-1.5 text-xs" : "flex-1 py-2 text-sm";
  return (
    <div className={cn("flex gap-2", !compact && "mt-3")}>
      {canApprove(property) && (
        <button
          onClick={() => onApprove(property)}
          disabled={!!busy}
          className={cn(size, "flex items-center justify-center gap-1.5 rounded-lg font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 transition-colors")}
        >
          <Check className="w-4 h-4" /> {busy === "approve" ? "Approving…" : "Approve"}
        </button>
      )}
      {canDisapprove(property) && (
        <button
          onClick={() => onDisapprove(property)}
          disabled={!!busy}
          className={cn(size, "flex items-center justify-center gap-1.5 rounded-lg font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors")}
        >
          <X className="w-4 h-4" /> Disapprove
        </button>
      )}
    </div>
  );
};

// Asks for the reason, which is emailed to the owner (user-submitted listings)
const DisapproveModal = ({ property, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form
        onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onConfirm(reason.trim()); }}
        className="relative bg-white rounded-2xl border border-[#E6D6E8] shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div>
          <h3 className="font-bold text-[#17131A]">Disapprove property</h3>
          <p className="text-xs text-[#9CA3AF] mt-0.5 line-clamp-1">{property.title}</p>
        </div>
        <div>
          <label htmlFor="disapprove-reason" className="block text-sm font-semibold text-[#17131A] mb-1.5">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            id="disapprove-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            autoFocus
            placeholder="e.g. Photos are unclear, price missing, wrong location…"
            className="w-full border border-[#E6D6E8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A3078F] focus:ring-2 focus:ring-[#A3078F]/15 resize-none"
          />
          <p className="text-xs text-[#9CA3AF] mt-1">
            The property is hidden from the website. {property.postedBy ? "The owner is emailed this reason." : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-[#5A5856] border border-[#E6D6E8] rounded-xl hover:bg-[#FAF8FB]">
            Cancel
          </button>
          <button type="submit" disabled={loading || !reason.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-50">
            {loading ? "Disapproving…" : "Disapprove"}
          </button>
        </div>
      </form>
    </div>
  );
};

const parseAmenities = (amenities) => {
  if (!amenities || !Array.isArray(amenities)) return [];
  try {
    return typeof amenities[0] === "string"
      ? JSON.parse(amenities[0].replace(/'/g, '"'))
      : amenities;
  } catch {
    return [];
  }
};

// ─── Property Grid Card ───────────────────────────────────────────────────────
const PropertyGridCard = ({ property, onRemove, onApprove, onDisapprove, busy }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.96 }}
    whileHover={{ y: -3 }}
    transition={{ duration: 0.25 }}
    className="bg-white rounded-2xl border border-[#E6D6E8] shadow-card hover:shadow-card-hover overflow-hidden group transition-shadow duration-300"
  >
    {/* Image */}
    <div className="relative h-48 overflow-hidden bg-[#F5F0F6]">
      {property.image?.[0] ? (
        <img src={property.image[0]} alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Building2 className="w-12 h-12 text-[#E6D6E8]" />
        </div>
      )}
      {/* Badges */}
      <div className="absolute top-3 left-3 flex gap-1.5">
        <span className="px-2.5 py-1 bg-[#17131A]/80 backdrop-blur-sm text-[#FAF8FB] text-xs font-semibold rounded-full">
          {property.type}
        </span>
        <span className={cn(
          "px-2.5 py-1 text-xs font-semibold rounded-full backdrop-blur-sm",
          property.availability === "rent"
            ? "bg-blue-600/80 text-white"
            : "bg-[#A3078F]/80 text-white"
        )}>
          {property.availability === "rent" ? "For Rent" : "For Sale"}
        </span>
      </div>
      <div className="absolute top-3 right-3">
        <StatusBadge property={property} />
      </div>
    </div>

    {/* Content */}
    <div className="p-4">
      <h3 className="font-bold text-[#17131A] text-base mb-1 line-clamp-1">{property.title}</h3>
      <div className="flex items-center gap-1 text-[#9CA3AF] text-xs mb-3">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="line-clamp-1">{property.location}</span>
      </div>

      {/* Specs */}
      <div className="flex items-center gap-3 text-xs text-[#5A5856] mb-4">
        <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-[#A3078F]" />{property.beds} Beds</span>
        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-[#A3078F]" />{property.baths} Baths</span>
        <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5 text-[#A3078F]" />{property.sqft} sqft</span>
      </div>

      {/* Price + Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-[#F5F0F6]">
        <div>
          <span className="text-lg font-bold text-[#A3078F]">{formatPrice(property.price)}</span>
          {property.availability === "rent" && <span className="text-xs text-[#9CA3AF] ml-1">/mo</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Link to={`/update/${property._id}`}>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="p-2 bg-[#FAF8FB] border border-[#E6D6E8] text-[#5A5856] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] transition-all duration-200">
              <Edit3 className="w-4 h-4" />
            </motion.button>
          </Link>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => onRemove(property._id, property.title)}
            className="p-2 bg-[#FAF8FB] border border-[#E6D6E8] text-[#5A5856] rounded-lg hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200">
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {statusOf(property) === "rejected" && property.rejectionReason && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 line-clamp-2">
          <span className="font-semibold">Reason:</span> {property.rejectionReason}
        </p>
      )}
      <ReviewButtons property={property} onApprove={onApprove} onDisapprove={onDisapprove} busy={busy} />
    </div>
  </motion.div>
);

// ─── Property List Row ────────────────────────────────────────────────────────
const PropertyListRow = ({ property, onRemove, onApprove, onDisapprove, busy }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -10 }}
    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[#E6D6E8] hover:border-[#A3078F]/30 hover:shadow-card transition-all duration-200"
  >
    {/* Thumbnail */}
    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F5F0F6] flex-shrink-0">
      {property.image?.[0] ? (
        <img src={property.image[0]} alt={property.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Building2 className="w-6 h-6 text-[#E6D6E8]" />
        </div>
      )}
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="font-semibold text-[#17131A] text-sm truncate">{property.title}</h3>
        <span className="px-2 py-0.5 bg-[#17131A] text-[#FAF8FB] text-xs rounded-full flex-shrink-0">{property.type}</span>
        <StatusBadge property={property} />
      </div>
      <div className="flex items-center gap-1 text-xs text-[#9CA3AF]">
        <MapPin className="w-3 h-3" />
        <span className="truncate">{property.location}</span>
      </div>
    </div>

    {/* Specs */}
    <div className="hidden md:flex items-center gap-4 text-xs text-[#5A5856]">
      <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-[#A3078F]" />{property.beds}</span>
      <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-[#A3078F]" />{property.baths}</span>
      <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5 text-[#A3078F]" />{property.sqft}</span>
    </div>

    {/* Price */}
    <div className="text-right flex-shrink-0">
      <div className="font-bold text-[#A3078F] text-sm">{formatPrice(property.price)}</div>
      <div className={cn(
        "text-xs font-medium mt-0.5",
        property.availability === "rent" ? "text-blue-600" : "text-emerald-600"
      )}>
        {property.availability === "rent" ? "For Rent" : "For Sale"}
      </div>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <ReviewButtons property={property} onApprove={onApprove} onDisapprove={onDisapprove} busy={busy} compact />
      <Link to={`/update/${property._id}`}>
        <button className="p-2 text-[#5A5856] hover:text-[#A3078F] hover:bg-[#A3078F]/10 rounded-lg transition-all duration-200">
          <Edit3 className="w-4 h-4" />
        </button>
      </Link>
      <button onClick={() => onRemove(property._id, property.title)}
        className="p-2 text-[#5A5856] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const PropertyListings = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState({}); // { [propertyId]: "approve" | "disapprove" }
  const [disapproveTarget, setDisapproveTarget] = useState(null);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      // Every website property with its review status (live, pending, disapproved).
      // Mobile-app listings are reviewed in the Review Queue.
      const response = await apiClient.get('/api/admin/properties');
      if (response.data.success) {
        const parsed = response.data.properties.map((p) => ({
          ...p,
          amenities: parseAmenities(p.amenities),
        }));
        setProperties(parsed);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast.error("Failed to fetch properties");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProperties();
    setRefreshing(false);
    toast.success("Properties refreshed!");
  };

  const handleRemoveProperty = async (propertyId, propertyTitle) => {
    if (!window.confirm(`Remove "${propertyTitle}"? This cannot be undone.`)) return;
    try {
      const response = await apiClient.post('/api/products/remove', { id: propertyId });
      if (response.data.success) {
        toast.success("Property removed successfully");
        await fetchProperties();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error removing property:", error);
      toast.error("Failed to remove property");
    }
  };

  // Keeps the card in place with its new status (and reason)
  const replaceProperty = (updated) =>
    setProperties((prev) => prev.map((p) => (p._id === updated._id ? { ...p, ...updated, amenities: p.amenities } : p)));

  const setCardBusy = (id, action) =>
    setBusy((prev) => {
      const next = { ...prev };
      if (action) next[id] = action;
      else delete next[id];
      return next;
    });

  const handleApprove = async (property) => {
    setCardBusy(property._id, "approve");
    try {
      const { data } = await apiClient.put(`/api/admin/properties/${property._id}/approve`, {});
      replaceProperty(data.property);
      toast.success(`"${property.title}" approved — it is now live on the website`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to approve property");
    } finally {
      setCardBusy(property._id, null);
    }
  };

  const handleDisapproveConfirm = async (reason) => {
    const property = disapproveTarget;
    setCardBusy(property._id, "disapprove");
    try {
      const { data } = await apiClient.put(`/api/admin/properties/${property._id}/reject`, { reason });
      replaceProperty(data.property);
      toast.success(`"${property.title}" disapproved and hidden from the website`);
      setDisapproveTarget(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to disapprove property");
    } finally {
      setCardBusy(property._id, null);
    }
  };

  useEffect(() => { fetchProperties(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusCounts = STATUS_TABS.reduce((acc, t) => ({
    ...acc,
    [t.value]: t.value === "all" ? properties.length : properties.filter((p) => statusOf(p) === t.value).length,
  }), {});

  const filteredProperties = properties
    .filter((p) => {
      const matchesSearch = !searchTerm ||
        [p.title, p.location, p.type].some((f) => f?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType = filterType === "all" || p.type?.toLowerCase() === filterType.toLowerCase();
      const matchesStatus = statusFilter === "all" || statusOf(p) === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  if (loading) {
    return (
      <div className="min-h-screen pt-8 flex items-center justify-center bg-[#FAF8FB]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#A3078F] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#5A5856] font-medium">Loading properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-8 pb-12 px-4 bg-[#FAF8FB]">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#17131A] mb-1">Properties</h1>
            <p className="text-[#5A5856] text-sm">
              <span className="font-semibold text-[#A3078F]">{filteredProperties.length}</span> listings found
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button onClick={handleRefresh} disabled={refreshing}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E6D6E8] text-[#17131A] rounded-xl text-sm font-medium hover:border-[#A3078F] hover:text-[#A3078F] transition-all shadow-card disabled:opacity-60">
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </motion.button>
            <Link to="/add">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#A3078F] hover:bg-[#7A0A74] text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-terracotta">
                <Plus className="w-4 h-4" />
                Add Property
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Status tabs — only "Live" properties are shown on the website */}
        <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={statusFilter === t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
                statusFilter === t.value
                  ? "bg-[#A3078F] border-[#A3078F] text-white shadow-sm"
                  : "bg-white border-[#E6D6E8] text-[#5A5856] hover:border-[#A3078F] hover:text-[#A3078F]"
              )}
            >
              {t.label}
              <span className={cn(
                "min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs tabular-nums",
                statusFilter === t.value ? "bg-white/25" : t.value === "pending" && statusCounts.pending ? "bg-amber-100 text-amber-800" : "bg-[#F5F0F6]"
              )}>
                {statusCounts[t.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Filters Bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 border border-[#E6D6E8] shadow-card mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input type="text" placeholder="Search properties..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#FAF8FB] border border-[#E6D6E8] rounded-xl text-sm text-[#17131A] placeholder-[#9CA3AF] outline-none focus:border-[#A3078F] focus:ring-2 focus:ring-[#A3078F]/15 transition-all" />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1 bg-[#FAF8FB] rounded-xl p-1 flex-shrink-0">
              {PROPERTY_TYPES.map((type) => (
                <button key={type} onClick={() => setFilterType(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 capitalize",
                    filterType === type
                      ? "bg-[#17131A] text-[#FAF8FB] shadow-sm"
                      : "text-[#5A5856] hover:text-[#17131A]"
                  )}>
                  {type === "all" ? "All Types" : type}
                </button>
              ))}
            </div>

            {/* Sort + View Toggle */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2.5 bg-[#FAF8FB] border border-[#E6D6E8] rounded-xl text-xs text-[#5A5856] outline-none focus:border-[#A3078F] transition-all cursor-pointer">
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <div className="flex items-center bg-[#FAF8FB] border border-[#E6D6E8] rounded-xl p-1">
                <button onClick={() => setViewMode("grid")}
                  className={cn("p-1.5 rounded-lg transition-all", viewMode === "grid" ? "bg-[#17131A] text-white" : "text-[#9CA3AF] hover:text-[#5A5856]")}>
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode("list")}
                  className={cn("p-1.5 rounded-lg transition-all", viewMode === "list" ? "bg-[#17131A] text-white" : "text-[#9CA3AF] hover:text-[#5A5856]")}>
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Properties */}
        <AnimatePresence mode="wait">
          {filteredProperties.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-20 bg-white rounded-2xl border border-[#E6D6E8]">
              <div className="w-16 h-16 bg-[#F5F0F6] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-[#E6D6E8]" />
              </div>
              <h3 className="text-lg font-bold text-[#17131A] mb-2">No properties found</h3>
              <p className="text-sm text-[#9CA3AF] mb-6">
                {searchTerm || filterType !== "all" ? "Try adjusting your search or filters" : "Add your first property to get started"}
              </p>
              {!searchTerm && filterType === "all" && (
                <Link to="/add">
                  <button className="px-6 py-3 bg-[#A3078F] text-white rounded-xl font-semibold text-sm hover:bg-[#7A0A74] transition-colors">
                    Add First Property
                  </button>
                </Link>
              )}
            </motion.div>
          ) : viewMode === "grid" ? (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence>
                {filteredProperties.map((property) => (
                  <PropertyGridCard key={property._id} property={property} onRemove={handleRemoveProperty}
                    onApprove={handleApprove} onDisapprove={setDisapproveTarget} busy={busy[property._id]} />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-3">
              <AnimatePresence>
                {filteredProperties.map((property) => (
                  <PropertyListRow key={property._id} property={property} onRemove={handleRemoveProperty}
                    onApprove={handleApprove} onDisapprove={setDisapproveTarget} busy={busy[property._id]} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {disapproveTarget && (
          <DisapproveModal
            property={disapproveTarget}
            onClose={() => setDisapproveTarget(null)}
            onConfirm={handleDisapproveConfirm}
            loading={busy[disapproveTarget._id] === "disapprove"}
          />
        )}
      </div>
    </div>
  );
};

export default PropertyListings;