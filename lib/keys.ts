import { LogosExecutionZone } from './logos-ez';
import { decryptData } from './encryption';

/**
 * CIPHER KEY ECONOMY (Bonding Curve)
 * 
 * Formula: Price = (Supply^2 / 1000) + 0.01 LEZ
 * Every creator has a unique Key. As more people buy, the price rises.
 * Holders get exclusive access to locked posts and private Circles.
 */

const KEY_LEDGER_CACHE = 'cipher_key_ledger';
const CONSTANT = 2000; // Adjusts the steepness of the curve

export interface KeyState {
  creator: string;
  supply: number;
  holders: string[]; // List of public keys
}

/**
 * Calculates the current price of a creator's key.
 */
export function calculateKeyPrice(supply: number): number {
  const price = (Math.pow(supply, 2) / CONSTANT) + 0.01;
  return parseFloat(price.toFixed(4));
}

const GLOBAL_LEDGER_ACCOUNT = 'system_key_ledger';

/**
 * Gets the ledger from Logos Network persistence.
 */
async function getLedger(): Promise<Record<string, KeyState>> {
  try {
    const remote = await LogosExecutionZone.getMetadata(GLOBAL_LEDGER_ACCOUNT, 'ledger');
    return remote || {};
  } catch (e) {
    return {};
  }
}

/**
 * Saves the ledger to Logos Network persistence.
 */
async function saveLedger(ledger: Record<string, KeyState>) {
  await LogosExecutionZone.saveMetadata(GLOBAL_LEDGER_ACCOUNT, 'ledger', ledger);
}

/**
 * Gets the key state for a specific creator.
 */
export async function getKeyState(creator: string): Promise<KeyState> {
  const ledger = await getLedger();
  if (!ledger[creator]) {
    return { creator, supply: 0, holders: [] };
  }
  return ledger[creator];
}

/**
 * Executes a Key Purchase on the Logos Execution Zone.
 */
export async function buyKey(creator: string, buyer: string): Promise<{ success: boolean; txHash?: string }> {
  const state = await getKeyState(creator);
  const price = calculateKeyPrice(state.supply);

  console.log(`[Logos] Initiating Key Purchase: ${buyer} -> ${creator} (${price} LEZ)`);

  try {
    // 1. Execute transfer on LEZ (Shielded Vault)
    const tx = await LogosExecutionZone.transferTokens(buyer, creator, price, true);
    
    if (tx.status === 'confirmed') {
      // 2. Update Ledger state
      const ledger = await getLedger();
      const updatedState = {
        ...state,
        supply: state.supply + 1,
        holders: [...state.holders, buyer]
      };
      ledger[creator] = updatedState;
      await saveLedger(ledger);
      
      console.log(`[Logos] ✓ Key Acquired. New Supply: ${updatedState.supply}`);
      return { success: true, txHash: tx.hash };
    }
    return { success: false };
  } catch (err) {
    console.error('[Logos] Key purchase failed:', err);
    throw err;
  }
}

/**
 * Checks if a user owns a creator's key.
 */
export async function hasKey(user: string, creator: string): Promise<boolean> {
  if (user === creator) return true; // Creator always has their own key
  const state = await getKeyState(creator);
  return state.holders.includes(user);
}
