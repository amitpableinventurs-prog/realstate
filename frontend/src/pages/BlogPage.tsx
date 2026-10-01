import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import LoadingState from '../components/common/LoadingState';
import BlogCard from '../components/blog/BlogCard';
import { blogAPI, type BlogPostSummary } from '../services/api';
import { useSEO } from '../hooks/useSEO';

const PAGE_SIZE = 9;

const BlogPage: React.FC = () => {
  useSEO({
    title: 'Blog — Property & Land Buying Guides',
    description: 'Guides on buying land, checking Khata and Khasra records, home loans and the Indian property market from the Bhumi Bazar team.',
  });

  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [category, setCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // First page whenever the filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    blogAPI
      .list({ category: category || undefined, q: query || undefined, page: 1, limit: PAGE_SIZE })
      .then(({ data }) => {
        if (cancelled) return;
        setPosts(data.posts);
        setCategories(data.categories);
        setPage(1);
        setTotalPages(data.pagination.totalPages);
      })
      .catch(() => !cancelled && setError('Failed to load articles. Please try again later.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [category, query]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await blogAPI.list({
        category: category || undefined, q: query || undefined, page: page + 1, limit: PAGE_SIZE,
      });
      setPosts((prev) => [...prev, ...data.posts]);
      setPage(page + 1);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setError('Failed to load more articles.');
    } finally {
      setLoadingMore(false);
    }
  };

  // The featured article gets the large card on the unfiltered view
  const showFeatured = !category && !query && posts[0]?.isFeatured;
  const featured = showFeatured ? posts[0] : null;
  const gridPosts = showFeatured ? posts.slice(1) : posts;
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const chipClass = (active: boolean) =>
    `shrink-0 font-manrope text-sm px-4 py-2 rounded-full border transition-colors ${
      active
        ? 'bg-[#1A0A1E] text-white border-[#1A0A1E]'
        : 'bg-white text-[#374151] border-[#E8E1EA] hover:border-[#A3078F] hover:text-[#A3078F]'
    }`;

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#F9F7FA] border-b border-[rgba(232,225,234,0.5)] py-16 md:py-20">
        <div className="max-w-[1280px] mx-auto px-6 md:px-8 text-center">
          <span className="font-space-mono text-xs text-[#A3078F] uppercase tracking-widest">
            Insights & Guides
          </span>
          <h1 className="font-fraunces text-4xl md:text-6xl text-[#1A0A1E] mt-4 mb-6">The Bhumi Bazar Blog</h1>
          <p className="font-manrope text-lg text-[#4B5563] leading-relaxed max-w-[672px] mx-auto">
            Practical advice on buying, selling and renting property and land in India, from checking
            records to getting the right loan.
          </p>
        </div>
      </section>

      <main className="max-w-[1280px] mx-auto px-6 md:px-8 py-12">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-10">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-1">
            <button type="button" onClick={() => setCategory('')} className={chipClass(!category)}>
              All {totalCount > 0 && <span className="opacity-60">({totalCount})</span>}
            </button>
            {categories.map((c) => (
              <button key={c.name} type="button" onClick={() => setCategory(c.name)} className={chipClass(category === c.name)}>
                {c.name} <span className="opacity-60">({c.count})</span>
              </button>
            ))}
          </div>
          <label className="relative lg:w-72">
            <span className="sr-only">Search articles</span>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search articles"
              className="w-full font-manrope text-sm bg-white border border-[#E8E1EA] rounded-full pl-10 pr-4 py-2.5 outline-none focus:border-[#A3078F] focus:ring-2 focus:ring-[#A3078F]/15"
            />
          </label>
        </div>

        {loading && <LoadingState message="Loading articles…" />}

        {error && !loading && (
          <p className="font-manrope text-center text-[#B91C1C] py-16">{error}</p>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-20">
            <p className="font-fraunces text-2xl text-[#1A0A1E] mb-2">No articles found</p>
            <p className="font-manrope text-sm text-[#6B7280]">Try another category or search term.</p>
          </div>
        )}

        {!loading && !error && posts.length > 0 && (
          <>
            {featured && (
              <div className="mb-10">
                <BlogCard post={featured} featured />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {gridPosts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
            {page < totalPages && (
              <div className="text-center mt-12">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="font-manrope font-bold text-sm bg-white border border-[#1A0A1E] text-[#1A0A1E] px-8 py-3 rounded-xl hover:bg-[#1A0A1E] hover:text-white transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more articles'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BlogPage;
