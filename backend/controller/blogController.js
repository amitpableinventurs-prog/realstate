import mongoose from 'mongoose';
import validator from 'validator';
import BlogPost from '../models/blogPostModel.js';
import { uniqueSlug } from '../utils/slugify.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const serializePost = (post, { full = false, admin = false } = {}) => ({
  id: post._id,
  title: post.title,
  slug: post.slug,
  excerpt: post.excerpt,
  coverImage: post.coverImage || null,
  category: post.category,
  tags: post.tags,
  authorName: post.authorName,
  publishedAt: post.publishedAt || null,
  readMinutes: post.readMinutes,
  isFeatured: post.isFeatured,
  ...(full && { content: post.content }),
  ...(admin && {
    status: post.status,
    views: post.views,
    content: post.content,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  }),
});

const parsePagination = (query, max = 24) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(query.limit, 10) || 9));
  return { page, limit, skip: (page - 1) * limit };
};

// Validates admin input; `partial` allows updates with a subset of fields
const parsePostInput = (body = {}, { partial }) => {
  const data = {};
  const errors = {};
  const text = (key, max, required) => {
    if (body[key] === undefined) {
      if (required && !partial) errors[key] = `${key} is required`;
      return;
    }
    const value = String(body[key] ?? '').trim();
    if (required && !value) errors[key] = `${key} is required`;
    else if (value.length > max) errors[key] = `Must be at most ${max} characters`;
    else data[key] = value;
  };

  text('title', 200, true);
  text('excerpt', 400, true);
  text('content', 50000, true);
  text('category', 60, true);
  text('authorName', 80, false);
  text('slug', 150, false);

  if (body.coverImage !== undefined) {
    const url = String(body.coverImage ?? '').trim();
    if (url && !validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
      errors.coverImage = 'Must be an http(s) image URL';
    } else data.coverImage = url;
  }
  if (body.tags !== undefined) {
    const tags = Array.isArray(body.tags) ? body.tags : String(body.tags).split(',');
    data.tags = [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 10);
  }
  if (body.status !== undefined) {
    if (!['draft', 'published'].includes(body.status)) errors.status = 'Must be draft or published';
    else data.status = body.status;
  }
  if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured);

  return { data, errors };
};

// ── Public ───────────────────────────────────────────────────────────────────

// GET /api/blog/posts?category=&q=&page=&limit=
export const listPublishedPosts = async (req, res) => {
  try {
    const filter = { status: 'published' };
    if (req.query.category) filter.category = String(req.query.category);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
    }

    const { page, limit, skip } = parsePagination(req.query);
    const [posts, total, categories] = await Promise.all([
      BlogPost.find(filter).sort({ isFeatured: -1, publishedAt: -1 }).skip(skip).limit(limit),
      BlogPost.countDocuments(filter),
      BlogPost.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      posts: posts.map((p) => serializePost(p)),
      categories: categories.map((c) => ({ name: c._id, count: c.count })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error listing blog posts:', error);
    res.status(500).json({ success: false, message: 'Failed to load blog posts' });
  }
};

// GET /api/blog/posts/:slug — article plus up to 3 related posts
export const getPublishedPost = async (req, res) => {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { slug: String(req.params.slug).toLowerCase(), status: 'published' },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ success: false, message: 'Article not found' });

    // Same category first, topped up with the latest posts from other categories
    const sameCategory = await BlogPost.find({ status: 'published', _id: { $ne: post._id }, category: post.category })
      .sort({ publishedAt: -1 })
      .limit(3);
    const others = sameCategory.length < 3
      ? await BlogPost.find({
        status: 'published',
        _id: { $nin: [post._id, ...sameCategory.map((p) => p._id)] },
      }).sort({ publishedAt: -1 }).limit(3 - sameCategory.length)
      : [];
    const related = [...sameCategory, ...others];

    res.json({
      success: true,
      post: serializePost(post, { full: true }),
      related: related.map((p) => serializePost(p)),
    });
  } catch (error) {
    console.error('Error loading blog post:', error);
    res.status(500).json({ success: false, message: 'Failed to load article' });
  }
};

// ── Admin ────────────────────────────────────────────────────────────────────

// GET /api/blog/admin/posts?status=
export const adminListPosts = async (req, res) => {
  try {
    const filter = {};
    if (['draft', 'published'].includes(req.query.status)) filter.status = req.query.status;
    const posts = await BlogPost.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, posts: posts.map((p) => serializePost(p, { admin: true })) });
  } catch (error) {
    console.error('Error listing blog posts (admin):', error);
    res.status(500).json({ success: false, message: 'Failed to load blog posts' });
  }
};

// POST /api/blog/admin/posts
export const adminCreatePost = async (req, res) => {
  try {
    const { data, errors } = parsePostInput(req.body, { partial: false });
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });
    }
    data.slug = await uniqueSlug(BlogPost, data.slug || data.title);
    if (data.status === 'published') data.publishedAt = new Date();

    const post = await BlogPost.create(data);
    res.status(201).json({ success: true, message: 'Post created', post: serializePost(post, { admin: true }) });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
};

// PUT /api/blog/admin/posts/:id
export const adminUpdatePost = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const { data, errors } = parsePostInput(req.body, { partial: true });
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });
    }
    if (data.slug !== undefined) {
      data.slug = await uniqueSlug(BlogPost, data.slug || data.title || post.title, post._id);
    }
    // First publication sets the date; unpublishing keeps it for re-publishing
    if (data.status === 'published' && !post.publishedAt) data.publishedAt = new Date();

    post.set(data);
    await post.save();
    res.json({ success: true, message: 'Post updated', post: serializePost(post, { admin: true }) });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
};

// DELETE /api/blog/admin/posts/:id
export const adminDeletePost = async (req, res) => {
  try {
    const post = mongoose.isValidObjectId(req.params.id) && await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
};
