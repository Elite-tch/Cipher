'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCipherID } from '@/hooks/useCipherID';
import React from 'react';

export default function Navbar() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCipherID();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-6">
      <div className="glass w-full max-w-2xl rounded-full px-6 py-3 flex items-center justify-between border border-white/5 shadow-2xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center font-bold text-white text-xs shadow-[0_0_15px_rgba(124,58,237,0.4)] group-hover:scale-110 transition-transform">
            C
          </div>
          <span className="font-heading font-bold text-xl tracking-tighter text-white">
            CIPHER
          </span>
        </Link>

        {/* Action Button */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push(isAuthenticated ? '/dashboard' : '/auth')}
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-full text-[11px] font-bold tracking-[0.1em] transition-all active:scale-95 uppercase shadow-2xl ${
              isAuthenticated 
                ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10' 
                : 'gradient-primary text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                LOADING...
              </span>
            ) : isAuthenticated ? (
              'Enter Dashboard'
            ) : (
              'Get Started'
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
