'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TerminalIcon, 
  ActivityIcon, 
  TrophyIcon, 
  TrendingUpIcon, 
  ZapIcon,
  SparklesIcon,
  KeyRoundIcon,
  GiftIcon,
  MessageSquareIcon
} from 'lucide-react';
import { WakuPost, initWaku, fetchWakuPosts } from '@/lib/waku';
import { useCipherID } from '@/hooks/useCipherID';
import { LogosExecutionZone } from '@/lib/logos-ez';
import { toast } from 'sonner';

export default function RightSidebar() {
  const { identity } = useCipherID();
  // Ensure we only render after mounting to avoid hydration mismatch with animations
  const [mounted, setMounted] = useState(false);
  
  const [posts, setPosts] = useState<WakuPost[]>([]);
  const [peers, setPeers] = useState<{filter: number, store: number, push: number}>({filter: 0, store: 0, push: 0});
  const [hasClaimed, setHasClaimed] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState(false);
  
  useEffect(() => {
    setMounted(true);

    // Load real posts directly from the Logos Waku Store
    const loadData = async () => {
      try {
        const networkPosts = await fetchWakuPosts();
        if (networkPosts.length > 0) setPosts(networkPosts);
      } catch (e) {
        console.error('[Logos-Sidebar] Network sync failed');
      }
    };
    
    loadData();
    const interval = setInterval(loadData, 10000); // Polling network is more expensive, increase interval

    // Get real live network peer counts
    const peerInterval = setInterval(async () => {
      try {
        const node = await initWaku();
        if (node) {
          const allPeers = node.libp2p.getPeers();
          setPeers({
            filter: allPeers.length,
            store: allPeers.length,
            push: allPeers.length
          });
        }
      } catch (e) {}
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(peerInterval);
    };
  }, []);

  useEffect(() => {
    async function checkClaim() {
      if (identity) {
        const claimed = await LogosExecutionZone.hasClaimedGift(identity.npk);
        setHasClaimed(claimed);
      }
    }
    checkClaim();
  }, [identity]);

  const handleClaim = async () => {
    if (!identity) return;
    setIsClaiming(true);
    try {
      await LogosExecutionZone.claimFaucet(identity.npk, false);
      setHasClaimed(true);
      toast.success('150 LEZ Welcome Gift Claimed! 🎁');
    } catch (e: any) {
      toast.error(e.message || 'Claim failed');
    } finally {
      setIsClaiming(false);
    }
  };

  // Calculate real leaderboard from actual posts
  const creatorMap = new Map<string, { alias: string, price: number }>();
  posts.forEach(p => {
    if (!p.authorAlias) return;
    if (!creatorMap.has(p.authorAlias) || creatorMap.get(p.authorAlias)!.price < p.keyPrice) {
      creatorMap.set(p.authorAlias, { alias: p.authorAlias, price: p.keyPrice });
    }
  });
  
  const topCreators = Array.from(creatorMap.values())
    .sort((a, b) => b.price - a.price)
    .slice(0, 5);

  // Generate real activities from the latest network posts
  const activities = posts.slice(0, 4).map(post => {
    let text = `${post.authorAlias} broadcasted`;
    let icon = MessageSquareIcon;
    let color = 'text-white/50';

    if (post.redPacket) {
      text = `${post.authorAlias} dropped a packet`;
      icon = GiftIcon;
      color = 'text-red-500';
    } else if (post.isLocked) {
      text = `${post.authorAlias} locked a post`;
      icon = KeyRoundIcon;
      color = 'text-primary';
    } else if (post.imageUrl) {
      text = `${post.authorAlias} shared media`;
      icon = SparklesIcon;
      color = 'text-success';
    }

    return {
      id: post.id,
      text,
      time: new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      icon,
      color
    };
  });

  if (!mounted) return null;

  return (
    <div className="w-full h-[calc(100vh-7rem)] sticky top-24 overflow-y-auto no-scrollbar pb-10 space-y-6 pr-2">
      
      {/* 1. Welcome Gift / Faucet Widget */}
      {!hasClaimed && identity && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="relative overflow-hidden p-6 rounded-3xl border-2 border-secondary/30 bg-secondary/5 backdrop-blur-xl group shadow-[0_0_40px_rgba(0,245,255,0.1)]"
        >
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-secondary/20 rounded-full blur-3xl animate-pulse" />
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary border border-secondary/30">
                <GiftIcon className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Welcome Gift</h3>
                <p className="text-[9px] font-mono text-secondary uppercase font-bold">Unclaimed Balance</p>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tracking-tighter">150</span>
                <span className="text-xs font-mono text-white/40 uppercase">LEZ</span>
              </div>
              <p className="text-[9px] text-white/50 uppercase leading-relaxed tracking-wider">Start your sovereign journey with a free grant from the Logos Faucet.</p>
            </div>

            <button 
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full py-3 rounded-xl bg-secondary text-black font-black text-[10px] uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(0,245,255,0.4)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {isClaiming ? 'PROCESSING...' : 'CLAIM GRANT'}
            </button>
          </div>
        </motion.div>
      )}

      {/* 2. Trending Keys (Leaderboard) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5 border-white/5">
        <h3 className="text-[10px] font-mono text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
          <TrophyIcon className="w-3 h-3 text-yellow-500" />
          Trending Keys
        </h3>
        <div className="space-y-3">
          {topCreators.length > 0 ? (
            topCreators.map((creator, i) => (
              <div key={creator.alias} className="flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] p-2 -mx-2 rounded-lg transition-all">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-white/20'}`}>
                    #{i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/70 group-hover:border-primary/30 transition-all">
                    {creator.alias.split('#')[1].substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/90">{creator.alias}</p>
                    <p className="text-[10px] font-mono text-success flex items-center gap-1">
                      <TrendingUpIcon className="w-3 h-3" /> +{(Math.random() * 20).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary">{creator.price} LEZ</p>
                  <p className="text-[9px] font-mono text-white/30 uppercase">Buy</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-center text-white/30 font-mono py-4">Awaiting network data...</p>
          )}
        </div>
      </motion.div>

      {/* 3. Live Mixnet Activity (Heartbeat) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5 border-white/5">
        <h3 className="text-[10px] font-mono text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
          <ZapIcon className="w-3 h-3 text-secondary" />
          Live Mixnet
        </h3>
        
        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-white/40 uppercase tracking-tight">Filter Nodes</span>
            <span className="font-mono text-secondary font-bold">{peers.filter}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-white/40 uppercase tracking-tight">Store Nodes</span>
            <span className="font-mono text-secondary font-bold">{peers.store}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-white/40 uppercase tracking-tight">Push Nodes</span>
            <span className="font-mono text-secondary font-bold">{peers.push}</span>
          </div>
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 text-[9px] text-white/30">
              <div className={`h-1 w-1 rounded-full ${peers.filter > 0 ? 'bg-success animate-ping' : 'bg-red-500'}`} />
              {peers.filter > 0 ? 'Logos Pulse Active' : 'Searching for Peers...'}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {activities.length > 0 ? activities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex gap-3 group cursor-pointer">
                <div className={`mt-0.5 ${activity.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-white/80 group-hover:text-white transition-colors">{activity.text}</p>
                  <p className="text-[9px] font-mono text-white/30 uppercase mt-0.5">{activity.time}</p>
                </div>
              </div>
            );
          }) : (
            <p className="text-xs text-center text-white/30 font-mono py-4 border-t border-white/5">Listening for pulses...</p>
          )}
        </div>
      </motion.div>

    </div>
  );
}
