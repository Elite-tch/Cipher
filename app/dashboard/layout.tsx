'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCipherID } from '@/hooks/useCipherID';
import { LogosExecutionZone } from '@/lib/logos-ez';
import { 
  ShieldCheckIcon, 
  LockIcon, 
  CopyIcon,
  LogOutIcon,
  ZapIcon,
  AlertTriangleIcon,
  SettingsIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { identity, logout } = useCipherID();
  const [balance, setBalance] = React.useState('0.00');
  const [hasClaimed, setHasClaimed] = React.useState(false);
  const [showExitWarning, setShowExitWarning] = React.useState(false);

  const fetchBalance = React.useCallback(async () => {
    if (!identity) return;
    try {
      const b = await LogosExecutionZone.getBalance(identity.npk, true);
      const claimed = await LogosExecutionZone.hasClaimedGift(identity.npk);
      setBalance(b.toFixed(2));
      setHasClaimed(claimed);
    } catch (e) {
      console.error('[Logos-LEZ] Balance sync failed');
    }
  }, [identity]);

  React.useEffect(() => {
    fetchBalance(); // Initial load
    
    const interval = setInterval(() => {
      if (identity) {
        console.log('[Logos-LEZ] Auto-syncing private state...');
        LogosExecutionZone.syncPrivateState().then(() => fetchBalance());
      }
    }, 30000); 

    return () => clearInterval(interval);
  }, [identity, fetchBalance]);

  const NAV_ITEMS = [
    { name: 'Explore', href: '/dashboard', icon: '◈' },
    { name: 'My Posts', href: '/dashboard/my-feeds', icon: '⊞' },
    { name: 'Saved', href: '/dashboard/bookmarked', icon: '★' },
    { name: 'Chats', href: '/dashboard/chats', icon: '▣' },
    { name: 'Recent Tips', href: '/dashboard/tips', icon: '✧' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙' },
  ];

  const handleExit = () => {
    setShowExitWarning(true);
  };

  const confirmExit = () => {
    logout();
    setShowExitWarning(false);
    router.push('/');
  };

  const handleClaim = async () => {
    if (!identity || hasClaimed) return;
    try {
      toast.info('Claiming welcome gift in background...', { duration: 2000 });
      await LogosExecutionZone.claimFaucet(identity.npk, true);
      toast.success('Your welcome gift has arrived!');
      setHasClaimed(true);
      fetchBalance();
    } catch (e) {
      toast.error('Could not claim gift. Try again later.');
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-white/90 font-inter">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 fixed h-full bg-background/50 backdrop-blur-xl z-40">
        <div className="flex items-center gap-3 mb-12">
          <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.4)] border border-white/20">
            <ShieldCheckIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-black text-xl tracking-[-0.05em] text-white leading-none uppercase">Cipher</span>
            <span className="text-[7px] font-mono text-primary font-bold uppercase tracking-[0.3em] mt-1">Sovereign Layer</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${
                  isActive 
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(124,58,237,0.1)]' 
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`text-xl transition-transform group-hover:scale-110 ${isActive ? 'text-primary' : 'text-white/80'}`}>
                  {item.icon}
                </span>
                <span className="text-sm font-body font-medium tracking-tight">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Summary */}
        <div className="pt-6 border-t border-white/5 space-y-4">
          <div className="glass-card p-4 flex items-center gap-3 border border-secondary/30 bg-secondary/5 relative group cursor-pointer hover:bg-secondary/10 transition-all"
               onClick={() => router.push('/dashboard/settings')}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold italic text-xs glass flex-shrink-0 text-secondary border border-secondary/30">
              {identity?.alias?.split('#')[1]?.substring(0, 2) ?? '?'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-[10px] font-mono text-white truncate font-bold">
                {identity?.alias || 'Sovereign User'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-secondary shadow-[0_0_8px_rgba(0,245,255,0.6)]" />
                <span className="text-[8px] font-mono uppercase tracking-widest text-secondary">
                  Secured
                </span>
              </div>
            </div>
            <SettingsIcon className="w-3 h-3 text-white/20 group-hover:text-white/60 transition-colors" />
          </div>
          
          <button 
            onClick={handleExit}
            className="w-full py-2.5 rounded-xl text-[8px] font-mono uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border bg-red-500/5 border-red-500/20 text-red-500/60 hover:bg-red-500/10 hover:text-red-500"
          >
            <LogOutIcon className="w-3 h-3" />
            Disconnect
          </button>

          <button 
            onClick={handleClaim}
            disabled={hasClaimed}
            className={`w-full py-2.5 rounded-xl text-[8px] font-mono uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border bg-secondary/5 border-secondary/20 text-secondary ${hasClaimed ? 'opacity-80 cursor-default' : 'hover:bg-secondary/10'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-secondary ${hasClaimed ? '' : 'animate-ping'}`} />
            {hasClaimed ? 'Gift Claimed' : 'Claim Welcome Gift'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 min-h-screen relative">
        {/* Top Kinetic Bar */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 sticky top-0 bg-background/80 backdrop-blur-md z-30">
          <h2 className="text-sm font-mono text-white uppercase tracking-[0.3em]">
            {NAV_ITEMS.find(i => i.href === pathname)?.name || 'Dashboard'}
          </h2>
          
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-mono text-white/60 uppercase tracking-[0.2em]">Shielded Balance</span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-mono font-bold text-white leading-none">{balance}</span>
                <span className="text-[10px] font-mono text-secondary font-bold">LEZ</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 ">
          {children}
        </div>

        {/* Exit Warning Modal */}
        <AnimatePresence>
          {showExitWarning && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowExitWarning(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-sm bg-background border border-red-500/20 rounded-3xl p-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
                
                <div className="flex items-center gap-4 mb-6 text-red-500">
                  <div className="h-12 w-12 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                    <AlertTriangleIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-heading font-bold tracking-tight uppercase">Wait!</h3>
                </div>

                <div className="space-y-6">
                  <p className="text-xs text-white/60 leading-relaxed uppercase tracking-widest">
                    Have you copied your <span className="text-white font-bold underline">Account Identity</span> words yet?
                  </p>
                  
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
                      If you disconnect without saving them, you will <span className="text-red-500 font-bold">Never</span> be able to get back into your account or access your LEZ tokens.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        setShowExitWarning(false);
                        router.push('/dashboard/settings');
                      }}
                      className="w-full py-4 rounded-2xl bg-white/5 text-white font-bold text-xs uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
                    >
                      Go to Settings
                    </button>
                    <button 
                      onClick={confirmExit}
                      className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 active:scale-95 transition-all"
                    >
                      I Understand, Disconnect
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
