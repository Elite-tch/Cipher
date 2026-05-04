'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookmarkIcon, 
  RotateCwIcon,
  SearchIcon
} from 'lucide-react';
import { useCipherID } from '@/hooks/useCipherID';
import { LogosExecutionZone } from '@/lib/logos-ez';
import { WakuPost, fetchWakuTips, initWaku, subscribeToTips } from '@/lib/waku';
import PostCard from '@/components/PostCard';
import { toast } from 'sonner';

export default function BookmarkedFeeds() {
  const { identity } = useCipherID();
  const [posts, setPosts] = useState<WakuPost[]>([]);
  const [allTips, setAllTips] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [unlockedPosts, setUnlockedPosts] = useState<string[]>([]);
  const [wakuStatus, setWakuStatus] = useState<'initializing' | 'syncing' | 'ready' | 'error'>('initializing');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!identity) return;
      setWakuStatus('syncing');

      try {
        await initWaku();
        if (!isMounted) return;

        // Fetch user metadata (bookmarks, unlocked) and all global posts
        const [allGlobalPosts, ledgerTips, userBookmarks, userUnlocked] = await Promise.all([
          LogosExecutionZone.getGlobalPosts(),
          LogosExecutionZone.getGlobalTips(),
          LogosExecutionZone.getMetadata(identity.npk, 'bookmarks') || [],
          LogosExecutionZone.getMetadata(identity.npk, 'unlocked_posts') || []
        ]);

        const historicalTips = await fetchWakuTips();

        if (isMounted) {
          // Only show posts that are in the user's bookmarks
          const bookmarkedPosts = allGlobalPosts.filter((p: any) => userBookmarks.includes(p.id));
          
          setPosts(bookmarkedPosts);
          setBookmarks(userBookmarks);
          setUnlockedPosts(userUnlocked);
          setAllTips(prev => {
            const mergedMap = new Map();
            [...prev, ...ledgerTips, ...historicalTips].forEach(t => {
              const key = `${t.postId}-${t.sender}-${t.timestamp}`;
              if (!mergedMap.has(key)) mergedMap.set(key, t);
            });
            return Array.from(mergedMap.values());
          });
          setWakuStatus('ready');
        }

        // Real-time Tips sync
        const unsubTips = await subscribeToTips((newTip) => {
          if (!isMounted) return;
          setAllTips(prev => {
            const key = `${newTip.postId}-${newTip.sender}-${newTip.timestamp}`;
            if (prev.some(t => `${t.postId}-${t.sender}-${t.timestamp}` === key)) return prev;
            return [...prev, newTip];
          });
        });

        return unsubTips;
      } catch (e) {
        console.error('[BookmarkedFeeds] Sync failed', e);
        if (isMounted) setWakuStatus('error');
      }
    }

    const unsubTipsPromise = loadData();

    // Auto-sync interval
    const interval = setInterval(async () => {
      if (!isMounted || !identity) return;
      try {
        const [allGlobalPosts, ledgerTips, userBookmarks] = await Promise.all([
          LogosExecutionZone.getGlobalPosts(),
          LogosExecutionZone.getGlobalTips(),
          LogosExecutionZone.getMetadata(identity.npk, 'bookmarks') || []
        ]);

        const bookmarkedPosts = allGlobalPosts.filter((p: any) => userBookmarks.includes(p.id));
        setPosts(bookmarkedPosts);
        setBookmarks(userBookmarks);
        
        setAllTips(prev => {
          const mergedMap = new Map();
          [...prev, ...ledgerTips].forEach(t => {
            const key = `${t.postId}-${t.sender}-${t.timestamp}`;
            if (!mergedMap.has(key)) mergedMap.set(key, t);
          });
          return Array.from(mergedMap.values());
        });
      } catch (e) {
        console.warn('[BookmarkedFeeds] Polling sync failed');
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      unsubTipsPromise.then(unsub => unsub?.());
    };
  }, [identity]);

  const handleBookmark = async (post: WakuPost) => {
    if (!identity) return;
    const isBookmarked = bookmarks.includes(post.id);
    const updated = isBookmarked 
      ? bookmarks.filter(id => id !== post.id)
      : [...bookmarks, post.id];
    
    setBookmarks(updated);
    if (!isBookmarked) {
        toast.success('Added to Bookmarks');
    } else {
        toast('Removed from Bookmarks');
        // Optimistically remove from list
        setPosts(prev => prev.filter(p => p.id !== post.id));
    }
    
    await LogosExecutionZone.saveMetadata(identity.npk, 'bookmarks', updated);
  };

  const filteredPosts = posts.filter(p => 
    p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.authorAlias?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!identity) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 glass-card border-white/5">
        <BookmarkIcon className="w-12 h-12 text-white/10" />
        <h3 className="text-white/40 font-mono text-xs uppercase tracking-[0.3em]">Identity Required</h3>
        <p className="text-[10px] text-white/20 uppercase">Please connect your Cipher ID to view saved transmissions</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <BookmarkIcon className="w-4 h-4" />
          </div>
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-[0.3em]">Saved Transmissions</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="SEARCH BOOKMARKS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2 text-[10px] font-mono text-white outline-none focus:border-primary/40 transition-all w-48 focus:w-64"
            />
          </div>
          <button onClick={() => window.location.reload()} className="text-[10px] font-mono text-white/30 hover:text-white transition-colors flex items-center gap-2">
            <RotateCwIcon className="w-3 h-3" /> REFRESH
          </button>
        </div>
      </div>

      {posts.length === 0 && wakuStatus === 'ready' ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-6 glass-card border-dashed border-white/10">
          <div className="relative">
            <BookmarkIcon className="w-16 h-16 text-white/5" />
            <motion.div 
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <BookmarkIcon className="w-16 h-16 text-primary/20 blur-xl" />
            </motion.div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Vault Empty</h3>
            <p className="text-[10px] text-white/30 uppercase tracking-widest max-w-[240px] leading-relaxed">
              Your sovereign archive is empty. Bookmark transmissions in the discovery feed to save them here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                identity={identity}
                allTips={allTips}
                posts={posts} // For comments
                unlockedPosts={unlockedPosts}
                bookmarks={bookmarks}
                onBookmark={handleBookmark}
                onTip={async (p, amt) => {
                    const tip = {
                        postId: p.id,
                        sender: identity.npk,
                        recipient: p.authorNpk || p.author,
                        amount: amt.toString(),
                        timestamp: Date.now()
                    };
                    await LogosExecutionZone.transferTokens(identity.npk, p.authorNpk || p.author, amt, true);
                    await LogosExecutionZone.saveGlobalTip(tip);
                    setAllTips(prev => [...prev, tip]);
                }}
                onMessageAuthor={(p) => {}}
                onShare={() => {}}
                onDelete={async (id) => {
                    await LogosExecutionZone.deleteGlobalPost(id);
                    setPosts(prev => prev.filter(p => p.id !== id));
                }}
                onEdit={async (id, content) => {
                    await LogosExecutionZone.editGlobalPost(id, content);
                    setPosts(prev => prev.map(p => p.id === id ? { ...p, content, isEdited: true } : p));
                }}
                filterType="bookmarked"
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
