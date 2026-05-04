'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCipherID } from '../../../hooks/useCipherID';
import { LogosExecutionZone } from '../../../lib/logos-ez';
import { 
  UserPlusIcon, 
  LogInIcon, 
  ShieldCheckIcon, 
  ArrowRightIcon,
  SparklesIcon,
  KeyIcon,
  LockIcon,
  AtSignIcon,
  CloudIcon
} from 'lucide-react';
import { encryptIdentity, decryptIdentity } from '../../../lib/crypto';

export default function AuthPage() {
  const router = useRouter();
  const { createID, importID, isAuthenticated } = useCipherID();
  const [mode, setMode] = useState<'selection' | 'signup' | 'login'>('selection');
  const [mnemonic, setMnemonic] = useState('');
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated && !isProcessing) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isProcessing, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return toast.error('Please set a password');
    
    setIsProcessing(true);
    const toastId = toast.loading('Generating your sovereign identity...');
    try {
      // 1. Create the ID
      const newId = await createID();
      
      // 2. Encrypt the Vault
      toast.loading('Encrypting your identity vault...', { id: toastId });
      const encryptedVault = await encryptIdentity(newId, password);
      
      // 3. Back up to Logos Ledger (Cloud Vault)
      toast.loading('Backing up vault to Logos Ledger...', { id: toastId });
      await LogosExecutionZone.saveVault(newId.alias, encryptedVault);
      
      // 4. Initialize account on Logos
      toast.loading('Initializing account primitives...', { id: toastId });
      await LogosExecutionZone.initializeAccount(newId.peerId, false);
      
      // 5. Claim faucet
      toast.loading('Claiming welcome gift...', { id: toastId });
      await LogosExecutionZone.claimFaucet(newId.peerId, false);

      toast.success(`Identity backed up! Your alias is ${newId.alias}`, { id: toastId, duration: 5000 });
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Could not complete setup. Please try again.', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloudLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alias || !password) return;

    setIsProcessing(true);
    const toastId = toast.loading(`Retrieving vault for ${alias}...`);
    try {
      // 1. Fetch from Logos
      const encryptedVault = await LogosExecutionZone.getVault(alias);
      if (!encryptedVault) {
        throw new Error('No vault found for this alias on the Logos network.');
      }

      // 2. Decrypt
      toast.loading('Decrypting vault locally...', { id: toastId });
      const identity = await decryptIdentity(encryptedVault, password);
      
      // 3. Import to Session
      await importID(identity.mnemonic);
      
      toast.success('Sovereign identity recovered from ledger!', { id: toastId });
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Incorrect alias or password.', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMnemonicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mnemonic.trim()) return;

    setIsProcessing(true);
    const toastId = toast.loading('Reconstructing identity from mnemonic...');
    try {
      await importID(mnemonic.trim());
      toast.success('Welcome back! 👋', { id: toastId });
      router.push('/dashboard');
    } catch (err) {
      toast.error('Invalid backup phrase.', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden font-inter">
      {/* Background glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/15 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/15 rounded-full blur-[120px] animate-pulse" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl relative pt-[10%] z-10"
      >
        {/* Branding */}
        <div className="text-center mb-6">
        
          <h1 className="text-4xl font-heading font-black text-white tracking-tighter uppercase">Welcome</h1>
          <p className="text-sm text-white mt-3">Register your account to join a private social network built for you.</p>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'selection' && (
            <motion.div 
              key="selection"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* Sign Up */}
              <button 
                onClick={() => setMode('signup')}
                className="glass-card group p-8 text-left hover:border-primary/40 transition-all active:scale-[0.98]"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 mb-6 group-hover:scale-110 transition-transform">
                  <UserPlusIcon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Sign Up</h3>
                <p className="text-sm text-white/70 leading-relaxed">New here? Create your free account and join the community in seconds.</p>
                <div className="mt-8 flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                  Get Started <ArrowRightIcon className="w-3 h-3" />
                </div>
              </button>

              {/* Log In */}
              <button 
                onClick={() => setMode('login')}
                className="glass-card group p-8 text-left hover:border-secondary/40 transition-all active:scale-[0.98]"
              >
                <div className="h-12 w-12 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary border border-secondary/30 mb-6 group-hover:scale-110 transition-transform">
                  <LogInIcon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Log In</h3>
                <p className="text-sm text-white/70 leading-relaxed">Already have an account? Recover your identity from the Logos ledger.</p>
                <div className="mt-8 flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                  Log In <ArrowRightIcon className="w-3 h-3" />
                </div>
              </button>
            </motion.div>
          )}

          {mode === 'signup' && (
            <motion.div 
              key="signup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-10 text-center space-y-8"
            >
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 relative">
                  <SparklesIcon className="w-10 h-10 animate-pulse" />
                  <div className="absolute -inset-4 bg-primary/20 blur-3xl -z-10 rounded-full" />
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-white">Logos Cloud Vault</h3>
                <p className="text-sm text-white/80 max-w-xs mx-auto leading-relaxed">
                  We'll encrypt your identity and back it up to the Logos Ledger. You can log in from any device with your alias and password.
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="text-left space-y-2">
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest ml-1">Create Access Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="MIN. 8 CHARACTERS..."
                    className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    type="submit"
                    disabled={isProcessing || password.length < 8}
                    className="w-full py-4 rounded-2xl gradient-primary text-white font-bold text-sm shadow-[0_0_30px_rgba(124,58,237,0.3)] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isProcessing ? 'Initializing Ledger...' : 'Secure & Create Account'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMode('selection')}
                    disabled={isProcessing}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    ← Go back
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {mode === 'login' && (
            <motion.div 
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card px-10 py-4 space-y-8"
            >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary border border-secondary/30">
                    <CloudIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Ledger Recovery</h3>
                    <p className="text-sm text-white/70 mt-1">Recover your vault from the Logos network.</p>
                  </div>
                </div>

                <form onSubmit={handleCloudLogin} className="space-y-5">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest ml-1">Logos Alias</label>
                      <div className="relative">
                        <AtSignIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          value={alias}
                          onChange={(e) => setAlias(e.target.value)}
                          placeholder="CIPHER#1234..."
                          className="w-full bg-white/[0.05] border border-white/10 rounded-2xl pl-11 pr-5 py-3.5 text-sm text-white placeholder:text-white/20 focus:border-secondary/50 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest ml-1">Vault Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="ENTER PASSWORD..."
                        className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-white/20 focus:border-secondary/50 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button 
                      type="submit"
                      disabled={isProcessing || !alias || !password}
                      className="w-full py-4 rounded-2xl bg-secondary text-black font-bold text-sm shadow-[0_0_30px_rgba(0,245,255,0.2)] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isProcessing ? 'Contacting Ledger...' : 'Recover Vault'}
                    </button>
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                      <div className="relative flex justify-center text-[8px] uppercase tracking-widest font-mono"><span className="bg-background px-2 text-white/20">or use backup phrase</span></div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setMode('selection')} // You could add a 'mnemonic' mode if you want, but I'll keep it simple
                      className="text-xs text-white/40 hover:text-white/70 transition-all text-center"
                    >
                      Use 12-Word Phrase Instead
                    </button>
                  </div>
                </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-10 text-center flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-secondary" />
            Your data is private and belongs only to you.
          </div>
        </div>
      </motion.div>
    </div>
  );
}
