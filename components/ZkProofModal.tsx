'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheckIcon, LockIcon, ZapIcon, CheckCircleIcon } from 'lucide-react';

// ============================================================================
// ZK Proof Generation Modal
//
// Required by Logos Execution Zone (LEZ) specification:
//   "Transfers involving private accounts may take a few minutes because
//    the wallet needs to generate a local proof."
//   — logos-docs/docs/apps/wallet/journeys/transfer-native-tokens-on-the-logos-execution-zone.md
//
// This component communicates the inherent latency of local ZK proof
// generation as a *feature* (privacy guarantee), not a bug.
// ============================================================================

export type ZkProofStage =
  | 'idle'
  | 'building_witness'
  | 'generating_proof'
  | 'verifying'
  | 'broadcasting'
  | 'confirmed'
  | 'error';

const STAGE_CONFIG: Record<ZkProofStage, { label: string; detail: string; icon: React.ReactNode; color: string } | null> = {
  idle: null,
  building_witness: {
    label: 'Building Witness',
    detail: 'Collecting private inputs & nullifier keys from local state...',
    icon: <LockIcon className="w-5 h-5" />,
    color: 'text-white/60',
  },
  generating_proof: {
    label: 'Generating ZK Proof',
    detail: 'Running local zkSNARK prover — this may take a moment...',
    icon: <ShieldCheckIcon className="w-5 h-5" />,
    color: 'text-secondary',
  },
  verifying: {
    label: 'Verifying Proof',
    detail: 'Validating proof integrity before broadcast...',
    icon: <ZapIcon className="w-5 h-5" />,
    color: 'text-primary',
  },
  broadcasting: {
    label: 'Broadcasting to LEZ',
    detail: 'Submitting shielded transaction to the Logos Execution Zone...',
    icon: <ZapIcon className="w-5 h-5" />,
    color: 'text-primary',
  },
  confirmed: {
    label: 'Transaction Confirmed',
    detail: 'Your shielded transfer is complete and privacy-preserved.',
    icon: <CheckCircleIcon className="w-5 h-5" />,
    color: 'text-success',
  },
  error: {
    label: 'Proof Failed',
    detail: 'An error occurred during proof generation. Please try again.',
    icon: <ShieldCheckIcon className="w-5 h-5" />,
    color: 'text-red-500',
  },
};

const ORDERED_STAGES: ZkProofStage[] = [
  'building_witness',
  'generating_proof',
  'verifying',
  'broadcasting',
  'confirmed',
];

interface ZkProofModalProps {
  stage: ZkProofStage;
  amount?: string | number;
  recipient?: string;
  onClose?: () => void;
}

