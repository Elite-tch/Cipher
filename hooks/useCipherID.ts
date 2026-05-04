'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CipherIdentity,
  getStoredIdentity,
  saveIdentity,
  generateIdentity,
  clearIdentity
} from '@/lib/crypto';

export function useCipherID() {
  const [identity, setIdentity] = useState<CipherIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load identity from localStorage on mount
  useEffect(() => {
    const stored = getStoredIdentity();
    if (stored) {
      setIdentity(stored);
    }
    setIsLoading(false);
  }, []);

  /**
   * Create a new identity and save it locally
   */
  const createID = useCallback(async () => {
    setIsLoading(true);
    try {
      const newIdentity = await generateIdentity();
      saveIdentity(newIdentity);
      setIdentity(newIdentity);
      return newIdentity;
    } catch (error) {
      console.error('Failed to generate Cipher ID:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Remove identity from local storage
   */
  const logout = useCallback(() => {
    clearIdentity();
    setIdentity(null);
  }, []);

  /**
   * Import an existing identity from a recovery mnemonic
   */
  const importID = useCallback(async (mnemonic: string) => {
    setIsLoading(true);
    try {
      const newIdentity = await generateIdentity(mnemonic);
      saveIdentity(newIdentity);
      setIdentity(newIdentity);
      return newIdentity;
    } catch (error) {
      console.error('Failed to import Cipher ID:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    identity,
    isLoading,
    createID,
    importID,
    logout,
    isAuthenticated: !!identity,
  };
}
