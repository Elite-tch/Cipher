'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquareIcon,
  SparklesIcon,
  LockIcon,
  SendIcon,
  LinkIcon,
  BookmarkIcon,
  Edit3Icon,
  Trash2Icon,
  RotateCwIcon,
  ImageIcon,
  UsersIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { WakuPost, WakuTip } from '@/lib/waku';
import { decryptData } from '@/lib/encryption';
import { LogosExecutionZone } from '@/lib/logos-ez';
import { hasKey, getKeyState, calculateKeyPrice } from '@/lib/keys';
import { getCodexUrl, isCodexCid } from '@/lib/codex';

interface PostCardProps {
  post: WakuPost;
  identity: any;
  allTips: any[];
  posts: WakuPost[];
  unlockedPosts: string[];
  bookmarks: string[];
  activeCommentPost?: string | null;
  commentContents: Record<string, string>;
  tippingId?: string | null;
  buyingKeyId?: string | null;
  onTip: (post: WakuPost, amount: number) => void;
  onMessageAuthor: (post: WakuPost) => void;
  onBookmark: (post: WakuPost) => void;
  onShare: (post: WakuPost) => void;
  onToggleComments: (postId: string) => void;
  onCommentChange: (postId: string, value: string) => void;
  onCommentSubmit: (parentId: string) => void;
  onImageClick: (url: string) => void;
  onBuyKey: (postId: string, price: number) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
  filterType?: 'all' | 'my' | 'bookmarked';
}