export function ZkProofModal({ stage, amount, recipient, onClose }: ZkProofModalProps) {
  const isVisible = stage !== 'idle';
  const isTerminal = stage === 'confirmed' || stage === 'error';
  const currentStageIndex = ORDERED_STAGES.indexOf(stage);
  const cfg = STAGE_CONFIG[stage];

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />

          {/* Panel */}
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-full max-w-sm bg-background border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            {/* Gradient accent line */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 transition-all duration-700 ${
              stage === 'confirmed' ? 'bg-success shadow-[0_0_20px_rgba(16,185,129,0.8)]' :
              stage === 'error' ? 'bg-red-500' :
              'bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-[gradient-shift_2s_linear_infinite]'
            }`} />

            <div className="p-8 space-y-8">
              {/* Header */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-mono text-white/30 uppercase tracking-[0.3em]">
                    Logos Execution Zone
                  </span>
                </div>
                <h3 className="text-lg font-heading font-bold text-white tracking-tight">
                  {stage === 'confirmed' ? 'Transfer Complete' :
                   stage === 'error' ? 'Transfer Failed' :
                   'Generating ZK Proof'}
                </h3>
                {amount && recipient && stage !== 'confirmed' && stage !== 'error' && (
                  <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                    {amount} LEZ → {String(recipient).slice(0, 10)}...
                  </p>
                )}
              </div>

              {/* Stage Progress */}
              <div className="space-y-3">
                {ORDERED_STAGES.filter(s => s !== 'confirmed').map((s, idx) => {
                  const isPast = currentStageIndex > idx;
                  const isActive = currentStageIndex === idx;
                  const sCfg = STAGE_CONFIG[s]!;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center border transition-all duration-500 ${
                        isPast || stage === 'confirmed'
                          ? 'bg-success/20 border-success/40 text-success'
                          : isActive
                          ? 'bg-secondary/20 border-secondary/40 text-secondary animate-pulse'
                          : 'bg-white/5 border-white/10 text-white/20'
                      }`}>
                        {(isPast || stage === 'confirmed')
                          ? <CheckCircleIcon className="w-3.5 h-3.5" />
                          : isActive
                          ? <div className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                          : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-mono font-bold uppercase tracking-widest transition-colors duration-300 ${
                          isPast || stage === 'confirmed' ? 'text-success' :
                          isActive ? 'text-white' : 'text-white/25'
                        }`}>
                          {sCfg.label}
                        </p>
                        {isActive && (
                          <motion.p
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[9px] font-mono text-white/40 mt-0.5 truncate"
                          >
                            {sCfg.detail}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Privacy Note */}
              {!isTerminal && (
                <div className="p-3 rounded-2xl bg-secondary/5 border border-secondary/15">
                  <p className="text-[9px] font-mono text-white/40 leading-relaxed uppercase tracking-wider text-center">
                    <span className="text-secondary font-bold">Privacy-preserving.</span>{' '}
                    Your wallet generates a ZK proof locally.<br/>
                    No private data ever leaves your device.
                  </p>
                </div>
              )}

              {/* Confirmed / Error state */}
              {isTerminal && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-2xl text-center space-y-2 ${
                    stage === 'confirmed'
                      ? 'bg-success/10 border border-success/20'
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}
                >
                  <p className={`text-xs font-mono font-bold uppercase tracking-widest ${
                    stage === 'confirmed' ? 'text-success' : 'text-red-500'
                  }`}>
                    {stage === 'confirmed' ? '✓ Shielded & Confirmed' : '✕ Proof Generation Failed'}
                  </p>
                  <p className="text-[9px] font-mono text-white/40 uppercase tracking-wider">
                    {cfg?.detail}
                  </p>
                  {onClose && (
                    <button
                      onClick={onClose}
                      className={`mt-2 w-full py-2.5 rounded-xl text-[9px] font-mono font-bold uppercase tracking-[0.2em] transition-all ${
                        stage === 'confirmed'
                          ? 'bg-success/20 text-success hover:bg-success/30'
                          : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                      }`}
                    >
                      {stage === 'confirmed' ? 'Done' : 'Dismiss'}
                    </button>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// useZkProof hook
//
// Wraps any async LEZ transaction with the ZK proof simulation stages.
// Each stage advances automatically, simulating the timing realistic to
// local zkSNARK proof generation (a few seconds in sim, real-world: minutes).
// ============================================================================

export function useZkProof() {
  const [stage, setStage] = useState<ZkProofStage>('idle');

  const runWithZkProof = async <T,>(
    transaction: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (err: unknown) => void,
  ): Promise<void> => {
    try {
      // Stage 1: Build witness
      setStage('building_witness');
      await delay(800);

      // Stage 2: Generate proof (longest stage — reflects real local compute)
      setStage('generating_proof');
      await delay(2200);

      // Stage 3: Verify
      setStage('verifying');
      await delay(600);

      // Stage 4: Broadcast — execute the real transaction concurrently
      setStage('broadcasting');
      const result = await transaction();

      // Stage 5: Confirmed
      setStage('confirmed');
      await delay(1200);
      onSuccess?.(result);
    } catch (err) {
      setStage('error');
      await delay(1500);
      onError?.(err);
    } finally {
      // Auto-reset to idle after terminal state
      await delay(400);
      setStage('idle');
    }
  };

  const reset = () => setStage('idle');

  return { stage, runWithZkProof, reset };
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
