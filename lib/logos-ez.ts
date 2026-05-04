/**
 * Logos Execution Zone (LEZ) Integration Utility.
 * Matches the official 'wallet' CLI patterns for the Logos Execution Environment (LEE).
 */

export interface LEZTransaction {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  amount?: number;
}

export const LogosExecutionZone = {
  /**
   * Initializes an account under the 'authenticated-transfer' program.
   */
  async initializeAccount(accountId: string, isPrivate: boolean): Promise<LEZTransaction> {
    const fullId = `${isPrivate ? 'Private' : 'Public'}/${accountId}`;
    console.log(`[Logos-LEZ] Executing: wallet auth-transfer init --account-id ${fullId}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          hash: '0x' + Math.random().toString(16).slice(2),
          status: 'confirmed'
        });
      }, 1500);
    });
  },

  /**
   * Internal helper to get state for a specific identity
   */
  async _getState(accountId: string) {
    try {
      const res = await fetch('/api/mock-lez', { 
        method: 'POST', 
        body: JSON.stringify({ action: 'get_state', accountId }),
        cache: 'no-store'
      });
      return await res.json();
    } catch (e) {
      return { balance: 0, claimed: false };
    }
  },

  /**
   * Transfers native or custom tokens. 
   */
  async transfer(from: string, to: string, amount: string | number, isPrivate: boolean = true): Promise<LEZTransaction & { success: boolean }> {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    const res = await fetch('/api/mock-lez', { 
      method: 'POST', 
      body: JSON.stringify({ action: 'transfer', from, to, amount: numAmount }) 
    });

    if (!res.ok) {
      throw new Error('Insufficient LEZ balance');
    }
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          hash: '0x' + Math.random().toString(16).slice(2),
          status: 'confirmed',
          amount: numAmount,
          success: true
        });
      }, 2000);
    });
  },

  async transferTokens(from: string, to: string, amount: number, isPrivate: boolean): Promise<LEZTransaction> {
    return this.transfer(from, to, amount, isPrivate);
  },

  /**
   * Retrieves the current balance for a specific identity.
   */
  async getBalance(accountId: string, isPrivate: boolean): Promise<number> {
    const state = await this._getState(accountId);
    return state.balance;
  },

  /**
   * Checks if the identity has already claimed their faucet gift.
   */
  async hasClaimedGift(accountId: string): Promise<boolean> {
    const state = await this._getState(accountId);
    return !!state.claimed;
  },

  /**
   * Claims 150 native tokens from the Piñata faucet.
   */
  async claimFaucet(to: string, isPrivate: boolean): Promise<LEZTransaction> {
    const res = await fetch('/api/mock-lez', { 
      method: 'POST', 
      body: JSON.stringify({ action: 'claim_faucet', accountId: to }) 
    });

    if (!res.ok) {
      throw new Error('Gift already claimed for this identity');
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          hash: '0x' + Math.random().toString(16).slice(2),
          status: 'confirmed',
          amount: 150
        });
      }, 1200);
    });
  },

  /**
   * Scans the chain for encrypted values and updates local private state.
   */
  async syncPrivateState(): Promise<boolean> {
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  },

  /**
   * Persists arbitrary metadata (e.g. bookmarks) to the Logos ledger.
   */
  async saveMetadata(accountId: string, key: string, value: any): Promise<boolean> {
    console.log(`[Logos-LEZ] Saving metadata ${key} to ledger for ${accountId}`);
    const res = await fetch('/api/mock-lez', {
      method: 'POST',
      body: JSON.stringify({ action: 'save_state', accountId, amount: { [key]: value } })
    });
    return res.ok;
  },

  /**
   * Retrieves metadata from the Logos ledger.
   */
  async getMetadata(accountId: string, key: string): Promise<any> {
    const state = await this._getState(accountId);
    return state[key];
  },

  /**
   * CLOUD VAULT: Saves an encrypted identity vault to the Logos ledger.
   * Keyed by alias for easy recovery.
   */
  async saveVault(alias: string, encryptedVault: string): Promise<boolean> {
    console.log(`[Logos-LEZ] Backing up Vault to ledger for ${alias}`);
    const res = await fetch('/api/mock-lez', {
      method: 'POST',
      body: JSON.stringify({ action: 'save_state', accountId: alias, amount: { vault: encryptedVault } })
    });
    return res.ok;
  },

  /**
   * CLOUD VAULT: Retrieves an encrypted identity vault from the Logos ledger.
   */
  async getVault(alias: string): Promise<string | null> {
    const state = await this._getState(alias);
    return state.vault || null;
  },

  /**
   * GLOBAL FEED: Saves a post to a shared ledger account for multi-user visibility.
   */
  async saveGlobalPost(post: any): Promise<boolean> {
    const GLOBAL_FEED_ID = 'logos_global_feed';
    const state = await this._getState(GLOBAL_FEED_ID);
    const existingPosts = state.posts || [];
    const updated = [post, ...existingPosts].slice(0, 100); // Keep last 100
    return this.saveMetadata(GLOBAL_FEED_ID, 'posts', updated);
  },

  /**
   * GLOBAL FEED: Retrieves all shared posts from the Logos ledger.
   */
  async getGlobalPosts(): Promise<any[]> {
    const GLOBAL_FEED_ID = 'logos_global_feed';
    const state = await this._getState(GLOBAL_FEED_ID);
    return state.posts || [];
  },

  /**
   * GLOBAL FEED: Deletes a post from the global ledger.
   */
  async deleteGlobalPost(postId: string): Promise<boolean> {
    const GLOBAL_FEED_ID = 'logos_global_feed';
    const state = await this._getState(GLOBAL_FEED_ID);
    const existingPosts = state.posts || [];
    const updated = existingPosts.filter((p: any) => p.id !== postId);
    return this.saveMetadata(GLOBAL_FEED_ID, 'posts', updated);
  },

  /**
   * GLOBAL FEED: Edits a post's content on the global ledger.
   */
  async editGlobalPost(postId: string, newContent: string): Promise<boolean> {
    const GLOBAL_FEED_ID = 'logos_global_feed';
    const state = await this._getState(GLOBAL_FEED_ID);
    const existingPosts = state.posts || [];
    const updated = existingPosts.map((p: any) => 
      p.id === postId ? { ...p, content: newContent, isEdited: true } : p
    );
    return this.saveMetadata(GLOBAL_FEED_ID, 'posts', updated);
  },

  /**
   * GLOBAL FEED: Updates the bookmark count for a post on the global ledger.
   */
  async updateGlobalBookmarkCount(postId: string, increment: boolean): Promise<boolean> {
    const GLOBAL_FEED_ID = 'logos_global_feed';
    const state = await this._getState(GLOBAL_FEED_ID);
    const existingPosts = state.posts || [];
    const updated = existingPosts.map((p: any) => {
      if (p.id === postId) {
        const currentCount = p.bookmarkCount || 0;
        return { ...p, bookmarkCount: Math.max(0, increment ? currentCount + 1 : currentCount - 1) };
      }
      return p;
    });
    return this.saveMetadata(GLOBAL_FEED_ID, 'posts', updated);
  },

  /**
   * GLOBAL TIPS: Saves a tip message to the shared ledger.
   */
  async saveGlobalTip(tip: any): Promise<boolean> {
    const GLOBAL_FEED_ID = 'logos_global_feed';
    const state = await this._getState(GLOBAL_FEED_ID);
    const existingTips = state.tips || [];
    // Key-based deduplication
    const key = `${tip.postId}-${tip.sender}-${tip.timestamp}`;
    if (existingTips.some((t: any) => `${t.postId}-${t.sender}-${t.timestamp}` === key)) return true;
    
    const updated = [tip, ...existingTips].slice(0, 500); // Keep last 500 tips
    return this.saveMetadata(GLOBAL_FEED_ID, 'tips', updated);
  },

  /**
   * GLOBAL TIPS: Retrieves all shared tips from the Logos ledger.
   */
  async getGlobalTips(): Promise<any[]> {
    const GLOBAL_FEED_ID = 'logos_global_feed';
    const state = await this._getState(GLOBAL_FEED_ID);
    return state.tips || [];
  }
};

