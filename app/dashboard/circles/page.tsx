'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCipherID } from '@/hooks/useCipherID';
import { getKeyState, hasKey } from '@/lib/keys';
import { broadcastCircleMessage, subscribeToCircle, CircleMessage } from '@/lib/circles';
import { LockIcon, SendIcon, UsersIcon, SparklesIcon, ShieldCheckIcon } from 'lucide-react';

export default function CirclesPage() {
  const { identity } = useCipherID();
  const [activeCircle, setActiveCircle] = useState<string | null>(null);
  const [messages, setMessages] = useState<CircleMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [myCircles, setMyCircles] = useState<{ creator: string; alias: string }[]>([]);
  const [membershipMap, setMembershipMap] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial Mock Data for discovery - in production this comes from "Following" list
  useEffect(() => {
    setMyCircles([
      { creator: 'Logos_Core_Node', alias: 'Logos Builders' },
      { creator: 'Cipher_Protocol', alias: 'Cipher Alpha' },
    ]);
  }, []);

  // Update membership map when circles or identity change
  useEffect(() => {
    async function checkMemberships() {
      if (!identity || myCircles.length === 0) return;
      
      const newMap: Record<string, boolean> = {};
      await Promise.all(myCircles.map(async (circle) => {
        const owned = await hasKey(identity.publicKey, circle.creator);
        newMap[circle.creator] = owned;
      }));
      setMembershipMap(newMap);
    }
    checkMemberships();
  }, [myCircles, identity]);

  // Subscribe to messages when circle changes
  useEffect(() => {
    if (!activeCircle) return;
    setMessages([]);
    
    let unsubscribe: () => void;
    subscribeToCircle(activeCircle, (msg) => {
      setMessages(prev => [...prev, msg]);
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => unsubscribe?.();
  }, [activeCircle]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeCircle || !identity) return;

    const msg: CircleMessage = {
      id: Math.random().toString(36).substring(7),
      sender: identity.publicKey,
      senderAlias: identity.alias || 'Anonymous',
      content: newMessage,
      timestamp: Date.now(),
      circleId: activeCircle
    };

    setMessages(prev => [...prev, msg]);
    setNewMessage('');
    await broadcastCircleMessage(msg);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6">
      {/* Circle List */}
      <div className="w-80 flex flex-col gap-4">
        <h3 className="text-[10px] font-mono text-white/40 uppercase tracking-[0.3em] px-2">Your Circles</h3>
        <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
          {myCircles.map((circle) => {
            const isMember = !!membershipMap[circle.creator];
            const isActive = activeCircle === circle.creator;
            
            return (
              <button
                key={circle.creator}
                onClick={() => isMember ? setActiveCircle(circle.creator) : toast.error('Key Required to enter this Circle')}
                className={`w-full p-4 rounded-2xl border transition-all flex flex-col gap-2 relative overflow-hidden group ${
                  isActive 
                    ? 'bg-primary/10 border-primary/40' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center font-bold text-white text-xs">
                      {circle.alias.substring(0, 2)}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-white tracking-tight">{circle.alias}</p>
                      <p className="text-[8px] font-mono text-white/30 uppercase mt-0.5">{circle.creator.substring(0, 12)}...</p>
                    </div>
                  </div>
                  {!isMember && <LockIcon className="w-3.5 h-3.5 text-white/20" />}
                </div>
                {isActive && <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 glass-card border-white/5 flex flex-col overflow-hidden relative">
        {!activeCircle ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 gap-4">
            <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <UsersIcon className="w-8 h-8 text-white/20" />
            </div>
            <div>
              <h4 className="text-white font-bold tracking-tight">Select a Circle</h4>
              <p className="text-sm text-white/40 mt-1 max-w-xs mx-auto">Enter a private, key-gated space to connect with creators and builders.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <ShieldCheckIcon className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-mono text-secondary font-bold uppercase tracking-widest">
                  E2EE Connection Active
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[8px] font-mono text-success uppercase">Routed via Logos Mixnet</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((msg, i) => {
                const isMe = msg.sender === identity?.publicKey;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-tighter">{msg.senderAlias}</span>
                      <span className="text-[8px] font-mono text-white/10 uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed border shadow-lg ${
                      isMe 
                        ? 'bg-primary/20 border-primary/30 text-white rounded-tr-none' 
                        : 'bg-white/5 border-white/10 text-white/80 rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-black/40">
              <div className="flex gap-4 items-center bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-2 focus-within:border-primary/40 transition-all">
                <input 
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Broadcast to circle..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/20"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 rounded-xl bg-primary text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  <SendIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 px-1">
                <SparklesIcon className="w-3 h-3 text-secondary opacity-50" />
                <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest italic">Messages are sovereign & decentralized</span>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
