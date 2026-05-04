'use client';

import React, { useState } from 'react';
import { useCipherID } from '@/hooks/useCipherID';
import { 
  ShieldCheckIcon, 
  EyeIcon, 
  EyeOffIcon, 
  CopyIcon, 
  ShieldAlertIcon,
  UserIcon,
  ShieldIcon,
  LockIcon
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { identity, logout } = useCipherID();
  const [showIdentity, setShowIdentity] = useState(false);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-heading font-black text-white uppercase tracking-tight flex items-center gap-3">
          <ShieldCheckIcon className="w-8 h-8 text-secondary" />
          Settings
        </h2>
        <p className="text-[11px] text-white/40 font-mono uppercase tracking-[0.3em]">Privacy & Security Control Center</p>
      </div>

      {identity ? (
        <div className="space-y-8">
          {/* Public Profile */}
          <section className="glass-card overflow-hidden border-white/5">
            <div className="bg-white/[0.03] px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-[10px] font-mono font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5" />
                Public Presence
              </h3>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">Your Alias</p>
                  <p className="text-lg font-bold text-white">{identity.alias}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-secondary/20 border border-secondary/30 flex items-center justify-center text-secondary font-bold">
                  {identity.alias.split('#')[1]?.substring(0, 2)}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Logos Network ID (PeerID)</p>
                    <span className="text-[8px] font-mono text-emerald-500 flex items-center gap-1 uppercase tracking-widest">
                      <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                      Network Active
                    </span>
                  </div>
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5 break-all group relative">
                    <code className="text-[11px] text-white/60 font-mono leading-relaxed">
                      {identity.peerId}
                    </code>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest">LEZ Account ID (NPK)</p>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 truncate group relative">
                      <code className="text-[10px] text-white/50 font-mono">
                        {identity.npk}
                      </code>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Viewing Public Key (VPK)</p>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 truncate group relative">
                      <code className="text-[10px] text-white/50 font-mono">
                        {identity.vpk}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Account Identity (Sovereign Phrase) */}
          <section className="glass-card overflow-hidden border-secondary/20 relative">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-primary opacity-50" />
            <div className="bg-secondary/5 px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-[10px] font-mono font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                <ShieldIcon className="w-3.5 h-3.5" />
                Account Identity
              </h3>
              <span className="text-[9px] font-mono text-secondary px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/20">PRIVATE</span>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex gap-4">
                <ShieldAlertIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-wider">
                  This is your <span className="text-white font-bold underline">Account Identity</span>. It allows you to access your account on any device. <span className="text-red-500 font-bold">Never share it with anyone!</span> If you lose it, your account is gone forever.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Your Private 12 Words</p>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setShowIdentity(!showIdentity)}
                      className="text-[10px] font-mono text-secondary flex items-center gap-2 hover:text-white transition-colors"
                    >
                      {showIdentity ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                      {showIdentity ? 'HIDE' : 'REVEAL'}
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(identity.mnemonic);
                        toast.success('Account Identity copied securely');
                      }}
                      className="text-[10px] font-mono text-white/40 flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <CopyIcon className="w-3.5 h-3.5" />
                      COPY
                    </button>
                  </div>
                </div>

                <div className="bg-black/60 p-6 rounded-2xl border border-white/5 relative group min-h-[80px] flex items-center justify-center">
                  {showIdentity ? (
                    <p className="text-sm font-mono text-white text-center leading-relaxed tracking-wide select-all">
                      {identity.mnemonic}
                    </p>
                  ) : (
                    <div className="flex gap-1.5">
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className="h-1.5 w-1.5 rounded-full bg-white/10" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="glass-card overflow-hidden border-red-500/10">
            <div className="bg-red-500/5 px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">
                Danger Zone
              </h3>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider leading-relaxed">
                Disconnecting will remove your identity from this browser. Make sure you have copied your <span className="text-white font-bold">Account Identity</span> words first.
              </p>
              <button 
                onClick={logout}
                className="w-full py-4 rounded-2xl border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/5 active:scale-[0.98]"
              >
                Disconnect Identity
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="glass-card p-12 text-center flex flex-col items-center gap-6">
          <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
            <LockIcon className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Identity Required</h4>
            <p className="text-[10px] text-white/40 mt-2 uppercase tracking-widest">Please connect your Cipher ID to manage settings</p>
          </div>
        </div>
      )}
    </div>
  );
}
