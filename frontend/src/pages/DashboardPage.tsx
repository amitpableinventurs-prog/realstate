import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  appointmentsAPI, propertiesAPI, wishlistAPI, enquiriesAPI, notificationsAPI,
  type ReceivedEnquiry, type AppNotification,
} from '../services/api';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import PropertiesGrid from '../components/properties/PropertiesGrid';
import { toProperty, LISTING_TYPE_LABELS, type Property } from '../utils/propertyDisplay';
import { useWishlistToggle } from '../hooks/useWishlistToggle';
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

interface AppointmentProperty {
  _id: string;
  title: string;
  images?: { url: string }[];
}

interface Appointment {
  _id: string;
  propertyId: AppointmentProperty | null;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  meetingLink?: string;
  cancelReason?: string;
  createdAt: string;
}


// ── Status config ─────────────────────────────────────────────────────────────

const APPOINTMENT_STATUS = {
  pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-400' },
  confirmed: { label: 'Confirmed', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  completed: { label: 'Completed', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isUpcoming(apt: Appointment): boolean {
  return (
    (apt.status === 'pending' || apt.status === 'confirmed') &&
    new Date(apt.date).getTime() >= Date.now() - 24 * 60 * 60 * 1000
  );
}

// ── Saved properties (wishlist) ──────────────────────────────────────────────

const SavedTab: React.FC = () => {
  const [saved, setSaved] = useState<Property[] | null>(null);

  useEffect(() => {
    wishlistAPI.list()
      .then(({ data }) => setSaved(data.data.map(toProperty)))
      .catch(() => { setSaved([]); toast.error('Failed to load your saved properties.'); });
  }, []);

  // Unsaving removes the card
  const toggle = useWishlistToggle(useCallback((p: Property) => {
    setSaved((prev) => (prev || []).filter((x) => x._id !== p._id || p.isSaved));
  }, []));

  if (!saved) return <div className="h-40 bg-white border border-[#E8E1EA] rounded-2xl animate-pulse" />;
  if (!saved.length) {
    return (
      <EmptyState icon="favorite_border" text="No saved properties yet. Tap the heart on a property to save it.">
        <Link to="/properties" className="inline-block bg-[#A3078F] font-manrope font-bold text-sm text-white px-5 py-2.5 rounded-xl hover:bg-[#8E0A82]">
          Browse Properties
        </Link>
      </EmptyState>
    );
  }
  return <div className="-mx-6"><PropertiesGrid properties={saved} onToggleSave={toggle} /></div>;
};

// ── Enquiries received on my properties ───────────────────────────────────────

const EnquiriesTab: React.FC = () => {
  const [enquiries, setEnquiries] = useState<ReceivedEnquiry[] | null>(null);

  useEffect(() => {
    enquiriesAPI.received()
      .then(({ data }) => setEnquiries(data.data))
      .catch(() => { setEnquiries([]); toast.error('Failed to load enquiries.'); });
  }, []);

  if (!enquiries) return <div className="h-40 bg-white border border-[#E8E1EA] rounded-2xl animate-pulse" />;
  if (!enquiries.length) return <EmptyState icon="forum" text="No enquiries yet. Buyers' messages about your properties appear here." />;
  return (
    <div className="space-y-3">
      {enquiries.map((e) => (
        <div key={e.id} className="bg-white border border-[#E8E1EA] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-manrope font-bold text-sm text-[#1A0A1E]">
              {e.from_user?.name || 'A user'}{' '}
              <span className="font-normal text-[#64748B]">
                about {e.property ? `Khata ${e.property.khata_number}, Khasra ${e.property.khasra_number} (${LISTING_TYPE_LABELS[e.property.listing_type]})` : 'a deleted property'}
              </span>
            </p>
            {e.message && <p className="font-manrope text-sm text-[#374151] mt-1">“{e.message}”</p>}
            <p className="font-manrope text-xs text-[#9CA3AF] mt-1">{formatDate(e.created_at)}</p>
          </div>
          {e.from_user?.mobile && (
            <div className="flex gap-2 shrink-0">
              <a href={`tel:${e.from_user.mobile}`} className="font-manrope font-semibold text-xs text-white bg-[#A3078F] px-4 py-2 rounded-lg hover:bg-[#8E0A82]">
                Call {e.from_user.mobile}
              </a>
              {e.property && (
                <Link to={`/property/${e.property.id}`} className="font-manrope font-semibold text-xs text-[#1A0A1E] border border-[#E8E1EA] px-4 py-2 rounded-lg hover:border-[#A3078F] hover:text-[#A3078F]">
                  View
                </Link>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Notifications ─────────────────────────────────────────────────────────────

const NotificationsTab: React.FC = () => {
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    notificationsAPI.list()
      .then(({ data }) => setItems(data.data))
      .catch(() => { setItems([]); toast.error('Failed to load notifications.'); });
  }, []);

  const markRead = (n: AppNotification) => {
    if (n.is_read) return;
    setItems((prev) => (prev || []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    notificationsAPI.markRead(n.id).catch(() => {});
  };

  if (!items) return <div className="h-40 bg-white border border-[#E8E1EA] rounded-2xl animate-pulse" />;
  if (!items.length) return <EmptyState icon="notifications_none" text="No notifications yet." />;
  return (
    <div className="space-y-2">
      {items.map((n) => {
        const link = n.type === 'NEW_ENQUIRY' ? '/enquiries' : n.reference_id ? `/property/${n.reference_id}` : null;
        const body = (
          <div className={`bg-white border rounded-2xl p-4 ${n.is_read ? 'border-[#E8E1EA]' : 'border-[#A3078F]/40 shadow-sm'}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-manrope font-bold text-sm text-[#1A0A1E]">
                {!n.is_read && <span className="inline-block w-2 h-2 rounded-full bg-[#A3078F] mr-2 align-middle" />}
                {n.title}
              </p>
              <span className="font-manrope text-xs text-[#9CA3AF] shrink-0">{formatDate(n.created_at)}</span>
            </div>
            {n.body && <p className="font-manrope text-sm text-[#4B5563] mt-1">{n.body}</p>}
          </div>
        );
        return link
          ? <Link key={n.id} to={link} onClick={() => markRead(n)} className="block">{body}</Link>
          : <div key={n.id} onClick={() => markRead(n)}>{body}</div>;
      })}
    </div>
  );
};

const EmptyState: React.FC<{ icon: string; text: string; children?: React.ReactNode }> = ({ icon, text, children }) => (
  <div className="bg-white border border-[#E8E1EA] rounded-2xl p-10 text-center">
    <span className="font-material-icons text-4xl text-[#A3078F]/40" aria-hidden="true">{icon}</span>
    <p className="font-manrope text-sm text-[#4B5563] mt-3 mb-5">{text}</p>
    {children}
  </div>
);

type Tab = 'overview' | 'saved' | 'enquiries' | 'notifications';
const TAB_LABELS: Record<Tab, string> = { overview: 'Overview', saved: 'Saved', enquiries: 'Enquiries', notifications: 'Notifications' };
const TAB_PATHS: Record<Tab, string> = { overview: '/dashboard', saved: '/wishlist', enquiries: '/enquiries', notifications: '/notifications' };

const DashboardPage: React.FC<{ tab?: Tab }> = ({ tab = 'overview' }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();
  const activeTab = tab;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [listingCounts, setListingCounts] = useState({ total: 0, live: 0 });
  const [fetchLoading, setFetchLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast.error('Please login to view your dashboard.');
      navigate(`/signin?next=${encodeURIComponent(TAB_PATHS[tab])}`, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // ── Fetch data ──────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setFetchLoading(true);
    const [aptRes, listRes, liveRes] = await Promise.allSettled([
      appointmentsAPI.getByUser(),
      propertiesAPI.mine({ limit: 1 }),
      propertiesAPI.mine({ status: 'APPROVED', limit: 1 }),
    ]);

    if (aptRes.status === 'fulfilled') {
      setAppointments(aptRes.value.data.appointments ?? []);
    } else {
      toast.error('Failed to load your appointments.');
    }

    setListingCounts({
      total: listRes.status === 'fulfilled' ? listRes.value.data.meta.total : 0,
      live: liveRes.status === 'fulfilled' ? liveRes.value.data.meta.total : 0,
    });

    setFetchLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  // ── Cancel appointment ──────────────────────────────────────

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await appointmentsAPI.cancel(cancelTarget._id, 'Cancelled by user from dashboard');
      toast.success('Appointment cancelled.');
      setAppointments((prev) =>
        prev.map((a) => (a._id === cancelTarget._id ? { ...a, status: 'cancelled' } : a))
      );
    } catch {
      toast.error('Failed to cancel the appointment. Please try again.');
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  // ── Derived stats ───────────────────────────────────────────

  const upcomingCount = appointments.filter(isUpcoming).length;
  const stats = [
    { label: 'Upcoming Site Visits', value: upcomingCount, icon: 'event' },
    { label: 'Total Site Visits', value: appointments.length, icon: 'calendar_month' },
    { label: 'My Listings', value: listingCounts.total, icon: 'home_work' },
    { label: 'Live Listings', value: listingCounts.live, icon: 'verified' },
  ];

  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#FAF8FB] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-syne font-bold text-3xl text-[#1A0A1E] mb-1">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="font-manrope text-sm text-[#4B5563]">
            +91 {user?.mobile?.replace(/^\+91/, '')}{user?.district?.name ? ` · ${user.district.name}, ${user.state?.name}` : ''} ·{' '}
            <Link to="/profile" className="font-semibold text-[#A3078F] hover:underline">Edit profile</Link>
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-[#E8E1EA]">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <Link
              key={t}
              to={TAB_PATHS[t]}
              className={`font-manrope font-semibold text-sm px-5 py-2.5 -mb-px border-b-2 transition-[color,border-color] ${
                activeTab === t
                  ? 'border-[#A3078F] text-[#A3078F]'
                  : 'border-transparent text-[#4B5563] hover:text-[#1A0A1E]'
              }`}
            >
              {TAB_LABELS[t]}
            </Link>
          ))}
        </div>

        {activeTab === 'saved' && <SavedTab />}
        {activeTab === 'enquiries' && <EnquiriesTab />}
        {activeTab === 'notifications' && <NotificationsTab />}

        {activeTab === 'overview' && <>
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map(({ label, value, icon }) => (
            <div
              key={label}
              className="bg-white border border-[#E8E1EA] rounded-2xl p-5 shadow-sm"
            >
              <span className="font-material-icons text-[#A3078F] text-2xl" aria-hidden="true">{icon}</span>
              <div className="font-syne font-bold text-2xl text-[#1A0A1E] mt-2 tabular-nums">
                {fetchLoading ? '—' : value}
              </div>
              <div className="font-manrope text-xs text-[#64748B] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3 mb-10">
          <Link
            to="/my-listings"
            className="bg-white border border-[#E8E1EA] font-manrope font-semibold text-sm text-[#1A0A1E] px-5 py-2.5 rounded-xl hover:border-[#A3078F] hover:text-[#A3078F] transition-[border-color,color]"
          >
            Manage My Listings
          </Link>
          <Link
            to="/add-property"
            className="bg-[#A3078F] font-manrope font-bold text-sm text-white px-5 py-2.5 rounded-xl hover:bg-[#8E0A82] transition-[background-color]"
          >
            + List a Property
          </Link>
          <Link
            to="/properties"
            className="bg-white border border-[#E8E1EA] font-manrope font-semibold text-sm text-[#1A0A1E] px-5 py-2.5 rounded-xl hover:border-[#A3078F] hover:text-[#A3078F] transition-[border-color,color]"
          >
            Browse Properties
          </Link>
        </div>

        {/* Appointments */}
        <section>
          <h2 className="font-syne font-bold text-xl text-[#1A0A1E] mb-4">My Site Visits</h2>

          {fetchLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-[#E8E1EA] rounded-2xl h-24 animate-pulse" />
              ))}
            </div>
          ) : sortedAppointments.length === 0 ? (
            <div className="bg-white border border-[#E8E1EA] rounded-2xl p-10 text-center">
              <span className="font-material-icons text-4xl text-[#A3078F]/40" aria-hidden="true">event_busy</span>
              <p className="font-manrope text-sm text-[#4B5563] mt-3 mb-5">
                No site visits yet. Book one from any property page.
              </p>
              <Link
                to="/properties"
                className="inline-block bg-[#A3078F] font-manrope font-bold text-sm text-white px-5 py-2.5 rounded-xl hover:bg-[#8E0A82] transition-[background-color]"
              >
                Browse Properties
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedAppointments.map((apt) => {
                const status = APPOINTMENT_STATUS[apt.status];
                const cancellable = apt.status === 'pending' || apt.status === 'confirmed';
                return (
                  <div
                    key={apt._id}
                    className="bg-white border border-[#E8E1EA] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    {/* Property thumbnail */}
                    {apt.propertyId?.images?.[0] ? (
                      <img
                        src={apt.propertyId.images[0].url}
                        alt={apt.propertyId.title}
                        className="w-full sm:w-20 h-32 sm:h-16 object-cover rounded-xl shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full sm:w-20 h-32 sm:h-16 bg-[#FAF8FB] border border-[#E8E1EA] rounded-xl flex items-center justify-center shrink-0">
                        <span className="font-material-icons text-[#A3078F]/40" aria-hidden="true">home</span>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-manrope font-bold text-sm text-[#1A0A1E] truncate">
                          {apt.propertyId?.title ?? 'Property no longer available'}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-manrope font-semibold ${status.bg} ${status.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </div>
                      <p className="font-manrope text-xs text-[#4B5563] mt-1 tabular-nums">
                        {formatDate(apt.date)} · {apt.time}
                      </p>
                      {apt.status === 'cancelled' && apt.cancelReason && (
                        <p className="font-manrope text-xs text-red-500 mt-1">{apt.cancelReason}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {apt.meetingLink && apt.status === 'confirmed' && (
                        <a
                          href={apt.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-manrope font-semibold text-xs text-white bg-[#1A0A1E] px-4 py-2 rounded-lg hover:bg-[#A3078F] transition-[background-color]"
                        >
                          Join Meeting
                        </a>
                      )}
                      {apt.propertyId && (
                        <Link
                          to={`/property/${apt.propertyId._id}`}
                          className="font-manrope font-semibold text-xs text-[#1A0A1E] border border-[#E8E1EA] px-4 py-2 rounded-lg hover:border-[#A3078F] hover:text-[#A3078F] transition-[border-color,color]"
                        >
                          View
                        </Link>
                      )}
                      {cancellable && (
                        <button
                          onClick={() => setCancelTarget(apt)}
                          className="font-manrope font-semibold text-xs text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-[background-color]"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </>}
      </main>

      <Footer />

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this viewing?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.propertyId?.title
                ? `Your viewing of "${cancelTarget.propertyId.title}" on ${formatDate(cancelTarget.date)} at ${cancelTarget.time} will be cancelled.`
                : 'This appointment will be cancelled.'}{' '}
              A confirmation email will be sent to you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DashboardPage;
