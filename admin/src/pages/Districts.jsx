import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  MapPin, Plus, Pencil, Trash2, Check, X, RefreshCw, UserPlus, KeyRound, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "../services/apiClient";
import { cn, formatDate } from "../lib/utils";
import DistrictOptions from "../components/DistrictOptions";
import { fetchDistricts } from "../lib/districts";

const inputClass =
  "w-full px-3 py-2 bg-white border border-[#E8E7E5] rounded-lg text-sm text-[#0F0C11] focus:outline-none focus:ring-2 focus:ring-[#A3078F]/20 focus:border-[#A3078F] transition-all";
const primaryButton =
  "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#A3078F] hover:bg-[#7A0A74] rounded-lg transition-colors disabled:opacity-50";
const iconButton =
  "p-1.5 rounded-md text-[#6B6B6A] hover:text-[#A3078F] hover:bg-[#F5F5F3] transition-colors disabled:opacity-40";

const errorMessage = (err, fallback) => err.response?.data?.message || fallback;

const StatusToggle = ({ active, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => onChange(!active)}
    disabled={disabled}
    className={cn(
      "text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50",
      active
        ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
        : "text-[#6B6B6A] bg-[#F5F5F3] border-[#E8E7E5] hover:bg-[#EBEBEA]"
    )}
    title={active ? "Click to deactivate" : "Click to activate"}
  >
    {active ? "Active" : "Inactive"}
  </button>
);