export default function PostCard({
  post, identity, allTips, posts, unlockedPosts, bookmarks,
  activeCommentPost, commentContents, tippingId, buyingKeyId,
  onTip, onMessageAuthor, onBookmark, onShare, onToggleComments,
  onCommentChange, onCommentSubmit, onImageClick, onBuyKey,
  onDelete, onEdit, filterType
}: PostCardProps) {
  // Role-based Access & State
  const relevantTips = allTips.filter((t: any) => t.postId === post.id);
  const [visibleTips, setVisibleTips] = useState<number>(0);
  const [supporterCount, setSupporterCount] = useState<number>(0);
  const [tipInputActive, setTipInputActive] = useState(false);
  const [tipAmount, setTipAmount] = useState('10');
  const tipInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0.01);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(post.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setEditValue(post.content);
  }, [post]);

  const TEXT_LIMIT = 280;

  const postComments = posts.filter((p: any) => p.parentId === post.id).sort((a: any, b: any) => a.timestamp - b.timestamp);

  // Focus the input when it becomes active
  useEffect(() => {
    if (tipInputActive) tipInputRef.current?.focus();
  }, [tipInputActive]);

  useEffect(() => {
    async function calculateTips() {
      if (!identity) {
        setVisibleTips(0);
        setSupporterCount(0);
        return;
      }

      // 1. Calculate Public Support Count (Unique Senders)
      const uniqueSenders = new Set(relevantTips.map(t => t.sender));
      setSupporterCount(uniqueSenders.size);

      // 2. Calculate Role-Based Amount Visibility
      let amountToShow = 0;
      const isAuthor = post.authorNpk === identity.npk;

      if (isAuthor) {
        // Recipient sees the total sum of all tips
        amountToShow = relevantTips.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
      } else {
        // Senders only see the total of what THEY sent
        const myTips = relevantTips.filter(t => t.sender === identity.npk);
        amountToShow = myTips.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
      }

      setVisibleTips(amountToShow);
    }
    calculateTips();
  }, [relevantTips, identity, post.id, post.authorNpk]);

  useEffect(() => {
    async function checkState() {
      if (!identity) return;
      const authorId = post.authorNpk || post.author;
      const isOwned = await hasKey(identity.npk, authorId);
      setIsUnlocked(isOwned);
      const state = await getKeyState(authorId);
      const price = calculateKeyPrice(state.supply);
      setCurrentPrice(price);
    }
    checkState();
  }, [post.id, identity]);

  const displayContent = post.isLocked && !isUnlocked 
    ? (post.content.length > 100 ? post.content.substring(0, 100) + "..." : post.content)
    : post.content;

  const hasMore = post.content.length > TEXT_LIMIT;
  const truncated = !isExpanded && hasMore ? post.content.slice(0, TEXT_LIMIT) + '...' : post.content;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card border-white/[0.06] overflow-hidden group/card ${post.isLocked && !isUnlocked ? 'bg-secondary/5' : ''}`}
    >
      <div className="p-2">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-primary italic text-lg glass shadow-inner">
              {post.authorAlias?.split('#')[1]?.substring(0, 2) ?? '?'}
            </div>
            <div className="space-y-1">
              <h4 className="text-white font-heading font-semibold text-sm tracking-tight">{post.authorAlias}</h4>
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-mono text-white/20 uppercase truncate max-w-[80px]">{post.author}</p>
                {post.authorNpk && (
                  <span className="text-[8px] font-mono text-primary/40 px-1 border border-primary/10 rounded-sm bg-primary/5">
                    LEZ:{post.authorNpk.substring(0, 6)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-[10px] font-mono text-white/50 tracking-widest flex flex-col items-end gap-1">
            <div className="flex items-center gap-3">
              {post.isEncrypted && <span className="text-success font-bold flex items-center gap-1 text-[8px] border border-success/30 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(16,185,129,0.2)]"><SparklesIcon className="w-2.5 h-2.5" /> E2EE PRIVACY</span>}
               {post.isLocked && <span className="text-secondary font-bold flex items-center gap-1"><LockIcon className="w-3 h-3" /> LOCKED</span>}
              <div className="flex items-center gap-2">
                {post.isEdited && <span className="text-[8px] font-mono text-white/20 px-1 border border-white/10 rounded-sm bg-white/5 uppercase tracking-tighter">Edited</span>}
                <span suppressHydrationWarning>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-white/5 border border-primary/30 rounded-xl p-4 text-[15px] text-white outline-none focus:border-primary transition-all min-h-[120px]"
                placeholder="What's on your mind?"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-xs font-bold text-white/40 hover:text-white transition-colors">Cancel</button>
                <button
                  onClick={() => { onEdit?.(post.id, editValue); setIsEditing(false); }}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:scale-105 transition-all"
                >
                  Save Post
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap font-sans">
                {truncated}
              </p>
              {hasMore && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-primary text-[11px] font-bold mt-2 hover:underline uppercase tracking-tighter"
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Media Grid */}
        {!isEditing && (post.imageUrls || post.imageUrl) && (
          <div className={`grid gap-2 mb-6 ${((post.imageUrls?.length || 1) > 1) ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {(post.imageUrls || [post.imageUrl]).map((url, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.01 }}
                className="relative rounded-2xl overflow-hidden border border-white/5 bg-white/5 cursor-pointer"
                onClick={() => onImageClick(isCodexCid(url!) ? getCodexUrl(url!) : url!)}
              >
                <img
                  src={isCodexCid(url!) ? getCodexUrl(url!) : url!}
                  alt="Transmission Media"
                  className="w-full h-full object-cover max-h-[400px]"
                />
              </motion.div>
            ))}
          </div>
        )}

        {post.isLocked && !isUnlocked && (
          <div className="mb-6 p-6 rounded-3xl bg-secondary/10 border border-secondary/20 flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
              <LockIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h5 className="text-white font-bold text-sm uppercase tracking-widest">Locked Transmission</h5>
              <p className="text-white/40 text-[10px] uppercase leading-relaxed max-w-[200px]">
                Unlock this transmission by purchasing a Key from the author's sovereign reserve.
              </p>
            </div>
            <button
              onClick={() => onBuyKey(post.id, currentPrice)}
              disabled={buyingKeyId === post.id}
              className="mt-2 w-full py-3 rounded-2xl bg-secondary text-white font-bold text-xs hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {buyingKeyId === post.id ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>UNLOCK FOR {currentPrice} LEZ</>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex gap-6">
          <button
            onClick={() => onToggleComments(post.id)}
            className={`text-white/70 hover:text-primary transition-all flex items-center gap-2 ${activeCommentPost === post.id ? 'text-primary' : ''}`}
          >
            <div className="flex items-center gap-1.5">
              <MessageSquareIcon className="w-4 h-4" />
              {postComments.length > 0 && (
                <span className="text-[10px] font-mono font-bold text-primary/80">{postComments.length}</span>
              )}
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">Reply</span>
          </button>
          <div className="flex items-center gap-6">
            {/* Public Tip Count Badge */}
            <AnimatePresence mode="wait">
              {tipInputActive ? (
                <motion.div
                  key="tip-input"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="flex items-center gap-2 overflow-hidden bg-white/5 border border-white/10 rounded-full px-2 py-1"
                >
                  <input
                    ref={tipInputRef}
                    type="number"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="w-12 bg-transparent outline-none text-[11px] text-white font-mono text-center"
                    placeholder="Amt"
                  />
                  <button
                    onClick={() => { onTip(post, parseFloat(tipAmount)); setTipInputActive(false); }}
                    className="h-5 w-5 rounded-full gradient-primary flex items-center justify-center text-white"
                  >
                    {tippingId === post.id
                      ? <span className="w-2 h-2 rounded-full border border-success border-t-transparent animate-spin" />
                      : <span className="text-[10px] font-bold">✓</span>
                    }
                  </button>
                  <button
                    onClick={() => { setTipInputActive(false); setTipAmount('10'); }}
                    className="h-5 w-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all text-[9px]"
                  >
                    ✕
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="tip-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setTipInputActive(true)}
                  disabled={tippingId === post.id}
                  className="text-white/70 hover:text-success transition-all flex items-center gap-2 disabled:opacity-50 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <SparklesIcon className={`w-4 h-4 ${tippingId === post.id ? 'animate-spin text-success' : 'group-hover:scale-110 transition-transform'}`} />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">
                        {visibleTips > 0 ? `${visibleTips} LEZ` : 'Tip'}
                      </span>
                    </div>
                    {supporterCount > 0 && (
                      <div className="flex items-center gap-1.5 pl-3 border-l border-white/10 text-white/30">
                        <UsersIcon className="w-3 h-3" />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest">
                          {supporterCount} {supporterCount === 1 ? 'SUPPORTER' : 'SUPPORTERS'}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => onMessageAuthor(post)} className={`text-white/70 hover:text-secondary transition-all items-center gap-2 ${filterType === 'my' ? 'hidden' : 'flex'}`}>
            <SendIcon className="w-4 h-4 -rotate-45" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">Message</span>
          </button>
          <button onClick={() => onShare(post)} className={`text-white/70 hover:text-primary transition-all ${filterType === 'my' ? 'hidden' : 'block'}`}>
            <LinkIcon className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onBookmark(post)}
              className={`transition-all ${bookmarks.includes(post.id) ? 'text-primary scale-110' : 'text-white/70 hover:text-primary'}`}
            >
              <div className="flex items-center gap-1.5">
                <BookmarkIcon className="w-4 h-4" fill={bookmarks.includes(post.id) ? "currentColor" : "none"} />
                {(post.bookmarkCount || 0) > 0 && (
                  <span className="text-[10px] font-mono font-bold text-primary/60">{post.bookmarkCount}</span>
                )}
              </div>
            </button>
          </div>

          {filterType === 'my' && (
            <div className="flex gap-4">
              <button onClick={() => setIsEditing(true)} className="text-white/40 hover:text-secondary transition-all flex items-center gap-2 group">
                <Edit3Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] hidden sm:inline">Edit</span>
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="text-white/40 hover:text-red-400 transition-all flex items-center gap-2 group">
                <Trash2Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] hidden sm:inline">Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Custom Delete Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-card border-white/10 p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Trash2Icon className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white uppercase tracking-[0.1em]">Delete Post?</h3>
                <p className="text-xs text-white/40 uppercase tracking-widest leading-relaxed">
                  This action is permanent and will remove the post from the global feed.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={() => { onDelete(post.id); setShowDeleteConfirm(false); }}
                  className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] tracking-[0.2em] transition-all shadow-lg shadow-red-500/20"
                >
                  DELETE POST
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold text-[10px] tracking-[0.2em] hover:bg-white/10 transition-all"
                >
                  CANCEL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCommentPost === post.id && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/[0.06] overflow-hidden"
          >
            {postComments.map((comment: any) => (
              <div key={comment.id} className="flex gap-3 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                    {comment.authorAlias?.split('#')[1]?.substring(0, 2) ?? '?'}
                  </div>
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-white leading-none">{comment.authorAlias}</span>
                    <span className="text-[11px] text-white/30 font-mono">
                      {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[14px] text-white/80 leading-snug">{comment.content}</p>
                </div>
              </div>
            ))}

            <div className="flex gap-3 px-5 py-3 items-start">
              <div className="h-8 w-8 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center font-bold text-secondary text-xs flex-shrink-0">
                {identity?.alias?.split('#')[1]?.substring(0, 2) ?? '?'}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={commentContents[post.id] || ''}
                  onChange={(e) => onCommentChange(post.id, e.target.value)}
                  placeholder="Post your reply"
                  className="flex-1 bg-transparent outline-none text-[14px] text-white placeholder:text-white/25 py-1"
                  onKeyDown={(e) => e.key === 'Enter' && onCommentSubmit(post.id)}
                />
                <button
                  onClick={() => onCommentSubmit(post.id)}
                  disabled={!commentContents[post.id]?.trim()}
                  className="px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide bg-primary/80 hover:bg-primary text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  Reply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
