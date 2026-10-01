import mongoose from 'mongoose';

// Blog articles, written in the admin panel and shown on the website /blog.
// `content` is plain text: blank lines separate paragraphs, lines starting with
// "## " are headings and lines starting with "- " are bullet points.
const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 220 },
    excerpt: { type: String, required: true, trim: true, maxlength: 400 },
    content: { type: String, required: true, maxlength: 50000 },
    coverImage: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    tags: { type: [String], default: [] },
    authorName: { type: String, trim: true, default: 'Bhumi Bazar Team', maxlength: 80 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date },
    isFeatured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

blogPostSchema.virtual('readMinutes').get(function () {
  const words = (this.content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
});

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ status: 1, category: 1, publishedAt: -1 });

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

export default BlogPost;
