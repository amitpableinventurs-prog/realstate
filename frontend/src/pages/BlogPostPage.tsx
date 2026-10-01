import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Link2, Check } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import LoadingState from '../components/common/LoadingState';
import ArticleBody from '../components/blog/ArticleBody';
import BlogCard, { formatPostDate } from '../components/blog/BlogCard';
import { blogAPI, type BlogPost, type BlogPostSummary } from '../services/api';
import { useSEO } from '../hooks/useSEO';

const BlogPostPage: React.FC = () => {
  const { slug = '' } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPostSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [copied, setCopied] = useState(false);

  useSEO({
    title: post?.title,
    description: post?.excerpt,
    image: post?.coverImage || undefined,
    type: 'article',
  });

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    blogAPI
      .getBySlug(slug)
      .then(({ data }) => {
        if (cancelled) return;
        setPost(data.post);
        setRelated(data.related);
        setStatus('ready');
      })
      .catch((err) => !cancelled && setStatus(err.response?.status === 404 ? 'not-found' : 'error'));
    return () => { cancelled = true; };
  }, [slug]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); nothing else to do
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <Navbar />

      {status === 'loading' && <LoadingState message="Loading article…" />}

      {(status === 'not-found' || status === 'error') && (
        <div className="text-center py-28 px-6">
          <p className="font-fraunces text-3xl text-[#1A0A1E] mb-3">
            {status === 'not-found' ? 'Article not found' : 'Something went wrong'}
          </p>
          <p className="font-manrope text-[#6B7280] mb-8">
            {status === 'not-found'
              ? 'It may have been moved or unpublished.'
              : 'We could not load this article. Please try again later.'}
          </p>
          <Link to="/blog" className="font-manrope font-bold text-white bg-[#A3078F] hover:bg-[#8E0A82] px-6 py-3 rounded-xl transition-colors">
            Back to blog
          </Link>
        </div>
      )}

      {status === 'ready' && post && (
        <>
          <article>
            <header className="max-w-[760px] mx-auto px-6 pt-10 md:pt-14">
              <Link to="/blog" className="inline-flex items-center gap-2 font-manrope text-sm text-[#6B7280] hover:text-[#A3078F] transition-colors mb-8">
                <ArrowLeft className="w-4 h-4" /> All articles
              </Link>
              <span className="block font-space-mono text-xs text-[#A3078F] uppercase tracking-widest mb-4">
                {post.category}
              </span>
              <h1 className="font-fraunces text-4xl md:text-5xl text-[#1A0A1E] leading-tight mb-6">{post.title}</h1>
              <p className="font-manrope text-lg text-[#4B5563] leading-relaxed mb-6">{post.excerpt}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-manrope text-sm text-[#6B7280] pb-8 border-b border-[#EDE7EF]">
                <span className="font-semibold text-[#1A0A1E]">{post.authorName}</span>
                <span aria-hidden="true">·</span>
                <span>{formatPostDate(post.publishedAt)}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" /> {post.readMinutes} min read</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="ml-auto inline-flex items-center gap-1.5 text-[#374151] hover:text-[#A3078F] transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {copied ? 'Link copied' : 'Copy link'}
                </button>
              </div>
            </header>

            {post.coverImage && (
              <div className="max-w-[1040px] mx-auto px-6 mt-10">
                <img
                  src={post.coverImage}
                  alt=""
                  className="w-full aspect-[16/8] object-cover rounded-2xl bg-[#E8E1EA]"
                />
              </div>
            )}

            <div className="max-w-[760px] mx-auto px-6 py-12">
              <ArticleBody content={post.content} />

              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-[#EDE7EF]">
                  {post.tags.map((tag) => (
                    <span key={tag} className="font-manrope text-xs text-[#374151] bg-[#F5F1F6] px-3 py-1.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div className="mt-12 bg-[#1A0A1E] rounded-2xl p-8 md:p-10 text-center">
                <p className="font-fraunces text-2xl md:text-3xl text-white mb-3">Ready to find your property?</p>
                <p className="font-manrope text-[#D1D5DB] mb-6">Browse verified homes, plots and land across India.</p>
                <Link to="/properties" className="inline-block font-manrope font-bold text-white bg-[#A3078F] hover:bg-[#8E0A82] px-7 py-3 rounded-xl transition-colors">
                  Browse properties
                </Link>
              </div>
            </div>
          </article>

          {related.length > 0 && (
            <section className="bg-[#FAF8FB] py-16">
              <div className="max-w-[1280px] mx-auto px-6 md:px-8">
                <h2 className="font-fraunces text-3xl text-[#1A0A1E] mb-8">Keep reading</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {related.map((p) => <BlogCard key={p.id} post={p} />)}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <Footer />
    </div>
  );
};

export default BlogPostPage;
