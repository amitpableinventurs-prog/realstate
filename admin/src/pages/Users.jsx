import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, Search, RefreshCw, Eye, UserCheck, UserX, AlertCircle, ChevronLeft, ChevronRight, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../services/apiClient";
import { cn, formatDate } from "../lib/utils";
import { setUserActive } from "../lib/users";
import UserStatus from "../components/UserStatus";

// Users (technical document 6.7: GET /admin/users). Users sign up with their
// mobile number on the app or website. A deactivated user is logged out
// everywhere and cannot log in until activated again.

const PAGE_SIZE = 15;

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Deactivated" },
  { value: "deleted", label: "Deleted accounts" },
];


const UsersManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchTerm.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        ...(search && { search }),
        ...(filter === "deleted" && { deleted: true }),
        ...(filter === "active" && { is_active: true }),
        ...(filter === "inactive" && { is_active: false }),
      };
      const { data } = await apiClient.get("/api/v1/admin/users", { params });
      setUsers(data.data || []);
      setMeta(data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (user) => {
    setBusyId(user.id);
    try {
      const updated = await setUserActive(user, !user.is_active);
      if (updated) setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F3] px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F0C11] tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-[#A3078F]" /> Users
            </h1>
            <p className="text-sm text-[#9B9B99] mt-0.5">{meta.total} user{meta.total === 1 ? "" : "s"} · sign-up with mobile number (app and website)</p>
          </div>
          <button onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6B6B6A] bg-white border border-[#E8E7E5] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] transition-all shadow-sm">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9B99]" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by mobile, name or email…" aria-label="Search users"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E8E7E5] rounded-xl text-sm text-[#0F0C11] focus:outline-none focus:ring-2 focus:ring-[#A3078F]/20 focus:border-[#A3078F]" />
          </div>
          <div className="flex gap-1 p-1 bg-[#EBEBEA]/60 rounded-xl">
            {FILTERS.map((f) => (
              <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
                className={cn("px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  filter === f.value ? "bg-[#A3078F] text-white shadow-sm" : "text-[#6B6B6A] hover:text-[#0F0C11] hover:bg-white")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E8E7E5]">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-[#6B6B6A]">{error}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E8E7E5] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-[#9B9B99] border-b border-[#E8E7E5] bg-[#FAFAF9]">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Properties</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && users.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-[#9B9B99]">Loading…</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-[#9B9B99]">No users found</td></tr>
                  ) : users.map((user) => (
                    <tr key={user.id} className="border-b border-[#F5F5F3] last:border-0 hover:bg-[#FAFAF9]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0F0C11]">{user.name || <span className="text-[#9B9B99] font-normal">Profile not completed</span>}</div>
                        <div className="flex items-center gap-1 text-xs text-[#6B6B6A]"><Phone className="w-3 h-3" />{user.mobile}</div>
                        {user.email && <div className="text-xs text-[#9B9B99]">{user.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-[#6B6B6A]">
                        {user.district ? (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#A3078F]" />{user.district.name}, {user.state?.name}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#0F0C11]">{user.property_count}</td>
                      <td className="px-4 py-3 text-[#6B6B6A]">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-3"><UserStatus user={user} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => navigate(`/users/${user.id}`)} title="View details"
                            className="p-2 border border-[#E8E7E5] rounded-lg text-[#6B6B6A] hover:border-[#A3078F] hover:text-[#A3078F]">
                            <Eye className="w-4 h-4" />
                          </button>
                          {!user.is_deleted && (
                            <button onClick={() => toggleActive(user)} disabled={busyId === user.id}
                              title={user.is_active ? "Deactivate" : "Activate"}
                              className={cn("p-2 border rounded-lg disabled:opacity-50",
                                user.is_active ? "border-[#E8E7E5] text-[#6B6B6A] hover:border-red-300 hover:text-red-500" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50")}>
                              {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#6B6B6A] bg-white border border-[#E8E7E5] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-[#6B6B6A] tabular-nums">Page {page} of {meta.totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#6B6B6A] bg-white border border-[#E8E7E5] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersManagement;
