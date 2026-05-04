'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ImageIcon, GiftIcon, LockIcon, UnlockIcon, MessageSquareIcon, SparklesIcon, LinkIcon, BookmarkIcon, KeyRoundIcon, SendIcon } from 'lucide-react';
import { useCipherID } from '@/hooks/useCipherID';
import { LogosExecutionZone } from '@/lib/logos-ez';
import { buyKey, hasKey, getKeyState, calculateKeyPrice } from '@/lib/keys';
import { uploadToCodex, getCodexUrl, isCodexCid } from '@/lib/codex';

import {
  initWaku,
  broadcastPost,
  fetchWakuPosts,
  subscribeToFeed,
  WakuPost,
  WakuTip,
  broadcastTip,
  fetchWakuTips,
  subscribeToTips,
} from '@/lib/waku';
import { decryptData } from '@/lib/encryption';
import { RotateCwIcon, PlusIcon, Edit3Icon, Trash2Icon, GlobeIcon, SearchIcon } from 'lucide-react';
import PostCard from '@/components/PostCard';



const BOOKMARKS_KEY = 'cipher_bookmarks_v1';
const UNLOCKED_KEY = 'cipher_unlocked_v1';

export default function Feed({ filterType = 'all' }: { filterType?: 'all' | 'my' | 'bookmarked' }) {
  const { identity } = useCipherID();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All state is sourced from the Logos Waku network only — no localStorage
  const [posts, setPosts] = useState<WakuPost[]>([]);
  const [allTips, setAllTips] = useState<any[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showComposer, setShowComposer] = useState(filterType === 'all'); // Only show by default in the main feed
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const [tippingId, setTippingId] = useState<string | null>(null);
  const [buyingKeyId, setBuyingKeyId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [wakuStatus, setWakuStatus] = useState<'connecting' | 'ready' | 'error' | 'syncing'>('connecting');

  const [showRedPacketInput, setShowRedPacketInput] = useState(false);
  const [redPacketAmount, setRedPacketAmount] = useState('');

  // Bookmarks and unlocked posts are persisted in localStorage
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [unlockedPosts, setUnlockedPosts] = useState<string[]>([]);
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const [commentContents, setCommentContents] = useState<Record<string, string>>({});
  const [peers, setPeers] = useState<{ filter: number, store: number, push: number }>({ filter: 0, store: 0, push: 0 });

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const node = await initWaku();
        if (node) {
          const allPeers = node.libp2p.getPeers();
          setPeers({
            filter: allPeers.length, // Fallback to total peers for UI status
            store: allPeers.length,
            push: allPeers.length
          });
        }
      } catch (e) { }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribePosts: (() => void) | null = null;
    let unsubscribeTips: (() => void) | null = null;

    // Load persistent state from Logos Network
    async function loadLogosState() {
      if (!identity) return;
      try {
        const remoteBookmarks = await LogosExecutionZone.getMetadata(identity.npk, 'bookmarks');
        if (remoteBookmarks && isMounted) setBookmarks(remoteBookmarks);

        const remoteUnlocked = await LogosExecutionZone.getMetadata(identity.npk, 'unlocked');
        if (remoteUnlocked && isMounted) setUnlockedPosts(remoteUnlocked);
      } catch (e) {
        console.error('[Logos-LEZ] Failed to load remote metadata');
      }
    }
    loadLogosState();

    async function setupWaku() {
      try {
        await initWaku();
        if (!isMounted) return;

        setWakuStatus('syncing');

        // GLOBAL FEED PERSISTENCE: Fetch from Logos Ledger (LEZ)
        const historicalPosts = await LogosExecutionZone.getGlobalPosts();
        const historicalTips = await fetchWakuTips();

        if (isMounted) {
          setAllTips((prev) => {
            const mergedMap = new Map();
            [...prev, ...historicalTips].forEach(t => {
              const key = `${t.postId}-${t.sender}-${t.timestamp}`;
              if (!mergedMap.has(key)) mergedMap.set(key, t);
            });
            const merged = Array.from(mergedMap.values());
            return merged;
          });
          setPosts((prevPosts) => {
            const mergedMap = new Map<string, WakuPost>();
            [...prevPosts, ...historicalPosts].forEach(p => {
              if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
            });
            const merged = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
            return merged;
          });
          setWakuStatus('ready');
        }

        // Subscribe to real-time new posts from the Logos network
        unsubscribePosts = await subscribeToFeed((newPost) => {
          if (!isMounted) return;
          setPosts((prev) => {
            if (prev.find((p) => p.id === newPost.id)) return prev;
            const updated = [newPost, ...prev].sort((a, b) => b.timestamp - a.timestamp);
            return updated;
          });
        });

        // Subscribe to real-time tips
        unsubscribeTips = await subscribeToTips((newTip) => {
          if (!isMounted) return;
          console.log('[Logos] Real-time tip received:', newTip.postId);
          setAllTips(prev => {
            const key = `${newTip.postId}-${newTip.sender}-${newTip.timestamp}`;
            if (prev.some(t => `${t.postId}-${t.sender}-${t.timestamp}` === key)) return prev;
            const updated = [...prev, newTip];
            return updated;
          });
        });

      } catch (err) {
        console.error('[Logos] Fatal connection error:', err);
        if (isMounted) setWakuStatus('error');
      }
    }

    setupWaku();

    // LEDGER & WAKU POLLING FALLBACK: Ensures sync even if Waku real-time lags
    const syncInterval = setInterval(async () => {
      if (!isMounted || !identity) return;
      try {
        const [remotePosts, ledgerTips, wakuTips, remoteBookmarks] = await Promise.all([
          LogosExecutionZone.getGlobalPosts(),
          LogosExecutionZone.getGlobalTips(),
          fetchWakuTips(),
          LogosExecutionZone.getMetadata(identity.npk, 'bookmarks')
        ]);

        if (remotePosts.length > 0) {
          setPosts(prev => {
            const mergedMap = new Map<string, WakuPost>();
            [...remotePosts, ...prev].forEach(p => {
              if (p.id && !mergedMap.has(p.id)) mergedMap.set(p.id, p);
            });
            return Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
          });
        }

        if (remoteBookmarks && isMounted) {
          setBookmarks(remoteBookmarks);
        }

        const allRemoteTips = [...ledgerTips, ...wakuTips];
        if (allRemoteTips.length > 0) {
          setAllTips(prev => {
            const mergedMap = new Map();
            [...prev, ...allRemoteTips].forEach(t => {
              const key = `${t.postId}-${t.sender}-${t.timestamp}`;
              if (!mergedMap.has(key)) mergedMap.set(key, t);
            });
            return Array.from(mergedMap.values());
          });
        }
      } catch (e) {
        console.warn('[Logos-Sync] Polling failed');
      }
    }, 5000);

    return () => {
      isMounted = false;
      unsubscribePosts?.();
      unsubscribeTips?.();
      clearInterval(syncInterval);
    };
  }, [identity]);

  const handleRefresh = async () => {
    setWakuStatus('syncing');
    const historicalPosts = await LogosExecutionZone.getGlobalPosts();
    const historicalTips = await fetchWakuTips();

    setPosts(prev => {
      const mergedMap = new Map<string, WakuPost>();
      [...prev, ...historicalPosts].forEach(p => {
        if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
      });
      return Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    });

    setAllTips(prev => {
      const mergedMap = new Map();
      [...prev, ...historicalTips].forEach(t => {
        const key = `${t.postId}-${t.sender}-${t.timestamp}`;
        if (!mergedMap.has(key)) mergedMap.set(key, t);
      });
      return Array.from(mergedMap.values());
    });

    setWakuStatus('ready');
    toast.success('Feed updated');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 4 - selectedImages.length;
    if (remaining <= 0) return toast.error('Maximum 4 images per post.');

    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) toast.warning(`Only ${remaining} more image(s) allowed. Taking the first ${remaining}.`);

    setUploadingImages(true);
    const toastId = toast.loading(`Uploading ${toUpload.length} image(s) to Codex...`);
    try {
      const cids = await Promise.all(
        toUpload.map(file => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const cid = await uploadToCodex(reader.result as string);
              resolve(cid);
            } catch (err) { reject(err); }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      setSelectedImages(prev => [...prev, ...cids].slice(0, 4));
      toast.success(`${cids.length} image(s) uploaded.`, { id: toastId });
    } catch (err) {
      toast.error('One or more uploads failed.', { id: toastId });
    } finally {
      setUploadingImages(false);
      // Reset file input so same files can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreatePost = async () => {
    if (!identity) return alert('Please Connect ID first!');
    if (!newPostContent.trim() && selectedImages.length === 0) return;

    const newPost: WakuPost = {
      id: Math.random().toString(36).substring(7) + Date.now(),
      author: identity.peerId,
      authorNpk: identity.npk,
      authorAlias: identity.alias,
      content: newPostContent,
      timestamp: Date.now(),
      tips: 0,
      keyPrice: 0.01,
      imageUrl: selectedImages[0] || undefined,
      imageUrls: selectedImages.length > 0 ? selectedImages : undefined,
    };

    // Optimistic UI update (will be confirmed by Waku Store on next fetch)
    setPosts((prev) => {
      const updated = [newPost, ...prev].sort((a, b) => b.timestamp - a.timestamp);
      return updated;
    });
    // GLOBAL FEED PERSISTENCE: Save to Logos Ledger (LEZ) first
    try {
      await LogosExecutionZone.saveGlobalPost(newPost);
    } catch (e) {
      console.error('[Logos-LEZ] Failed to persist post to ledger');
    }

    setNewPostContent('');
    setSelectedImages([]);

    // Real-time Gossip: Broadcast to the Logos Waku network
    try {
      console.log('[Logos] Broadcasting to Mixnet...');
      await broadcastPost(newPost);
    } catch (err) {
      console.error('[Logos] Broadcast failed:', err);
    }

    if (filterType === 'my') {
      setShowComposer(false);
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
      senderAlias: identity.alias,
      recipientAlias: post.authorAlias,
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

  const handleDeletePost = async (postId: string) => {
    const toastId = toast.loading('Deleting...');
    try {
      await LogosExecutionZone.deleteGlobalPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success('Post deleted', { id: toastId });
    } catch (e) {
      toast.error('Failed to delete', { id: toastId });
    }
  };

  const handleEditPost = async (postId: string, newContent: string) => {
    const toastId = toast.loading('Updating...');
    try {
      await LogosExecutionZone.editGlobalPost(postId, newContent);
      setPosts(prev => prev.map(p => p.id === postId ? { 
        ...p, 
        content: newContent, 
        isEdited: true 
      } : p));
      setEditingPostId(null);
      toast.success('Post updated', { id: toastId });
    } catch (e) {
      toast.error('Failed to update', { id: toastId });
    }
  };

  const handleBookmark = async (post: WakuPost) => {
    if (!identity) return;
    const isBookmarked = bookmarks.includes(post.id);
    const updated = isBookmarked
      ? bookmarks.filter(id => id !== post.id)
      : [...bookmarks, post.id];

    setBookmarks(updated);
    
    if (filterType === 'bookmarked' && isBookmarked) {
        setPosts(prev => prev.filter(p => p.id !== post.id));
    }

    await LogosExecutionZone.saveMetadata(identity.npk, 'bookmarks', updated);
    await LogosExecutionZone.updateGlobalBookmarkCount(post.id, !isBookmarked);
    
    if (isBookmarked) {
      toast('Removed from Bookmarks');
    } else {
      toast.success('Added to Bookmarks');
    }
  };

  const handleClaimRedPacket = async (post: WakuPost) => {
    if (!identity) return toast.error('Connect ID first');
    setClaimingId(post.id);
    
    setTimeout(async () => {
      setPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          return {
            ...p,
            redPacket: { ...p.redPacket!, isClaimed: true }
          };
        }
        return p;
      }));
      setClaimingId(null);
      alert(`🧧 Red Packet Claimed! You received a random share`);
    }, 1500);
  };

  const handleCreateComment = async (parentId: string, content: string) => {
    if (!identity) return toast.error('Connect ID first');
    if (!content.trim()) return;

    const newComment: WakuPost = {
      id: Math.random().toString(36).substring(7) + Date.now(),
      author: identity.peerId,
      authorNpk: identity.npk,
      authorAlias: identity.alias,
      content,
      timestamp: Date.now(),
      parentId,
      tips: 0,
      keyPrice: 0.01
    };

    setPosts(prev => {
      const updated = [newComment, ...prev];
      return updated.sort((a, b) => b.timestamp - a.timestamp);
    });
    setCommentContents(prev => ({ ...prev, [parentId]: '' }));

    try {
      await LogosExecutionZone.saveGlobalPost(newComment);
      await broadcastPost(newComment);
    } catch (err) {
      console.error('[Comment] broadcast failed:', err);
    }
  };

  const handleBuyKey = async (post: WakuPost) => {
    if (!identity) return alert('Please Connect ID first!');
    setBuyingKeyId(post.id);
    try {
      const result = await buyKey(post.author, identity.publicKey);
      if (result.success) {
        setUnlockedPosts(prev => {
          const updated = [...prev, post.id];
          if (identity) LogosExecutionZone.saveMetadata(identity.npk, 'unlocked', updated);
          return updated;
        });
        toast.success('Key acquired.');
      }
    } catch (err) {
      toast.error('Could not acquire key.');
    } finally {
      setBuyingKeyId(null);
    }
  };

  const handleMessageAuthor = async (post: WakuPost) => {
    if (!identity) return toast.error('Connect ID first');
    try {
      const remoteChats = await LogosExecutionZone.getMetadata(identity.npk, 'active_chats') || [];
      if (!remoteChats.includes(post.author)) {
        const updated = [...remoteChats, post.author];
        await LogosExecutionZone.saveMetadata(identity.npk, 'active_chats', updated);
      }
      router.push(`/dashboard/chats?user=${post.author}`);
    } catch (e) {
      router.push(`/dashboard/chats?user=${post.author}`);
    }
  };

  const handleShare = async (post: WakuPost) => {
    const shareText = `Check out this post on Cipher Network by ${post.authorAlias}:\n\n"${post.isLocked ? '[Locked Content]' : post.content}"\n\nBuy their Key to unlock!`;
    try {
      await navigator.clipboard.writeText(shareText);
      alert('Post copied to clipboard!');
    } catch (err) { }
  };

  const rootPosts = posts.filter(p => !p.parentId).filter(p => {
    if (filterType === 'my') return p.author === identity?.npk;
    if (filterType === 'bookmarked') return bookmarks.includes(p.id);
    return true;
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">

      {/* Network Status */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.2em] uppercase">
          <span className={`h-1.5 w-1.5 rounded-full ${wakuStatus === 'ready' ? 'bg-success shadow-[0_0_6px_rgba(16,185,129,0.8)]' : wakuStatus === 'error' ? 'bg-red-500' : wakuStatus === 'syncing' ? 'bg-secondary animate-pulse shadow-[0_0_6px_rgba(0,245,255,0.4)]' : 'bg-white/20 animate-pulse'}`} />
          <span className="text-white/70">
            <span className={wakuStatus === 'ready' ? 'text-success font-bold' : wakuStatus === 'error' ? 'text-red-500 font-bold' : 'text-secondary font-bold'}>
              {wakuStatus === 'ready' ? 'Connected' : wakuStatus === 'syncing' ? 'Syncing...' : wakuStatus === 'error' ? 'Offline' : 'Initializing...'}
            </span>
          </span>
        </div>

        <button
          onClick={handleRefresh}
          disabled={wakuStatus === 'syncing'}
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-white/50 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest disabled:opacity-50"
        >
          <RotateCwIcon className={`w-3 h-3 ${wakuStatus === 'syncing' ? 'animate-spin' : ''}`} />
          Refresh Feed
        </button>
      </div>

      {/* Create Post Toggle (only in My Posts) */}
      {filterType === 'my' && !showComposer && (
        <button
          onClick={() => setShowComposer(true)}
          className="w-full py-8 glass-card border-dashed border-white/10 hover:border-primary/40 flex flex-col items-center justify-center gap-3 group transition-all"
        >
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <PlusIcon className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-white/40 uppercase tracking-[0.3em]">Create New Post</span>
        </button>
      )}

      {/* Create Post Area */}
      {showComposer && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card p-6 space-y-4 border-primary/20 focus-within:border-primary/40 transition-all duration-500 relative">
          {filterType === 'my' && (
            <button
              onClick={() => setShowComposer(false)}
              className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-primary italic text-sm glass shadow-[0_0_10px_rgba(124,58,237,0.3)] flex-shrink-0">
              {identity?.alias?.split('#')[1]?.substring(0, 2) ?? '?'}
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's happening?"
                className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-white placeholder:text-white/20 resize-none min-h-[100px] font-body text-sm py-2 no-scrollbar"
              />
              {/* Multi-image preview row */}
              {selectedImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-white/[0.05] flex-shrink-0">
                      <img src={isCodexCid(img) ? getCodexUrl(img) : img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover brightness-110" />
                      <button
                        onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 bg-black/80 hover:bg-red-500/80 rounded-full p-0.5 text-[8px] text-white transition-colors leading-none"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImages || selectedImages.length >= 4}
                className="text-white/70 hover:text-white transition-all disabled:opacity-30 flex items-center gap-1.5"
              >
                <ImageIcon className="w-5 h-5" />
                {selectedImages.length > 0 && <span className="text-[9px] font-mono text-white/40">{selectedImages.length}/4</span>}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
            </div>
            <button 
              onClick={handleCreatePost} 
              disabled={(!newPostContent.trim() && selectedImages.length === 0) || uploadingImages}
              className="px-8 py-3 rounded-2xl gradient-primary text-white text-[11px] font-bold tracking-[0.2em] hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2 group"
            >
              {uploadingImages ? 'UPLOADING...' : (
                <>
                  POST <SendIcon className="w-3 h-3 -rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {wakuStatus === 'connecting' && rootPosts.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <div className="text-4xl animate-pulse">◌</div>
          <p className="text-white/20 font-mono text-xs uppercase tracking-widest">Connecting to Network...</p>
        </div>
      )}

      {filterType === 'bookmarked' && rootPosts.length === 0 && (
        <div className="text-center space-y-2 py-10">
          <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Saved empty</h3>
          <p className="text-[10px] text-white/30 uppercase tracking-widest max-w-[240px] leading-relaxed mx-auto">
            Your archive is empty. Bookmark posts in the feed to save them here.
          </p>
        </div>
      )}

      {/* Posts List */}
      <AnimatePresence mode="popLayout">
        {rootPosts.map((post) => (
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
            tippingId={tippingId}
            buyingKeyId={buyingKeyId}
            onTip={handleTip}
            onMessageAuthor={handleMessageAuthor}
            onBookmark={handleBookmark}
            onShare={handleShare}
            onToggleComments={(id) => setActiveCommentPost(activeCommentPost === id ? null : id)}
            onCommentChange={(id, val) => setCommentContents(prev => ({ ...prev, [id]: val }))}
            onCommentSubmit={(parentId) => handleCreateComment(parentId, commentContents[parentId])}
            onImageClick={(url) => setLightboxUrl(url)}
            onBuyKey={() => handleBuyKey(post)}
            onDelete={handleDeletePost}
            onEdit={handleEditPost}
            filterType={filterType}
          />
        ))}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-xl cursor-zoom-out"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <motion.img
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              src={lightboxUrl}
              alt="Full view"
              className="max-w-[92vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-5 right-5 h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all text-sm"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
