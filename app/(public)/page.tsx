'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCipherID } from '@/hooks/useCipherID';

export default function Home() {
  const { isAuthenticated } = useCipherID();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-background pt-32 pb-20 px-6">
      
      {/* Background Kinetic Glows */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px] animate-pulse-slow opacity-60" />
      <div className="absolute bottom-[0%] right-[-10%] h-[500px] w-[500px] rounded-full bg-secondary/15 blur-[120px] animate-pulse-slow opacity-50" />
      
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center gap-16">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center gap-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass border border-white/10 text-secondary text-[10px] font-mono tracking-[0.2em] uppercase">
            <span className="flex h-2 w-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.8)]" />
            Logos Network Ready
          </div>
          
          <div className="space-y-2">
            <h1 className="text-7xl md:text-9xl font-heading font-bold tracking-tighter text-white leading-none">
              CIPHER
            </h1>
            <p className="text-xl md:text-2xl font-body text-white font-light tracking-tight">
              Private <span className="text-primary font-medium opacity-100">tipping + messaging</span> for builders and communities.
            </p>
          </div>

          <p className="text-lg text-white/30 font-body max-w-lg leading-relaxed">
            Discover value. Support work with instant tips. Connect privately via the Logos Mixnet. <br />
            Owned by you, secured by Logos.
          </p>

          <button 
            onClick={() => router.push('/auth')}
            className="mt-8 px-10 py-4 rounded-full gradient-primary text-white font-bold text-xs uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:shadow-[0_0_50px_rgba(124,58,237,0.6)] transition-all active:scale-95"
          >
            Enter the Network
          </button>
      </div>

        {/* Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {[
            { label: 'Discovery', desc: 'Find people and projects worth supporting', icon: '◈', color: 'primary' },
            { label: 'Money', desc: 'Instant on-chain value flow with zero fees', icon: '✧', color: 'secondary' },
            { label: 'Connection', desc: 'E2EE messaging via the Logos Mixnet', icon: '▣', color: 'primary' },
          ].map((item, i) => (
            <div key={i} className="glass-card flex flex-col items-start gap-4 p-6 min-h-[180px] group cursor-default">
              <div className={`text-3xl transition-transform duration-500 group-hover:rotate-12 ${item.color === 'primary' ? 'text-primary' : 'text-secondary'}`}>
                {item.icon}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-heading font-semibold text-white group-hover:text-primary transition-colors">
                  {item.label}
                </h3>
                <p className="text-sm text-white/40 leading-snug">
                  {item.desc}
                </p>
                    </div>
                  </div>
                ))}
              </div>

        {/* Manifesto Section */}
        <div className="w-full max-w-3xl pt-8">
          <div className="glass rounded-[2rem] p-10 border border-white/5 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <p className="text-white/70 font-body italic text-lg md:text-xl leading-relaxed relative z-10">
              "Not social media. Not a payment app. Not a chat tool. <br />
              A network where people <span className="text-white font-medium not-italic">discover value</span> — and instantly support it."
            </p>
              </div>
            </div>

        {/* Tech Specs Footer */}
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 pt-4 text-[10px] font-mono tracking-[0.3em] uppercase text-white/20">
          <span>Blockchain</span>
          <span>Mixnet</span>
          <span>Storage</span>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </main>
  );
}
