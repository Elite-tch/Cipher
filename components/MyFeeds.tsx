'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  RotateCwIcon,
  ImageIcon,
  GiftIcon
} from 'lucide-react';
import { useCipherID } from '@/hooks/useCipherID';
import { LogosExecutionZone } from '@/lib/logos-ez';
import { WakuPost, broadcastPost, fetchWakuTips, subscribeToFeed, subscribeToTips, initWaku, broadcastTip } from '@/lib/waku';
import PostCard from '@/components/PostCard';
import { toast } from 'sonner';

export default function MyFeeds() {
  const { identity } = useCipherID();
  const [posts, setPosts] = useState<WakuPost[]>([]);
  const [wakuStatus, setWakuStatus] = useState<'initializing' | 'syncing' | 'ready' | 'error'>('initializing');
  const [showComposer, setShowComposer] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // States for PostCard interactions
  const [allTips, setAllTips] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [unlockedPosts, setUnlockedPosts] = useState<string[]>([]);
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const [commentContents, setCommentContents] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!identity) return;
      setWakuStatus('syncing');

      try {
        await initWaku();
        if (!isMounted) return;

        // Fetch MY posts and ALL tips from the ledger for accuracy
        const [allGlobalPosts, ledgerTips] = await Promise.all([
          LogosExecutionZone.getGlobalPosts(),
          LogosExecutionZone.getGlobalTips()
        ]);
        
        const myPosts = allGlobalPosts.filter((p: any) => p.authorNpk === identity.npk);
        const historicalTips = await fetchWakuTips();
        const userBookmarks = await LogosExecutionZone.getMetadata(identity.npk, 'bookmarks') || [];
        const userUnlocked = await LogosExecutionZone.getMetadata(identity.npk, 'unlocked_posts') || [];

        if (isMounted) {
          setPosts(myPosts);
          setAllTips(prev => {
            const mergedMap = new Map();
            [...prev, ...ledgerTips, ...historicalTips].forEach(t => {
              const key = `${t.postId}-${t.sender}-${t.timestamp}`;
              if (!mergedMap.has(key)) mergedMap.set(key, t);
            });
            return Array.from(mergedMap.values());
          });
          setBookmarks(userBookmarks);
          setUnlockedPosts(userUnlocked);
          setWakuStatus('ready');
        }

        // Real-time Tips
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
        console.error('[MyFeeds] Sync failed', e);
        if (isMounted) setWakuStatus('error');
      }
    }

    const unsubTipsPromise = loadData();

    // Auto-sync interval
    const interval = setInterval(async () => {
      if (!isMounted || !identity) return;
      try {
        const [allGlobalPosts, ledgerTips, wakuTips] = await Promise.all([
          LogosExecutionZone.getGlobalPosts(),
          LogosExecutionZone.getGlobalTips(),
          fetchWakuTips()
        ]);

        const myPosts = allGlobalPosts.filter((p: any) => p.authorNpk === identity.npk);
        setPosts(myPosts);

        setAllTips(prev => {
          const mergedMap = new Map();
          [...prev, ...ledgerTips, ...wakuTips].forEach(t => {
            const key = `${t.postId}-${t.sender}-${t.timestamp}`;
            if (!mergedMap.has(key)) mergedMap.set(key, t);
          });
          return Array.from(mergedMap.values());
        });
      } catch (e) {
        console.warn('[MyFeeds] Polling sync failed');
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      unsubTipsPromise.then(unsub => unsub?.());
    };
  }, [identity]);

  const handleCreatePost = async () => {
    if (!identity) return toast.error('Identity not connected');
    if (!newPostContent.trim() && selectedImages.length === 0) return;

    const newPost: WakuPost = {
      id: Math.random().toString(36).substring(7) + Date.now(),
      author: identity.peerId,
      authorNpk: identity.npk,
      authorAlias: identity.alias,
      content: newPostContent,
      timestamp: Date.now(),
      tips: 0,
      keyPrice: 0.01, // Default
      imageUrls: selectedImages.length > 0 ? selectedImages : undefined,
    };

    const toastId = toast.loading('Publishing to Logos Ledger...');
    try {
      await LogosExecutionZone.saveGlobalPost(newPost);
      setPosts(prev => [newPost, ...prev]);
      setNewPostContent('');
      setSelectedImages([]);
      setShowComposer(false);
      toast.success('Transmission Live', { id: toastId });

      // Background gossip
      broadcastPost(newPost).catch(() => { });
    } catch (e) {
      toast.error('Publishing failed', { id: toastId });
    }
  };

  const handleTip = async (post: WakuPost, amount: number) => {
    if (!identity) return toast.error('Identity not connected');
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    
    const recipientAccount = post.authorNpk || post.author;
    const tip: any = {
      postId: post.id,
      sender: identity.npk,
      recipient: recipientAccount,
      amount: amount.toString(),
      timestamp: Date.now(),
    };

    const toastId = toast.loading('Sending tip on Logos Ledger...');
    try {
      await LogosExecutionZone.transferTokens(identity.npk, recipientAccount, amount, true);
      await LogosExecutionZone.saveGlobalTip(tip);
      await broadcastTip(tip);
      setAllTips(prev => [...prev, tip]);
      toast.success('Tip Sent', { id: toastId });
    } catch (e) {
      toast.error('Tip failed', { id: toastId });
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this transmission?')) return;
    try {
      await LogosExecutionZone.deleteGlobalPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success('Deleted');
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const handleEdit = async (postId: string, content: string) => {
    try {
      await LogosExecutionZone.editGlobalPost(postId, content);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, content, isEdited: true } : p));
      toast.success('Updated');
    } catch (e) {
      toast.error('Update failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Status */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-[0.3em]">My Transmissions</h2>
        <div className="flex items-center gap-4">
          <span className={`h-1.5 w-1.5 rounded-full ${wakuStatus === 'ready' ? 'bg-success shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-secondary animate-pulse'}`} />
          <button onClick={() => window.location.reload()} className="text-[10px] font-mono text-white/30 hover:text-white transition-colors flex items-center gap-2">
            <RotateCwIcon className="w-3 h-3" /> REFRESH
          </button>
        </div>
      </div>


      <div className='flex justify-end'>
        {/* Toggle Button */}
        {!showComposer && (
          <button
            onClick={() => setShowComposer(true)}
            className="w-fit py-3 bg-primary glass-card border-dashed border-white/10 hover:border-primary/40 flex items-center justify-center gap- group transition-all"
          >
            <div className="h-6 w-6 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <PlusIcon className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-[0.3em]">Create Feeds</span>
          </button>
        )}
      </div>

      {/* Composer */}
      {showComposer && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card p-6 space-y-4 border-primary/20 relative">
          <button onClick={() => setShowComposer(false)} className="absolute top-4 right-4 text-white/20 hover:text-white">✕</button>
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-primary italic text-sm">
              {identity?.alias?.split('#')[1]?.substring(0, 2) ?? '?'}
            </div>
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="What's happening in your sovereign space?"
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20 resize-none min-h-[100px] text-sm py-2"
            />
          </div>
          <div className="flex justify-end pt-2 border-t border-white/5">
            <button onClick={handleCreatePost} className="px-6 py-2 rounded-full gradient-primary text-white text-[10px] font-bold tracking-widest hover:scale-105 shadow-lg">PUBLISH</button>
          </div>
        </motion.div>
      )}

      {/* List */}
      <AnimatePresence mode="popLayout">
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            identity={identity}
            allTips={allTips}
            posts={posts}
            unlockedPosts={unlockedPosts}
            bookmarks={bookmarks}
            activeCommentPost={activeCommentPost}
            commentContents={commentContents}
            tippingId={null}
            onTip={handleTip}
            onMessageAuthor={() => { }}
            onBookmark={() => { }}
            onShare={() => { }}
            onToggleComments={(id) => setActiveCommentPost(activeCommentPost === id ? null : id)}
            onCommentChange={(id, val) => setCommentContents(prev => ({ ...prev, [id]: val }))}
            onCommentSubmit={() => { }}
            onImageClick={() => { }}
            onBuyKey={() => { }}
            onDelete={handleDelete}
            onEdit={handleEdit}
            filterType="my"
          />
        ))}
      </AnimatePresence>

      {posts.length === 0 && wakuStatus === 'ready' && (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
          <p className="text-white/20 font-mono text-[10px] uppercase tracking-widest">No transmissions found in your sovereign ledger.</p>
        </div>
      )}
    </div>
  );
}
