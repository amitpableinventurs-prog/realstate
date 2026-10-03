import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Building2, UserCheck, UserX, Edit3 } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../services/apiClient";
import { cn, formatDate } from "../lib/utils";
import UserStatus from "../components/UserStatus";
import { setUserActive } from "../lib/users";

// One user and the properties they listed (GET /admin/users/:id/properties).

const STATUS_BADGE = {
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200/60",
  REJECTED: "bg-red-50 text-red-700 border-red-200/60",
  SOLD: "bg-[#F5F5F3] text-[#6B6B6A] border-[#E8E7E5]",
  RENTED: "bg-[#F5F5F3] text-[#6B6B6A] border-[#E8E7E5]",
  LEASED: "bg-[#F5F5F3] text-[#6B6B6A] border-[#E8E7E5]",
};
const TYPE_LABELS = { SELL: "For Sale", RENT: "For Rent", LEASE: "For Lease" };

const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [userRes, propsRes] = await Promise.all([
        apiClient.get(`/api/v1/admin/users/${id}`),
        apiClient.get(`/api/v1/admin/users/${id}/properties`, { params: { limit: 50 } }),
      ]);
      setUser(userRes.data.data);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the user");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async () => {
    setBusy(true);
    try {
      const updated = await setUserActive(user, !user.is_active);
      if (updated) setUser(updated);
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-center py-24 text-[#6B6B6A]">{error}</p>;
  if (!user) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-4 border-[#A3078F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3] px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate("/users")} className="flex items-center gap-2 text-sm text-[#6B6B6A] hover:text-[#A3078F] mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-[#E8E7E5] p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-xl font-bold text-[#0F0C11]">{user.name || "Profile not completed"}</h1>
                <UserStatus user={user} />
              </div>
              <div className="space-y-1.5 text-sm text-[#6B6B6A]">
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#A3078F]" />{user.mobile}</p>
                {user.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#A3078F]" />{user.email}</p>}
                {user.district && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#A3078F]" />{user.district.name}, {user.state?.name}</p>}
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#A3078F]" />Joined {formatDate(user.created_at)}</p>
              </div>
            </div>
            {!user.is_deleted && (
              <button onClick={toggleActive} disabled={busy}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60",
                  user.is_active ? "border border-red-200 text-red-600 hover:bg-red-50" : "bg-emerald-500 text-white hover:bg-emerald-600")}>
                {user.is_active ? <><UserX className="w-4 h-4" /> Deactivate</> : <><UserCheck className="w-4 h-4" /> Activate</>}
              </button>
            )}
          </div>
        </motion.div>

        <h2 className="text-base font-semibold text-[#0F0C11] mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#A3078F]" /> Properties ({user.property_count})
        </h2>
        {properties.length === 0 ? (
          <p className="text-sm text-[#9B9B99] bg-white border border-[#E8E7E5] rounded-2xl p-8 text-center">No properties listed yet</p>
        ) : (
          <div className="space-y-3">
            {properties.map((p) => (
              <div key={p.id} className={cn("flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-[#E8E7E5]", p.is_deleted && "opacity-60")}>
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#F5F5F3] flex-shrink-0">
                  {p.thumbnail_url
                    ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Building2 className="w-5 h-5 text-[#CCCCC9]" /></div>}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-[#0F0C11]">{p.title}</span>
                    <span className={cn("text-xs font-medium border px-2 py-0.5 rounded-full", STATUS_BADGE[p.status])}>{p.status}</span>
                    {p.is_deleted && <span className="text-xs text-red-600">Deleted</span>}
                  </div>
                  <p className="text-xs text-[#9B9B99] mt-0.5">
                    {TYPE_LABELS[p.listing_type]} · Khata {p.khata_number} · Khasra {p.khasra_number} · {formatDate(p.created_at)}
                  </p>
                  {p.status === "REJECTED" && p.rejection_reason && (
                    <p className="text-xs text-red-700 mt-1">Reason: {p.rejection_reason}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-[#A3078F]">{p.price?.label}</div>
                  {!p.is_deleted && (
                    <Link to={`/update/${p.id}`} className="inline-flex items-center gap-1 text-xs text-[#6B6B6A] hover:text-[#A3078F] mt-1">
                      <Edit3 className="w-3 h-3" /> Edit
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetails;
