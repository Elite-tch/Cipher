'use client';

import { useCipherID } from '@/hooks/useCipherID';
import { motion } from 'framer-motion';

const MOCK_TIPS = [
  { id: '1', from: '0x00f5ff...', fromAlias: 'cipher#CREATOR', amount: 50, timestamp: Date.now() - 3600000, post: 'Just shipped the bonding curve...' },
  { id: '2', from: '0x7c3aed...', fromAlias: 'cipher#LOGOS', amount: 25, timestamp: Date.now() - 86400000, post: 'Welcome to the Genesis of Cipher.' },
  { id: '3', from: '0x9d2b4f...', fromAlias: 'cipher#DEV', amount: 100, timestamp: Date.now() - 172800000, post: 'Building privacy first.' }
];

export default function TipsPage() {
  const { identity } = useCipherID();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="glass-card p-6 border-primary/20">
        <h2 className="text-xl font-heading font-black text-white uppercase tracking-widest mb-2">
          Recent Tips & Value Flow
        </h2>
        <p className="text-sm text-white/50 font-body">
          A decentralized ledger of micro-transactions (LEZ) supporting creators on the Logos network.
        </p>
      </div>

      <div className="space-y-4">
        {MOCK_TIPS.map((tip, idx) => (
          <motion.div
            key={tip.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-4 hover:border-success/30 transition-all duration-300 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success text-xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                ✧
              </div>
              <div>
                <p className="text-sm text-white font-semibold">
                  Received <span className="text-success font-bold">{tip.amount} LEZ</span> from {tip.fromAlias}
                </p>
                <p className="text-[10px] font-mono text-white/30 truncate max-w-xs mt-1">
                  On post: "{tip.post}"
                </p>
              </div>
            </div>
            <div className="text-[10px] font-mono text-white/20 tracking-widest text-right">
              {new Date(tip.timestamp).toLocaleDateString()} <br />
              {new Date(tip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </motion.div>
        ))}

        {!identity && (
          <div className="p-8 text-center border border-white/5 rounded-2xl bg-white/5">
            <p className="text-white/40 font-mono text-xs uppercase tracking-widest">Connect ID to view your personal ledger</p>
          </div>
        )}
      </div>
    </div>
  );
}
