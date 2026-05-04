'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCipherID } from '@/hooks/useCipherID';
import { useSearchParams } from 'next/navigation';
import { getKeyState, hasKey, calculateKeyPrice, buyKey } from '@/lib/keys';
import { broadcastCircleMessage, subscribeToCircle, fetchCircleHistory, CircleMessage } from '@/lib/circles';
import { LogosExecutionZone } from '@/lib/logos-ez';
import { ZkProofModal, useZkProof } from '@/components/ZkProofModal';
import { 
  LockIcon, 
  SendIcon, 
  UsersIcon, 
  SparklesIcon, 
  ShieldCheckIcon, 
  CoinsIcon,
  MessageSquareIcon,
  SearchIcon,
  CheckIcon,
  CheckCheckIcon
} from 'lucide-react';

export default function ChatsPage() {
  const { identity } = useCipherID();
  const searchParams = useSearchParams();
  const userParam = searchParams.get('user');
  const { stage: zkStage, runWithZkProof } = useZkProof();

  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<CircleMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState<{ id: string; name: string; type: 'group' | 'direct'; lastMsg: string; timestamp: number; unread?: boolean }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Transit Modal State
  const [isTransitModalOpen, setIsTransitModalOpen] = useState(false);
  const [transitAmount, setTransitAmount] = useState('10.0');
  const [transitNote, setTransitNote] = useState('');

  useEffect(() => {
    if (userParam && identity) {
      setActiveChat(userParam);
      
      // Ensure this user is in the conversations list for the current identity on Logos Network
      async function ensureConversation() {
        if (!identity) return;
        try {
          const remoteChats = await LogosExecutionZone.getMetadata(identity.npk, 'active_chats') || [];
          if (!remoteChats.some((c: any) => c.id === userParam)) {
            const newConv = {
              id: userParam,
              name: `Logos#${userParam.slice(-4).toUpperCase()}`,
              type: 'direct',
              lastMsg: 'New secure thread started',
              timestamp: Date.now()
            };
            const updated = [newConv, ...remoteChats];
            setConversations(updated);
            await LogosExecutionZone.saveMetadata(identity.npk, 'active_chats', updated);
          }
        } catch (e) {
          console.error('[Logos-LEZ] Failed to sync conversation metadata');
        }
      }
      ensureConversation();
    }
  }, [userParam, identity]);

  // Load interactions from local storage or network
  useEffect(() => {
    if (!identity) return;
    async function loadConversations() {
      try {
        const remoteChats = await LogosExecutionZone.getMetadata(identity.npk, 'active_chats') || [];
        setConversations(remoteChats);
      } catch (e) {
        setConversations([]);
      }
    }
    loadConversations();
  }, [identity]);

  useEffect(() => {
    if (!activeChat || !identity) return;
    
    // Load persisted messages for this chat (UI Cache)
    const saved = localStorage.getItem(`cipher_msgs_${identity.peerId}_${activeChat}`);
    if (saved) setMessages(JSON.parse(saved));

    let unsubscribe: () => void;

    // SYNC FROM LOGOS NETWORK (Source of Truth)
    fetchCircleHistory(activeChat).then(history => {
      if (history.length > 0) {
        setMessages(prev => {
          const combined = [...prev];
          history.forEach(hm => {
            if (!combined.some(m => m.id === hm.id)) combined.push(hm);
          });
          return combined.sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    });

    subscribeToCircle(activeChat, async (msg) => {
      // HANDLE REAL RECEIPTS
      if (msg.type === 'receipt') {
        if (msg.sender !== identity?.peerId) {
          updateMessageStatus(msg.receiptForId!, 'seen');
        }
        return; // Don't show receipts in the chat bubbles
      }

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        const updated = [...prev, msg];
        if (identity) {
          localStorage.setItem(`cipher_msgs_${identity.peerId}_${activeChat}`, JSON.stringify(updated));
        }
        return updated;
      });

      // AUTO-SEND RECEIPT if message is from someone else
      if (identity && msg.sender !== identity.peerId) {
        const receipt: CircleMessage = {
          id: 'rcpt_' + Math.random().toString(36).substring(7) + Date.now(),
          sender: identity.peerId,
          senderAlias: identity.alias || 'Anonymous',
          content: 'SEEN',
          timestamp: Date.now(),
          circleId: activeChat,
          type: 'receipt',
          receiptForId: msg.id
        };
        await broadcastCircleMessage(receipt);
      }
    }).then(unsub => { unsubscribe = unsub; });
    return () => unsubscribe?.();
  }, [activeChat, identity]);

  // GLOBAL INBOX: Listen for any message sent to MY OWN circle
  useEffect(() => {
    if (!identity) return;

    let unsubscribe: () => void;
    // SYNC GLOBAL INBOX HISTORY (Catch missed messages)
    fetchCircleHistory(identity.peerId).then(history => {
      if (history.length > 0) {
        setConversations(prev => {
          const chatKey = `cipher_active_chats_${identity.peerId}`;
          const updated = [...prev];
          
          history.forEach(msg => {
            if (msg.sender === identity.peerId) return;
            const existingIndex = updated.findIndex(c => c.id === msg.sender);
            if (existingIndex > -1) {
              if (msg.timestamp > updated[existingIndex].timestamp) {
                updated[existingIndex].lastMsg = msg.content;
                updated[existingIndex].timestamp = msg.timestamp;
              }
            } else {
              updated.unshift({
                id: msg.sender,
                name: msg.senderAlias || `Logos#${msg.sender.slice(-4).toUpperCase()}`,
                type: 'direct',
                lastMsg: msg.content,
                timestamp: msg.timestamp,
                unread: true
              });
            }
          });
          
          const sorted = updated.sort((a, b) => b.timestamp - a.timestamp);
          localStorage.setItem(chatKey, JSON.stringify(sorted));
          return sorted;
        });
      }
    });

    subscribeToCircle(identity.peerId, async (msg) => {
      // Ignore my own messages (already handled by activeChat subscription)
      if (msg.sender === identity.peerId) return;
      if (msg.type === 'receipt') return;

      // 1. Update/Add to conversations list on Logos Network
      try {
        const convs = await LogosExecutionZone.getMetadata(identity.npk, 'active_chats') || [];
        const existingIndex = convs.findIndex((c: any) => c.id === msg.sender);
        
        if (existingIndex > -1) {
          convs[existingIndex].lastMsg = msg.content;
          convs[existingIndex].timestamp = msg.timestamp;
        } else {
          convs.unshift({
            id: msg.sender,
            name: msg.senderAlias || `Logos#${msg.sender.slice(-4).toUpperCase()}`,
            type: 'direct',
            lastMsg: msg.content,
            timestamp: msg.timestamp,
            unread: true
          });
        }
        
        setConversations([...convs]);
        await LogosExecutionZone.saveMetadata(identity.npk, 'active_chats', convs);
      } catch (e) {
        console.error('[Logos-LEZ] Global inbox sync failed');
      }

      // 2. Route message to active chat
      const currentActive = activeChatRef.current;
      if (currentActive === msg.sender) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } else {
        toast.info(`New message from ${msg.senderAlias}`);
      }
    }).then(unsub => { unsubscribe = unsub; });

    return () => unsubscribe?.();
  }, [identity, activeChat]);

  // Persist outgoing messages
  useEffect(() => {
    if (activeChat && messages.length > 0 && identity) {
      localStorage.setItem(`cipher_msgs_${identity.peerId}_${activeChat}`, JSON.stringify(messages));
    }
  }, [messages, activeChat, identity]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateMessageStatus = (msgId: string, status: 'sent' | 'delivered' | 'seen') => {
    setMessages(prev => {
      const updated = prev.map(m => m.id === msgId ? { ...m, status } : m);
      if (identity && activeChat) {
        localStorage.setItem(`cipher_msgs_${identity.peerId}_${activeChat}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !identity) return;
    const msg: CircleMessage = {
      id: Math.random().toString(36).substring(7) + Date.now(),
      sender: identity.peerId,
      senderAlias: identity.alias || 'Anonymous',
      content: newMessage,
      timestamp: Date.now(),
      circleId: activeChat,
      status: 'sent'
    };
    setMessages(prev => [...prev, msg]);
    setNewMessage('');
    
    await broadcastCircleMessage(msg);
    updateMessageStatus(msg.id, 'delivered');
  };

  const handleSendValue = async () => {
    if (!activeChat || !identity || !transitAmount) return;

    // Close the transit UI immediately — ZkProofModal takes over
    setIsTransitModalOpen(false);
    const recipientKey = activeChat;
    const amount = transitAmount;
    const note = transitNote;

    await runWithZkProof(
      // Actual LEZ transfer — fires during 'broadcasting' stage
      async () => {
        const result = await LogosExecutionZone.transfer(identity.npk, recipientKey, amount);
        if (result.success) {
          const msg: CircleMessage = {
            id: Math.random().toString(36).substring(7) + Date.now(),
            sender: identity.peerId,
            senderAlias: identity.alias || 'Anonymous',
            content: note || `Sent ${amount} LEZ`,
            timestamp: Date.now(),
            circleId: activeChat,
            type: 'payment',
            amount: amount,
            status: 'sent'
          };
          setMessages(prev => [...prev, msg]);
          await broadcastCircleMessage(msg);
          updateMessageStatus(msg.id, 'delivered');
        }
        return result;
      },
      // onSuccess
      () => {
        toast.success('Transit confirmed on Logos Mixnet');
        setTransitAmount('10.0');
        setTransitNote('');
      },
      // onError
      () => toast.error('Transit failed'),
    );
  };

  const handleJoinCircle = async (creator: string) => {
    if (!identity) return;
    const toastId = toast.loading('Calculating bonding curve price...');
    try {
      const result = await buyKey(creator, identity.peerId);
      if (result.success) {
        toast.success('Key acquired! Circle unlocked.', { id: toastId });
        setActiveChat(creator);
      }
    } catch (err) {
      toast.error('Could not join circle.', { id: toastId });
    }
  };

  return (
    <>
      {/* ZK Proof Generation Modal — shown for all LEZ value transfers */}
      <ZkProofModal
        stage={zkStage}
        amount={transitAmount}
        recipient={activeChat ?? undefined}
        onClose={() => {}}
      />
      <div className="flex h-[calc(100vh-7rem)] gap-0 border border-white/10 rounded-2xl overflow-hidden glass shadow-2xl">
        {/* Messages Sidebar */}
        <div className="w-80 border-r border-white/10 flex flex-col bg-white/[0.03]">
          <div className="p-4 space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/70" />
              <input 
                type="text" 
                placeholder="SEARCH MESSAGES" 
                className="w-full bg-white/[0.05] border border-white/70 rounded-lg py-2.5 pl-9 pr-4 text-[10px] font-mono text-white placeholder:text-white/70 outline-none focus:border-primary/60 transition-all uppercase tracking-widest"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {conversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-[10px] font-mono text-secondary uppercase tracking-widest">No active chats</p>
                <p className="text-[9px] font-mono text-secondary uppercase">Start a thread from the feed</p>
              </div>
            ) : conversations.map((chat) => {
              const isActive = activeChat === chat.id;
              return (
                <div key={chat.id} className="relative">
                  <button
                    onClick={() => setActiveChat(chat.id)}
                    className={`w-full px-6 py-5 border-b border-white/[0.05] transition-all flex items-center gap-4 relative group ${
                      isActive ? 'bg-primary/10' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-white text-xs border bg-secondary/20 border-secondary/40 text-secondary shadow-lg shadow-secondary/5`}>
                      {chat.name.substring(0, 2)}
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-white tracking-tight uppercase tracking-widest">{chat.name}</span>
                        <span className="text-[9px] font-mono text-white/40 uppercase">
                          {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 truncate font-body">
                        {chat.lastMsg}
                      </p>
                    </div>
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_15px_rgba(124,58,237,1)]" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-black/60 relative overflow-hidden">
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 gap-6">
              <div className="h-20 w-20 rounded-2xl  border border-secondary flex items-center justify-center text-secondary shadow-inner">
                <MessageSquareIcon className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-[11px] font-mono text-white uppercase tracking-[0.4em] font-bold">Secure Gateway Active</h4>
                <p className="text-[10px] text-white/70 mt-3 max-w-xs mx-auto uppercase tracking-widest leading-relaxed">End-to-End Encryption Messages </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-8 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.03] backdrop-blur-xl">
                <div className="flex items-center gap-5">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white text-xs border bg-secondary/20 border-secondary/40 text-secondary shadow-lg shadow-secondary/10`}>
                    {conversations.find(c => c.id === activeChat)?.name.substring(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-[0.2em] uppercase">{conversations.find(c => c.id === activeChat)?.name}</h4>
                    <div className="flex items-center gap-2.5 mt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,1)] animate-pulse" />
                      <span className="text-[9px] font-mono text-success uppercase tracking-[0.2em] font-bold">Shielded Session</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar bg-black/20">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => {
                    const isMe = msg.sender === identity?.peerId;
                    const isPayment = msg.type === 'payment';
                    
                    return (
                      <motion.div 
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-3 mb-1.5 px-2">
                          {!isMe && <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">{msg.senderAlias}</span>}
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-mono text-white/20 uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              <div className="flex items-center">
                                {msg.status === 'sent' && <CheckIcon className="w-3 h-3 text-white/20" />}
                                {msg.status === 'delivered' && <CheckIcon className="w-3 h-3 text-secondary" />}
                                {msg.status === 'seen' && <CheckCheckIcon className="w-3 h-3 text-secondary shadow-[0_0_8px_rgba(0,245,255,0.4)]" />}
                              </div>
                            )}
                          </div>
                        </div>

                        {isPayment ? (
                          <div className={`max-w-[70%] p-1 rounded-2xl border shadow-2xl transition-all ${
                            isMe ? 'bg-success/20 border-success/40' : 'bg-white/[0.05] border-white/10'
                          }`}>
                            <div className="bg-black/40 rounded-xl p-4 flex items-center gap-4">
                              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center text-success border border-success/30">
                                <CoinsIcon className="w-5 h-5 animate-pulse" />
                              </div>
                              <div className="flex-1 text-left">
                                <span className="text-[10px] font-mono text-success uppercase font-bold tracking-widest">Secure Transit</span>
                                <p className="text-xl font-bold text-white leading-none mt-1">{msg.amount} <span className="text-[10px] text-white/40">LEZ</span></p>
                              </div>
                            </div>
                            {msg.content && (
                              <div className="px-4 py-3 text-xs text-white/80 font-body border-t border-white/5 mt-1 bg-white/[0.02]">
                                "{msg.content}"
                              </div>
                            )}
                            <div className="px-3 py-1.5 flex items-center justify-between">
                              <span className="text-[8px] font-mono text-white/40 uppercase">E2EE Confirmed</span>
                              <ShieldCheckIcon className="w-3 h-3 text-success/60" />
                            </div>
                          </div>
                        ) : (
                          <div className={`max-w-[75%] px-5 py-3 rounded-2xl text-[13px] leading-relaxed border shadow-xl ${
                            isMe 
                              ? 'bg-primary/20 border-primary/40 text-white rounded-tr-none shadow-[0_0_25px_rgba(124,58,237,0.1)]' 
                              : 'bg-white/[0.05] border-white/15 text-white/90 rounded-tl-none'
                          }`}>
                            {msg.content}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={scrollRef} />
              </div>

              {/* Input area wrapper */}
              <div className="p-6 border-t border-white/10 bg-black/40 backdrop-blur-2xl">
                <div className="flex gap-4 items-center">
                  <button 
                    type="button" 
                    onClick={() => setIsTransitModalOpen(true)} 
                    className="p-3 rounded-2xl bg-secondary/10 text-secondary hover:bg-secondary/20 hover:scale-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,245,255,0.15)] group relative flex-shrink-0"
                  >
                    <CoinsIcon className="w-6 h-6" />
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-secondary text-black text-[9px] font-mono font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest pointer-events-none shadow-xl">Transit</span>
                  </button>

                  <form onSubmit={handleSendMessage} className="flex-1 flex gap-4 items-center bg-white/[0.04] border border-white/15 rounded-2xl px-5 py-3.5 focus-within:border-primary/40 focus-within:bg-white/[0.06] transition-all shadow-inner">
                    <input 
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="TYPE YOUR ENCRYPTED MESSAGE..."
                      className="flex-1 bg-transparent border-none outline-none text-[12px] font-mono text-white placeholder:text-white/60 tracking-[0.15em] font-medium"
                    />
                    <button type="submit" disabled={!newMessage.trim()} className="text-white/60 hover:scale-110 active:scale-95 transition-all disabled:opacity-20 shadow-[0_0_15px_rgba(124,58,237,0.3)]">
                      <SendIcon className="w-5 h-5" />
                    </button>
                  </form>
                </div>

                <div className="flex items-center justify-between mt-4 px-2">
                  <div className="flex items-center gap-2.5">
                    <SparklesIcon className="w-3.5 h-3.5 text-secondary opacity-60" />
                    <span className="text-[8px] font-mono text-white/70 uppercase tracking-[0.3em] italic">All chats are encrypted</span>
                  </div>
                </div>
              </div>

              {/* Transit Modal - Contained to Chat Area */}
              <AnimatePresence>
                {isTransitModalOpen && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      onClick={() => setIsTransitModalOpen(false)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      className="relative w-full max-w-sm bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
                      
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-heading font-bold text-white tracking-tight">Cipher Transit</h3>
                          <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mt-1">Sovereign Value Portal</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                          <CoinsIcon className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-secondary/20 flex items-center justify-center text-secondary font-bold text-[10px]">
                            {conversations.find(c => c.id === activeChat)?.name.substring(0, 2)}
                          </div>
                          <div className="flex-1 overflow-hidden text-left">
                            <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{conversations.find(c => c.id === activeChat)?.name}</p>
                            <p className="text-[8px] font-mono text-white/40 truncate mt-0.5">{activeChat}</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[8px] font-mono text-white/40 uppercase tracking-widest mb-2">Amount (LEZ)</label>
                          <input 
                            type="text" 
                            value={transitAmount}
                            onChange={(e) => setTransitAmount(e.target.value)}
                            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-xl font-bold text-white outline-none focus:border-primary/50 transition-all font-mono"
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="block text-[8px] font-mono text-white/40 uppercase tracking-widest mb-2">Optional Note</label>
                          <textarea 
                            value={transitNote}
                            onChange={(e) => setTransitNote(e.target.value)}
                            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-[10px] text-white outline-none focus:border-primary/50 transition-all resize-none h-20 font-body"
                            placeholder="TRANSIT NOTE..."
                          />
                        </div>

                        <button 
                          onClick={handleSendValue}
                          className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          Confirm Transit
                          <ShieldCheckIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </>
  );
}
