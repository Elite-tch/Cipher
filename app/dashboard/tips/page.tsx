'use client';

import { useState, useEffect } from 'react';
import { useCipherID } from '@/hooks/useCipherID';
import { motion, AnimatePresence } from 'framer-motion';
import { LogosExecutionZone } from '@/lib/logos-ez';
import { RotateCwIcon, ArrowUpRightIcon, ArrowDownLeftIcon, SearchIcon } from 'lucide-react';

export default function TipsPage() {
  const { identity } = useCipherID();
  const [tips, setTips] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');

  useEffect(() => {
    async function loadLedgerData() {
      if (!identity) return;
      setIsLoading(true);
      try {
        const [allTips, allPosts] = await Promise.all([
          LogosExecutionZone.getGlobalTips(),
          LogosExecutionZone.getGlobalPosts()
        ]);
        setTips(allTips);
        setPosts(allPosts);
      } catch (e) {
        console.error('Failed to sync tips ledger');
      } finally {
        setIsLoading(false);
      }
    }
    loadLedgerData();
  }, [identity]);

  const getPostContent = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    return post ? post.content : 'Unknown Post';
  };

  const filteredTips = tips.filter(tip => {
    if (!identity) return false;
    if (filter === 'received') return tip.recipient === identity.npk;
    if (filter === 'sent') return tip.sender === identity.npk;
    return tip.recipient === identity.npk || tip.sender === identity.npk;
  }).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="glass-card p-8 border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <RotateCwIcon className={`w-24 h-24 ${isLoading ? 'animate-spin' : ''}`} />
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-heading font-black text-white uppercase tracking-[0.2em] mb-3">
            Tips & Rewards
          </h2>
          <p className="text-xs text-white/40 font-mono uppercase tracking-widest max-w-2xl leading-relaxed">
            Your history of supporting creators and earning rewards from the community.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-8">
          {(['all', 'received', 'sent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                filter === f 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 border border-primary/40' 
                  : 'bg-white/5 text-white/40 hover:bg-white/10 border border-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="py-20 text-center space-y-4">
            <div className="inline-block h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">Loading your history...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTips.map((tip, idx) => {
              const isReceived = tip.recipient === identity?.npk;
              return (
                <motion.div
                  key={`${tip.postId}-${tip.timestamp}-${idx}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card p-5 border-white/5 hover:border-primary/20 group transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border transition-all ${
                        isReceived 
                          ? 'bg-success/10 border-success/20 text-success shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                          : 'bg-primary/10 border-primary/20 text-primary shadow-[0_0_15px_rgba(124,58,237,0.1)]'
                      }`}>
                        {isReceived ? <ArrowDownLeftIcon className="w-6 h-6" /> : <ArrowUpRightIcon className="w-6 h-6" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isReceived ? 'text-success' : 'text-primary'}`}>
                            {isReceived ? '+' : '-'}{tip.amount} LEZ
                          </span>
                          <span className="text-[10px] text-white/20 uppercase tracking-widest font-mono">
                            {isReceived ? `from ${tip.senderAlias || 'Unknown'}` : `to ${tip.recipientAlias || 'Unknown'}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 italic line-clamp-1 max-w-md">
                          "{getPostContent(tip.postId)}"
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-tighter">
                        {new Date(tip.timestamp).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] font-mono text-white/20 uppercase">
                        {new Date(tip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {!isLoading && filteredTips.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <SearchIcon className="w-8 h-8 text-white/10 mx-auto mb-4" />
            <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">No records found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
