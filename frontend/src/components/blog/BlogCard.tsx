import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import type { BlogPostSummary } from '../../services/api';

const FALLBACK_COVER = '/landscape-logo.png';

export const formatPostDate = (date: string | null) =>
  date ? format(new Date(date), 'd MMM yyyy') : '';

interface BlogCardProps {
  post: BlogPostSummary;
  /** Large horizontal layout for the featured article */
  featured?: boolean;
}

const BlogCard: React.FC<BlogCardProps> = ({ post, featured = false }) => (
  <Link
    to={`/blog/${post.slug}`}
    className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-[#A3078F] rounded-2xl"
  >
    <article
      className={`h-full bg-white rounded-2xl overflow-hidden border border-[#EDE7EF] shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-shadow duration-300 ${
        featured ? 'grid grid-cols-1 lg:grid-cols-2' : 'flex flex-col'
      }`}
    >
      <div className={`relative overflow-hidden bg-[#E8E1EA] ${featured ? 'aspect-[16/10] lg:aspect-auto lg:min-h-[340px]' : 'aspect-[16/10]'}`}>
        <img
          src={post.coverImage || FALLBACK_COVER}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {featured && (
          <span className="absolute top-4 left-4 bg-[#A3078F] text-white font-manrope text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
            Featured
          </span>
        )}
      </div>

      <div className={`flex flex-col flex-1 ${featured ? 'p-8 lg:p-10 justify-center' : 'p-6'}`}>
        <span className="font-space-mono text-xs text-[#A3078F] uppercase tracking-widest mb-3">
          {post.category}
        </span>
        <h3
          className={`font-fraunces text-[#1A0A1E] leading-snug mb-3 group-hover:text-[#8E0A82] transition-colors ${
            featured ? 'text-3xl lg:text-4xl' : 'text-xl line-clamp-2'
          }`}
        >
          {post.title}
        </h3>
        <p className={`font-manrope text-[#4B5563] leading-relaxed mb-5 ${featured ? 'text-base' : 'text-sm line-clamp-3'}`}>
          {post.excerpt}
        </p>
        <div className="mt-auto flex items-center gap-3 font-manrope text-xs text-[#6B7280]">
          <span>{formatPostDate(post.publishedAt)}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {post.readMinutes} min read
          </span>
        </div>
      </div>
    </article>
  </Link>
);

export default BlogCard;