// ─── Districts ────────────────────────────────────────────────────────────────
const DistrictsSection = ({ districts, states, onChanged }) => {
  const [newName, setNewName] = useState("");
  const [newState, setNewState] = useState("");
  const [editing, setEditing] = useState(null); // { id, name, stateId }
  const [busy, setBusy] = useState(null);
  const [stateFilter, setStateFilter] = useState("");
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const visible = districts.filter(
    (d) => (!stateFilter || d.stateId === stateFilter) && (!q || d.name.toLowerCase().includes(q))
  );

  const run = async (key, request, success) => {
    setBusy(key);
    try {
      await request();
      if (success) toast.success(success);
      await onChanged();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, "Something went wrong"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addDistrict = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !newState) return;
    const stateName = states.find((st) => st.id === newState)?.name;
    const ok = await run("add", () => apiClient.post("/api/v1/admin/districts", { name, state_id: newState }), `District "${name}, ${stateName}" added`);
    if (ok) setNewName("");
  };

  const saveRename = async () => {
    const name = editing.name.trim();
    if (!name || !editing.stateId) return;
    const ok = await run(`rename-${editing.id}`, () => apiClient.put(`/api/v1/admin/districts/${editing.id}`, { name, state_id: editing.stateId }), "District updated");
    if (ok) setEditing(null);
  };

  const remove = (district) => {
    if (!window.confirm(`Delete district "${district.name}"?`)) return;
    run(`delete-${district.id}`, () => apiClient.delete(`/api/v1/admin/districts/${district.id}`), "District deleted");
  };

  return (
    <section className="bg-white border border-[#E8E7E5] rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-[#F0EFED]">
        <h2 className="font-semibold text-[#0F0C11]">Districts</h2>
        <p className="text-xs text-[#9B9B99] mt-0.5">
          Users pick one of the active districts when listing a property. Inactive districts are hidden from the form.
        </p>
      </div>

      <form onSubmit={addDistrict} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] px-5 py-4 border-b border-[#F0EFED]">
        <select value={newState} onChange={(e) => setNewState(e.target.value)} aria-label="State" className={inputClass}>
          <option value="">Select state…</option>
          {states.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New district, e.g. Patna"
          maxLength={80}
          aria-label="District name"
          className={inputClass}
        />
        <button type="submit" disabled={!newName.trim() || !newState || busy === "add"} className={cn(primaryButton, "shrink-0")}>
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[#F0EFED]">
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={cn(inputClass, "w-auto")} aria-label="Filter by state">
          <option value="">All states</option>
          {states.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search district…"
          aria-label="Search district"
          className={cn(inputClass, "w-auto flex-1 min-w-[160px]")}
        />
        <span className="text-xs text-[#9B9B99] tabular-nums">{visible.length} of {districts.length}</span>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center text-[#9B9B99]">
          {districts.length === 0 ? "No districts yet. Add the first one above, or run npm run seed:districts in the backend." : "No districts match the filter."}
        </p>
      ) : (
        <div className="overflow-auto max-h-[560px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-[1]">
              <tr className="text-left text-xs uppercase tracking-wider text-[#9B9B99]">
                <th className="px-5 py-3 font-medium">District</th>
                <th className="px-3 py-3 font-medium">State</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Pending</th>
                <th className="px-3 py-3 font-medium text-right">Admins</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.id} className="border-t border-[#F0EFED]">
                  {editing?.id === d.id ? (
                    <td className="px-5 py-2.5" colSpan={2}>
                      <div className="flex items-center gap-1">
                        <input
                          value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          maxLength={80}
                          aria-label="District name"
                          className={cn(inputClass, "py-1")}
                          autoFocus
                        />
                        <select
                          value={editing.stateId}
                          onChange={(e) => setEditing({ ...editing, stateId: e.target.value })}
                          aria-label="State"
                          className={cn(inputClass, "py-1")}
                        >
                          {states.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                        </select>
                        <button onClick={saveRename} className={iconButton} title="Save" disabled={!!busy}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditing(null)} className={iconButton} title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-5 py-2.5 font-medium text-[#0F0C11]">{d.name}</td>
                      <td className="px-3 py-2.5 text-[#6B6B6A]">{d.state}</td>
                    </>
                  )}
                  <td className="px-3 py-2.5">
                    <StatusToggle
                      active={d.isActive}
                      disabled={!!busy}
                      onChange={(isActive) =>
                        run(`status-${d.id}`, () => apiClient.put(`/api/v1/admin/districts/${d.id}`, { is_active: isActive }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {d.pending > 0 ? (
                      <Link to={`/pending-listings?district=${d.id}`} className="font-semibold text-amber-700 hover:underline">
                        {d.pending}
                      </Link>
                    ) : (
                      <span className="text-[#9B9B99]">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#6B6B6A]">{d.admins}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing({ id: d.id, name: d.name, stateId: d.stateId })} className={iconButton} title="Edit name / state">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(d)}
                        className={cn(iconButton, "hover:text-red-600")}
                        title="Delete (only when no property, user or admin uses it)"
                        disabled={!!busy}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ─── States ───────────────────────────────────────────────────────────────────
const StatesSection = ({ states, onChanged }) => {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(null);

  const run = async (key, request, success) => {
    setBusy(key);
    try {
      await request();
      if (success) toast.success(success);
      await onChanged();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, "Something went wrong"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    if (await run("add", () => apiClient.post("/api/v1/admin/states", { name: value }), `State "${value}" added`)) setName("");
  };

  return (
    <section className="bg-white border border-[#E8E7E5] rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-[#F0EFED]">
        <h2 className="font-semibold text-[#0F0C11]">States</h2>
        <p className="text-xs text-[#9B9B99] mt-0.5">Shown in the sign-up and property forms. Inactive states are hidden there.</p>
      </div>
      <form onSubmit={add} className="flex gap-2 px-5 py-4 border-b border-[#F0EFED]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New state, e.g. Bihar" maxLength={80}
          aria-label="State name" className={inputClass} />
        <button type="submit" disabled={!name.trim() || busy === "add"} className={cn(primaryButton, "shrink-0")}>
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>
      <div className="flex flex-wrap gap-2 px-5 py-4 max-h-56 overflow-auto">
        {states.map((st) => (
          <span key={st.id} className="inline-flex items-center gap-1.5 text-xs border border-[#E8E7E5] rounded-full pl-3 pr-1 py-1">
            <span className={cn("font-medium", st.is_active ? "text-[#0F0C11]" : "text-[#9B9B99] line-through")}>{st.name}</span>
            <span className="text-[#9B9B99] tabular-nums">{st.district_count}</span>
            <StatusToggle active={st.is_active} disabled={!!busy}
              onChange={(isActive) => run(`state-${st.id}`, () => apiClient.put(`/api/v1/admin/states/${st.id}`, { is_active: isActive }))} />
            {st.district_count === 0 && (
              <button type="button" className={cn(iconButton, "hover:text-red-600")} title="Delete state" disabled={!!busy}
                onClick={() => window.confirm(`Delete state "${st.name}"?`) && run(`del-${st.id}`, () => apiClient.delete(`/api/v1/admin/states/${st.id}`), "State deleted")}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>
    </section>
  );
};

// ─── District admins ──────────────────────────────────────────────────────────
const EMPTY_ADMIN = { name: "", email: "", password: "", stateId: "", district: "" };

const DistrictAdminsSection = ({ admins, districts, states, onChanged }) => {
  const [form, setForm] = useState(EMPTY_ADMIN);
  const [passwordFor, setPasswordFor] = useState(null); // { id, password }
  const [busy, setBusy] = useState(null);

  const activeDistricts = districts.filter((d) => d.isActive);
  const formDistricts = activeDistricts.filter((d) => d.stateId === form.stateId);

  const run = async (key, request, success) => {
    setBusy(key);
    try {
      await request();
      if (success) toast.success(success);
      await onChanged();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, "Something went wrong"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const createAdmin = async (e) => {
    e.preventDefault();
    // form.stateId only narrows the district list; the API takes the district id
    const payload = { name: form.name, email: form.email, password: form.password, district_id: form.district };
    const ok = await run("create", () => apiClient.post("/api/v1/admin/district-admins", payload), `District admin ${form.email} created`);
    if (ok) setForm(EMPTY_ADMIN);
  };

  const update = (admin, changes, success) =>
    run(`update-${admin.id}`, () => apiClient.put(`/api/v1/admin/district-admins/${admin.id}`, changes), success);

  const savePassword = async () => {
    const admin = admins.find((a) => a.id === passwordFor.id);
    const ok = await update(admin, { password: passwordFor.password }, `Password changed for ${admin.email}`);
    if (ok) setPasswordFor(null);
  };

  const remove = (admin) => {
    if (!window.confirm(`Delete district admin ${admin.email}? They will no longer be able to log in.`)) return;
    run(`delete-${admin.id}`, () => apiClient.delete(`/api/v1/admin/district-admins/${admin.id}`), "District admin deleted");
  };

  return (
    <section className="bg-white border border-[#E8E7E5] rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-[#F0EFED]">
        <h2 className="font-semibold text-[#0F0C11]">District Admins</h2>
        <p className="text-xs text-[#9B9B99] mt-0.5">
          A district admin logs in to this panel and can only approve or reject listings in their own district.
        </p>
      </div>

      <form onSubmit={createAdmin} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 px-5 py-4 border-b border-[#F0EFED]">
        <input required placeholder="Full name" value={form.name} aria-label="Full name"
          onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
        <input required type="email" placeholder="Email (login)" value={form.email} autoComplete="off" aria-label="Email"
          onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
        <input required type="password" minLength={8} placeholder="Password (min 8)" value={form.password}
          autoComplete="new-password" aria-label="Password"
          onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
        <select required value={form.stateId} aria-label="State"
          onChange={(e) => setForm({ ...form, stateId: e.target.value, district: "" })} className={inputClass}>
          <option value="">Select state…</option>
          {states.filter((st) => st.is_active).map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <select required value={form.district} aria-label="District" disabled={!form.stateId}
          onChange={(e) => setForm({ ...form, district: e.target.value })} className={inputClass}>
          <option value="">{form.stateId ? "Select district…" : "Choose a state first"}</option>
          {formDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button type="submit" disabled={busy === "create" || !activeDistricts.length} className={primaryButton}>
          <UserPlus className="w-4 h-4" /> Create
        </button>
      </form>

      {admins.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center text-[#9B9B99]">No district admins yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[#9B9B99]">
                <th className="px-5 py-3 font-medium">Admin</th>
                <th className="px-3 py-3 font-medium">District</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Last login</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-t border-[#F0EFED] align-middle">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-[#0F0C11]">{a.name || "—"}</div>
                    <div className="text-xs text-[#9B9B99]">{a.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={a.district?.id || ""}
                      disabled={!!busy}
                      onChange={(e) => update(a, { district_id: e.target.value }, `${a.email} moved to a new district`)}
                      className={cn(inputClass, "py-1 min-w-[140px]")}
                    >
                      {!a.district && <option value="">—</option>}
                      <DistrictOptions districts={districts} keepId={a.district?.id} />
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusToggle
                      active={a.is_active}
                      disabled={!!busy}
                      onChange={(isActive) =>
                        update(a, { is_active: isActive }, isActive ? `${a.email} enabled` : `${a.email} disabled`)
                      }
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#6B6B6A] whitespace-nowrap">
                    {a.last_login_at ? formatDate(a.last_login_at) : "Never"}
                  </td>
                  <td className="px-5 py-2.5">
                    {passwordFor?.id === a.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="password"
                          minLength={8}
                          placeholder="New password"
                          autoComplete="new-password"
                          value={passwordFor.password}
                          onChange={(e) => setPasswordFor({ ...passwordFor, password: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && passwordFor.password.length >= 8) savePassword();
                            if (e.key === "Escape") setPasswordFor(null);
                          }}
                          className={cn(inputClass, "py-1 w-40")}
                          autoFocus
                        />
                        <button onClick={savePassword} className={iconButton} title="Save password"
                          disabled={passwordFor.password.length < 8 || !!busy}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setPasswordFor(null)} className={iconButton} title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setPasswordFor({ id: a.id, password: "" })} className={iconButton}
                          title="Change password">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(a)} className={cn(iconButton, "hover:text-red-600")}
                          title="Delete" disabled={!!busy}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const Districts = () => {
  const [districts, setDistricts] = useState([]);
  const [states, setStates] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [districtList, stateRes, adminRes] = await Promise.all([
        fetchDistricts(),
        apiClient.get("/api/v1/admin/states"),
        apiClient.get("/api/v1/admin/district-admins"),
      ]);
      setDistricts(districtList);
      setStates(stateRes.data.data || []);
      setAdmins(adminRes.data.data || []);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load districts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#F5F5F3] px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0F0C11] tracking-tight">
              <MapPin className="w-6 h-6 text-[#A3078F]" /> Districts &amp; Admins
            </h1>
            <p className="text-sm text-[#9B9B99] mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Each listing belongs to a district and is reviewed by that district&apos;s admins. You can review every district.
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6B6B6A] bg-white border border-[#E8E7E5] rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] transition-all shadow-sm shrink-0"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </div>

        {loading && !districts.length ? (
          <div className="space-y-4">
            {[0, 1].map((i) => <div key={i} className="h-48 bg-white border border-[#E8E7E5] rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <DistrictsSection districts={districts} states={states} onChanged={load} />
            <DistrictAdminsSection admins={admins} districts={districts} states={states} onChanged={load} />
            <StatesSection states={states} onChanged={load} />
          </>
        )}
      </div>
    </div>
  );
};

export default Districts;
