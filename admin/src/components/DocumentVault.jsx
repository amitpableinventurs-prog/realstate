import { useState } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Lock, LockOpen, FileText, Image as ImageIcon, ExternalLink, Eye, EyeOff, X } from 'lucide-react';
import { formatBytes, useDocumentUnlock } from '../lib/documents';
import { cn } from '../lib/utils';

// A property's locked documents (registry, khatiyan, ...). Everyone in the
// admin panel sees the list; only the super admin can unlock it, with the
// document password (not the login password). Unlocked links open the files
// in a new tab for 10 minutes, then the documents lock again.

export const DocumentIcon = ({ type, className }) => {
  const Icon = type === 'application/pdf' ? FileText : ImageIcon;
  return <Icon className={className} aria-hidden="true" />;
};
DocumentIcon.propTypes = { type: PropTypes.string, className: PropTypes.string };

const timeOf = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/** Asks for the document password. `onUnlock(password)` throws the API error on failure. */
export const UnlockModal = ({ subtitle, onClose, onUnlock }) => {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await onUnlock(password);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not unlock the documents. Try again.');
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="unlock-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        className="relative bg-white rounded-2xl border border-[#E8E7E5] shadow-2xl w-full max-w-sm p-6 z-10"
        initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#A3078F]/10 flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4 text-[#A3078F]" />
            </div>
            <div className="min-w-0">
              <h3 id="unlock-title" className="font-semibold text-[#0F0C11] text-sm">Unlock documents</h3>
              {subtitle && <p className="text-xs text-[#9B9B99] mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#9B9B99] hover:text-[#0F0C11] p-1 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="document-password" className="block text-xs font-medium text-[#6B6B6A] uppercase tracking-wider mb-2">
              Document password
            </label>
            <div className="relative">
              <input
                id="document-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="off"
                autoFocus
                className={cn(
                  'w-full border rounded-xl pl-3 pr-10 py-2.5 text-sm text-[#0F0C11] focus:outline-none focus:ring-2',
                  error ? 'border-red-300 focus:ring-red-200' : 'border-[#E8E7E5] focus:ring-[#A3078F]/20 focus:border-[#A3078F]'
                )}
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#9B9B99] hover:text-[#0F0C11]">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error ? (
              <p role="alert" className="text-xs text-red-600 mt-1.5">{error}</p>
            ) : (
              <p className="text-xs text-[#9B9B99] mt-1.5">Not your login password. The documents open for 10 minutes.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 text-sm font-medium text-[#6B6B6A] border border-[#E8E7E5] rounded-xl hover:bg-[#F5F5F3] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={busy || !password}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#A3078F] hover:bg-[#7A0A74] rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? 'Unlocking…' : <><LockOpen className="w-4 h-4" /> Unlock</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
UnlockModal.propTypes = { subtitle: PropTypes.string, onClose: PropTypes.func.isRequired, onUnlock: PropTypes.func.isRequired };

/**
 * A property's saved documents, with Unlock for the super admin. `onRemove(id)`
 * (the edit form) adds a remove button to each.
 */
const DocumentVault = ({ propertyId, documents, canUnlock, title, onRemove, className }) => {
  const { links, expiresAt, unlock, lock } = useDocumentUnlock(propertyId);
  const [asking, setAsking] = useState(false);
  if (!documents?.length) return null;

  return (
    <div className={cn('rounded-xl border border-[#EBC9E6] bg-[#FAF1F9]/60 p-3', className ?? 'mb-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#7A0A74]">
          {links ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          Documents ({documents.length})
          <span className="font-normal text-[#9B9B99]">{links ? `· open until ${timeOf(expiresAt)}` : '· locked'}</span>
        </p>
        {canUnlock ? (
          <button type="button" onClick={links ? lock : () => setAsking(true)}
            className="flex items-center gap-1 text-xs font-semibold text-[#A3078F] hover:text-[#7A0A74] px-2 py-1 rounded-lg hover:bg-white transition-colors">
            {links ? <><Lock className="w-3.5 h-3.5" /> Lock</> : <><LockOpen className="w-3.5 h-3.5" /> Unlock</>}
          </button>
        ) : (
          <span className="text-[11px] text-[#9B9B99]">Only the super admin can unlock</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center gap-2 text-xs text-[#3F3D3B] min-w-0">
            <DocumentIcon type={doc.content_type} className="w-3.5 h-3.5 text-[#A3078F] flex-shrink-0" />
            <span className="truncate flex-1 min-w-0" title={doc.file_name}>{doc.file_name}</span>
            <span className="text-[#9B9B99] tabular-nums flex-shrink-0">{formatBytes(doc.size)}</span>
            {links?.[doc.id] ? (
              <a href={links[doc.id]} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 font-semibold text-[#A3078F] hover:underline flex-shrink-0">
                Open <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <Lock className="w-3 h-3 text-[#9B9B99] flex-shrink-0" aria-label="Locked" />
            )}
            {onRemove && (
              <button type="button" onClick={() => onRemove(doc.id)} aria-label={`Remove ${doc.file_name}`}
                className="p-0.5 rounded text-[#9B9B99] hover:text-red-600 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {asking && (
        <UnlockModal
          subtitle={title}
          onClose={() => setAsking(false)}
          onUnlock={async (password) => {
            await unlock(password);
            setAsking(false);
            toast.success('Documents unlocked for 10 minutes');
          }}
        />
      )}
    </div>
  );
};

DocumentVault.propTypes = {
  propertyId: PropTypes.string,
  documents: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    file_name: PropTypes.string.isRequired,
    content_type: PropTypes.string,
    size: PropTypes.number,
  })),
  canUnlock: PropTypes.bool,
  title: PropTypes.string,
  onRemove: PropTypes.func,
  className: PropTypes.string,
};

export default DocumentVault;
