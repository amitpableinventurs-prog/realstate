import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper, Plus, Pencil, Trash2, Star, Eye, ExternalLink,
  RefreshCw, AlertCircle, Check, X, ImageOff,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../services/apiClient';
import { websiteurl } from '../config/constants';
import { cn } from '../lib/utils';

const EMPTY_FORM = {
  title: '',
  category: '',
  excerpt: '',
  coverImage: '',
  content: '',
  tags: '',
  authorName: 'Bhumi Bazar Team',
  status: 'draft',
  isFeatured: false,
};

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
];

const inputClass = (error) => cn(
  'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2',
  error ? 'border-red-400 focus:ring-red-200' : 'border-[#E6E0E9] focus:ring-[#A3078F]/30 focus:border-[#A3078F]'
);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const Blog = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiClient.get('/api/blog/admin/posts');
      setPosts(data.posts || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const visiblePosts = statusFilter ? posts.filter((p) => p.status === statusFilter) : posts;
  const categories = [...new Set(posts.map((p) => p.category))].sort();

  function openCreate() {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(post) {
    setForm({
      title: post.title,
      category: post.category,
      excerpt: post.excerpt,
      coverImage: post.coverImage || '',
      content: post.content,
      tags: post.tags.join(', '),
      authorName: post.authorName,
      status: post.status,
      isFeatured: post.isFeatured,
    });
    setFieldErrors({});
    setEditingId(post.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function handleSave() {
    const missing = ['title', 'category', 'excerpt', 'content'].filter((k) => !form[k].trim());
    if (missing.length) {
      setFieldErrors(Object.fromEntries(missing.map((k) => [k, 'Required'])));
      toast.error('Please fill in the required fields');
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await apiClient.put(`/api/blog/admin/posts/${editingId}`, form);
        toast.success('Post updated');
      } else {
        await apiClient.post('/api/blog/admin/posts', form);
        toast.success(form.status === 'published' ? 'Post published' : 'Draft saved');
      }
      closeForm();
      fetchPosts();
    } catch (err) {
      setFieldErrors(err.response?.data?.errors || {});
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(post) {
    const status = post.status === 'published' ? 'draft' : 'published';
    try {
      await apiClient.put(`/api/blog/admin/posts/${post.id}`, { status });
      toast.success(status === 'published' ? 'Post published' : 'Moved to drafts');
      fetchPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  }

  async function toggleFeatured(post) {
    try {
      await apiClient.put(`/api/blog/admin/posts/${post.id}`, { isFeatured: !post.isFeatured });
      toast.success(post.isFeatured ? 'Removed from featured' : 'Marked as featured');
      fetchPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  }

  async function handleDelete(id) {
    try {
      await apiClient.delete(`/api/blog/admin/posts/${id}`);
      toast.success('Post deleted');
      setDeleteConfirm(null);
      fetchPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FB] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#A3078F] rounded-xl flex items-center justify-center">
              <Newspaper className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#17131A]">Blog</h1>
              <p className="text-sm text-[#6B7280]">Articles shown on the website blog</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchPosts} className="p-2 text-[#6B7280] hover:text-[#17131A] hover:bg-white rounded-lg transition-colors" title="Refresh">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#A3078F] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A0A74] transition-colors"
            >
              <Plus className="h-4 w-4" /> New Post
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 bg-white border border-[#E6E0E9] rounded-xl p-1 w-fit mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === tab.value ? 'bg-[#17131A] text-white' : 'text-[#6B7280] hover:text-[#17131A]'
              )}
            >
              {tab.label}
              <span className="ml-1.5 opacity-60">
                {tab.value ? posts.filter((p) => p.status === tab.value).length : posts.length}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {visiblePosts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl border border-[#E6E0E9] overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="h-16 w-24 flex-shrink-0 rounded-lg bg-[#F3F0F4] overflow-hidden flex items-center justify-center">
                    {post.coverImage
                      ? <img src={post.coverImage} alt="" className="h-full w-full object-cover" />
                      : <ImageOff className="h-5 w-5 text-[#C6BCCB]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#17131A] truncate">{post.title}</span>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        post.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-[#F3F0F4] text-[#6B7280]'
                      )}>
                        {post.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                      {post.isFeatured && (
                        <span className="inline-flex items-center gap-1 text-xs bg-[#A3078F]/10 text-[#A3078F] px-2 py-0.5 rounded-full font-medium">
                          <Star className="h-3 w-3" /> Featured
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9CA3AF] mt-1">
                      <span>{post.category}</span>
                      <span>{post.status === 'published' ? `Published ${formatDate(post.publishedAt)}` : `Updated ${formatDate(post.updatedAt)}`}</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{post.views}</span>
                      <span>{post.readMinutes} min read</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {post.status === 'published' && (
                      <a
                        href={`${websiteurl}/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[#9CA3AF] hover:text-[#17131A] hover:bg-[#F3F0F4] rounded-lg transition-colors"
                        title="View on website"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => toggleFeatured(post)}
                      className={cn('p-2 rounded-lg transition-colors', post.isFeatured ? 'text-[#A3078F] hover:bg-[#A3078F]/10' : 'text-[#9CA3AF] hover:text-[#A3078F] hover:bg-[#A3078F]/10')}
                      title={post.isFeatured ? 'Remove from featured' : 'Feature on blog page'}
                    >
                      <Star className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => togglePublish(post)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#17131A] hover:bg-[#F3F0F4] rounded-lg transition-colors"
                    >
                      {post.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button onClick={() => openEdit(post)} className="p-2 text-[#9CA3AF] hover:text-[#17131A] hover:bg-[#F3F0F4] rounded-lg transition-colors" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(post.id)} className="p-2 text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {deleteConfirm === post.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-red-700">Delete <strong>{post.title}</strong>? This cannot be undone.</span>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteConfirm(null)} className="flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#17131A] px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                          <button onClick={() => handleDelete(post.id)} className="flex items-center gap-1 text-sm text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors">
                            <Check className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {!visiblePosts.length && (
              <div className="text-center py-16 text-[#9CA3AF]">
                <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{posts.length ? 'No posts in this view.' : 'No posts yet. Write your first article.'}</p>
              </div>
            )}
          </div>
        )}

        {/* Create / Edit modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && closeForm()}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between p-5 border-b border-[#E6E0E9] sticky top-0 bg-white z-10">
                  <h2 className="font-bold text-lg text-[#17131A]">{editingId ? 'Edit Post' : 'New Post'}</h2>
                  <button onClick={closeForm} className="p-1.5 text-[#9CA3AF] hover:text-[#17131A] rounded-lg hover:bg-[#F3F0F4] transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#17131A] mb-1">Title *</label>
                    <input className={inputClass(fieldErrors.title)} value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="7 Documents to Check Before Buying Land" />
                    {fieldErrors.title && <p className="text-xs text-red-600 mt-1">{fieldErrors.title}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#17131A] mb-1">Category *</label>
                      <input className={inputClass(fieldErrors.category)} value={form.category} onChange={(e) => setField('category', e.target.value)} list="blog-categories" placeholder="Buying Guide" />
                      <datalist id="blog-categories">
                        {categories.map((c) => <option key={c} value={c} />)}
                      </datalist>
                      {fieldErrors.category && <p className="text-xs text-red-600 mt-1">{fieldErrors.category}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#17131A] mb-1">Author</label>
                      <input className={inputClass()} value={form.authorName} onChange={(e) => setField('authorName', e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#17131A] mb-1">Excerpt *</label>
                    <textarea rows={2} maxLength={400} className={inputClass(fieldErrors.excerpt)} value={form.excerpt} onChange={(e) => setField('excerpt', e.target.value)} placeholder="One or two sentences shown on the blog list" />
                    {fieldErrors.excerpt && <p className="text-xs text-red-600 mt-1">{fieldErrors.excerpt}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#17131A] mb-1">Cover image URL</label>
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <input className={inputClass(fieldErrors.coverImage)} value={form.coverImage} onChange={(e) => setField('coverImage', e.target.value)} placeholder="https://…" />
                        {fieldErrors.coverImage && <p className="text-xs text-red-600 mt-1">{fieldErrors.coverImage}</p>}
                      </div>
                      <div className="h-14 w-24 flex-shrink-0 rounded-lg bg-[#F3F0F4] overflow-hidden flex items-center justify-center">
                        {form.coverImage
                          ? <img src={form.coverImage} alt="Preview" className="h-full w-full object-cover" />
                          : <ImageOff className="h-5 w-5 text-[#C6BCCB]" />}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#17131A] mb-1">Content *</label>
                    <p className="text-xs text-[#9CA3AF] mb-2">
                      Leave a blank line between paragraphs. Start a line with <code className="bg-[#F3F0F4] px-1 rounded">## </code> for a heading and <code className="bg-[#F3F0F4] px-1 rounded">- </code> for a bullet point.
                    </p>
                    <textarea rows={14} className={cn(inputClass(fieldErrors.content), 'font-mono text-[13px] leading-relaxed')} value={form.content} onChange={(e) => setField('content', e.target.value)} />
                    {fieldErrors.content && <p className="text-xs text-red-600 mt-1">{fieldErrors.content}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#17131A] mb-1">Tags</label>
                    <input className={inputClass()} value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="land, documents, khata" />
                    <p className="text-xs text-[#9CA3AF] mt-1">Comma separated, up to 10</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-[#17131A]">Status</label>
                      <select className="border border-[#E6E0E9] rounded-lg px-3 py-2 text-sm" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={form.isFeatured} onChange={(e) => setField('isFeatured', e.target.checked)} className="rounded" />
                      <span className="text-sm font-semibold text-[#17131A]">Featured on blog page</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#E6E0E9] sticky bottom-0 bg-white">
                  <button onClick={closeForm} className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#17131A] rounded-lg hover:bg-[#F3F0F4] transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-semibold text-white bg-[#A3078F] hover:bg-[#7A0A74] rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : editingId ? 'Save Changes' : form.status === 'published' ? 'Publish Post' : 'Save Draft'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Blog;
