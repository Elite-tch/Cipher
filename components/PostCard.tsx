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
  RotateCwIcon
} from 'lucide-react';
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
  activeCommentPost: string | null;
  commentContents: Record<string, string>;
  tippingId: string | null;
  onTip: (post: WakuPost, amount: number) => void;
  onMessageAuthor: (post: WakuPost) => void;
  onBookmark: (postId: string) => void;
  onShare: (post: WakuPost) => void;
  onToggleComments: (postId: string) => void;
  onCommentChange: (postId: string, value: string) => void;
  onCommentSubmit: (postId: string) => void;
  onImageClick: (url: string) => void;
  onBuyKey: (post: WakuPost) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string, content: string) => void;
  filterType?: string;
}

export default function PostCard({
  post, identity, allTips, posts, unlockedPosts, bookmarks,
  activeCommentPost, commentContents, tippingId, onTip, onMessageAuthor, onBookmark, onShare,
  onToggleComments, onCommentChange, onCommentSubmit, onImageClick, onBuyKey,
  onDelete, onEdit, filterType
}: PostCardProps) {
  // Role-based Access & State
  const relevantTips = allTips.filter((t: any) => t.postId === post.id);
  const [visibleTips, setVisibleTips] = useState<number>(0);
  const [tipInputActive, setTipInputActive] = useState(false);
  const [tipAmount, setTipAmount] = useState('10');
  const tipInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0.01);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(post.content);
  const TEXT_LIMIT = 280;

  const postComments = posts.filter((p: any) => p.parentId === post.id).sort((a: any, b: any) => a.timestamp - b.timestamp);

  // Focus the input when it becomes active
  useEffect(() => {
    if (tipInputActive) tipInputRef.current?.focus();
  }, [tipInputActive]);

  useEffect(() => {
    async function calculateTips() {
      if (!identity) return setVisibleTips(0);

      let sum = 0;
      for (const tip of relevantTips) {
        // Public tips are visible to everyone
        if (!tip.isEncrypted) {
          sum += parseFloat(tip.amount || '0');
        } 
        // Private tips only visible to sender/recipient
        else if (tip.sender === identity.npk || tip.recipient === identity.npk) {
          try {
            const amountStr = await decryptData(tip.amount, identity.vsk);
            sum += parseFloat(amountStr);
          } catch (e) { }
        }
      }
      setVisibleTips(sum);
    }
    calculateTips();
  }, [relevantTips, identity, visibleTips]);

  useEffect(() => {
    async function checkLock() {
      if (!post.isLocked) return setIsUnlocked(true);
      if (!identity) return setIsUnlocked(false);

      const owned = await hasKey(identity.peerId, post.author);
      setIsUnlocked(owned);

      const state = await getKeyState(post.author);
      setCurrentPrice(calculateKeyPrice(state.supply));
    }
    checkLock();
  }, [post.isLocked, post.author, identity, unlockedPosts]);

  const handleConfirmTip = () => {
    const parsed = parseFloat(tipAmount);
    if (!isNaN(parsed) && parsed > 0) {
      onTip(post, parsed);
    }
    setTipInputActive(false);
    setTipAmount('10');
  };

  return (
    <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="glass-card group hover:border-primary/30 transition-all duration-500  overflow-hidden mb-4">
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
              <span suppressHydrationWarning>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-xs font-bold text-white/40 hover:text-white transition-colors">Cancel</button>
                <button
                  onClick={() => { onEdit?.(post.id, editValue); setIsEditing(false); }}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:scale-105 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : post.content && (
            <div
              className={`text-[15px] font-body leading-relaxed px-1 mb-4 text-white/80 whitespace-pre-wrap break-words ${isExpanded ? 'cursor-pointer' : ''} ${!isUnlocked ? 'blur-md select-none pointer-events-none' : ''}`}
              onClick={() => {
                if (isExpanded) {
                  setIsExpanded(false);
                }
              }}
            >
              {post.content.length > TEXT_LIMIT && !isExpanded ? (
                <>
                  {post.content.slice(0, TEXT_LIMIT)}...
                  <span
                    className="text-primary hover:text-primary/80 font-semibold ml-1 text-xs uppercase tracking-wider cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(true);
                    }}
                  >
                    Read more
                  </span>
                </>
              ) : (
                <>
                  {post.content}
                  {post.content.length > TEXT_LIMIT && (
                    <span className="text-primary hover:text-primary/80 font-semibold ml-1 text-xs uppercase tracking-wider block mt-1">
                      Show less
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {!isUnlocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl z-10 p-6 text-center border border-white/5 shadow-2xl">
              <div className="h-14 w-14 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary mb-4 border border-secondary/30">
                <LockIcon className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Sovereign Content Locked</h4>
              <p className="text-[10px] text-white/60 mb-6 max-w-[200px] uppercase tracking-wider leading-relaxed">You need the author's Key to unlock this transmission.</p>
              <button
                onClick={() => onBuyKey(post)}
                className="px-6 py-2.5 rounded-xl gradient-secondary text-black font-bold text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Buy Key — {currentPrice} LEZ
              </button>
            </div>
          )}

          {(() => {
            const imgs: string[] = post.imageUrls?.length
              ? post.imageUrls
              : post.imageUrl ? [post.imageUrl] : [];
            if (!imgs.length) return null;
            const gridClass = imgs.length === 1
              ? 'grid-cols-1'
              : imgs.length === 2
                ? 'grid-cols-2'
                : imgs.length === 3
                  ? 'grid-cols-2'
                  : 'grid-cols-2';
            return (
              <div className={`grid ${gridClass} gap-1.5 rounded-xl  overflow-hidden border border-white/10 ${!isUnlocked ? 'blur-lg grayscale' : ''}`}>
                {imgs.map((url, idx) => (
                  <div
                    key={idx}
                    className={`relative  bg-white/[0.03] cursor-zoom-in ${imgs.length === 3 && idx === 0 ? 'row-span-2' : ''
                      }`}
                    style={{ aspectRatio: imgs.length === 1 ? 'auto' : '1' }}
                    onClick={() => onImageClick(isCodexCid(url) ? getCodexUrl(url) : url)}
                  >
                    <img
                      src={isCodexCid(url) ? getCodexUrl(url) : url}
                      alt={`Post image ${idx + 1}`}
                      className={`w-full h-full object-cover brightness-110 ${imgs.length === 1 ? 'max-h-[400px] object-contain' : ''
                        }`}
                    />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex gap-6">
          <button onClick={() => onToggleComments(post.id)} className="text-white/70 hover:text-white transition-all flex items-center gap-2">
            <MessageSquareIcon className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">{postComments.length > 0 ? `${postComments.length} ` : ''}Reply</span>
          </button>
          <div className="flex items-center gap-6">
            {/* Public Tip Count Badge */}
            {relevantTips.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/5 border border-success/20">
                <SparklesIcon className="w-3 h-3 text-success shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <span className="text-[10px] font-mono font-bold text-success/80">{relevantTips.length}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {tipInputActive ? (
                <motion.div
                  key="tip-input"
                  initial={{ width: 60, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 60, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-1.5"
                >
                  <SparklesIcon className="w-4 h-4 text-success flex-shrink-0" />
                  <input
                    ref={tipInputRef}
                    type="text"
                    inputMode="decimal"
                    value={tipAmount}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setTipAmount(val);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleConfirmTip();
                      if (e.key === 'Escape') { setTipInputActive(false); setTipAmount('10'); }
                    }}
                    className="w-14 bg-white/5 border border-success/40 rounded-md px-1 py-0.5 text-[11px] font-mono text-white outline-none focus:border-success transition-colors text-center"
                  />
                  <span className="text-[9px] font-mono text-white/40">LEZ</span>
                  <button
                    onClick={handleConfirmTip}
                    disabled={tippingId === post.id}
                    className="h-5 w-5 rounded-full bg-success/20 border border-success/40 flex items-center justify-center text-success hover:bg-success/30 transition-all disabled:opacity-50"
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
                  <SparklesIcon className={`w-4 h-4 ${tippingId === post.id ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">
                    {visibleTips > 0 ? `${visibleTips} ` : ''}Tip
                  </span>
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

          {filterType === 'my' && (
            <div className="flex gap-4">
              <button onClick={() => setIsEditing(true)} className="text-white/40 hover:text-secondary transition-all flex items-center gap-2">
                <Edit3Icon className="w-4 h-4" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">Edit</span>
              </button>
              <button onClick={() => onDelete?.(post.id)} className="text-white/40 hover:text-red-500 transition-all flex items-center gap-2">
                <Trash2Icon className="w-4 h-4" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">Delete</span>
              </button>
            </div>
          )}

          <button onClick={() => onBookmark(post.id)} className={`transition-all ${bookmarks.includes(post.id) ? 'text-primary scale-110' : 'text-white/70 hover:text-primary'}`}>
            <BookmarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

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
