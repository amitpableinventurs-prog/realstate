import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, ChevronLeft, ChevronRight, Loader2, Mail, MapPin, Phone, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../services/apiClient';
import { cn } from '../lib/utils';

const STATUSES = ['PENDING', 'CONTACTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'];
const BADGES = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONTACTED: 'bg-blue-50 text-blue-700 border-blue-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
  COMPLETED: 'bg-violet-50 text-violet-700 border-violet-200',
};

const PropertyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/api/v1/admin/bookings', {
        params: { page, limit: 20, ...(statusFilter && { status: statusFilter }) },
      });
      setBookings(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load property bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBookings(); }, [page, statusFilter]);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      await apiClient.patch(`/api/v1/admin/bookings/${id}/status`, { status });
      toast.success(`Booking marked ${status.toLowerCase()}`);
      await loadBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update booking status');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = bookings.filter((booking) => {
    const searchText = [
      booking.customer?.name,
      booking.customer?.phone,
      booking.customer?.email,
      booking.property?.khata_number,
      booking.property?.khasra_number,
      booking.property?.district?.name,
    ].filter(Boolean).join(' ').toLowerCase();
    return searchText.includes(search.toLowerCase());
  });

  return (
    <main className="min-h-screen bg-[#FAF8FB] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#17131A]">Property Bookings</h1>
            <p className="mt-1 text-sm text-[#5A5856]">Review Book Now requests and update their status.</p>
          </div>
          <button onClick={loadBookings} className="inline-flex items-center gap-2 rounded-xl border border-[#E6D6E8] bg-white px-4 py-2.5 text-sm font-semibold text-[#17131A] hover:bg-[#FAF8FB]">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#E6D6E8] bg-white p-4 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by customer, phone, property..." className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#A3078F]" />
          </label>
          <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#A3078F]">
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#E6D6E8] bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading bookings...</div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center text-gray-500">
              <Building2 className="mb-3 h-8 w-8 text-gray-300" />
              <p className="font-semibold text-gray-700">No property bookings found</p>
              <p className="mt-1 text-sm">New Book Now requests will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((booking) => {
                const customer = booking.customer || {};
                const place = [booking.property?.district?.name, booking.property?.state?.name].filter(Boolean).join(', ');
                return (
                  <article key={booking.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-[#17131A]">{customer.name || booking.user?.name || 'Visitor'}</h2>
                        <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold', BADGES[booking.status] || 'bg-gray-100 text-gray-700')}>
                          {booking.status}
                        </span>
                      </div>
                      <p className="flex items-center gap-2 text-sm font-medium text-[#5A5856]"><Building2 className="h-4 w-4 shrink-0" />{booking.property?.listing_type || 'Property'} · Khata {booking.property?.khata_number || '—'} · Khasra {booking.property?.khasra_number || '—'}</p>
                      {place && <p className="mt-1 flex items-center gap-2 text-sm text-gray-500"><MapPin className="h-4 w-4 shrink-0" />{place}</p>}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        {customer.phone && <a className="inline-flex items-center gap-1.5 hover:text-[#A3078F]" href={`tel:${customer.phone}`}><Phone className="h-3.5 w-3.5" />{customer.phone}</a>}
                        {customer.email && <a className="inline-flex items-center gap-1.5 hover:text-[#A3078F]" href={`mailto:${customer.email}`}><Mail className="h-3.5 w-3.5" />{customer.email}</a>}
                        {booking.created_at && <span>{new Date(booking.created_at).toLocaleString()}</span>}
                      </div>
                      {booking.message && <p className="mt-3 rounded-lg bg-[#FAF8FB] px-3 py-2 text-sm text-gray-600">{booking.message}</p>}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-500">
                      <BadgeCheck className="h-4 w-4" />
                      <select disabled={updatingId === booking.id} value={booking.status} onChange={(event) => updateStatus(booking.id, event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-medium text-[#17131A] outline-none focus:border-[#A3078F] disabled:opacity-60">
                        {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      {updatingId === booking.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    </label>
                  </article>
                );
              })}
            </div>
          )}
          <footer className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-gray-200 p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-gray-200 p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
};

export default PropertyBookings;
