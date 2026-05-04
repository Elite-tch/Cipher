import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const STORAGE_FILE = path.join(process.cwd(), '.lez-mock.json');

function getStorage(): Record<string, { balance: number, claimed: boolean }> {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read LEZ storage', e);
  }
  return {};
}

function saveStorage(data: Record<string, { balance: number, claimed: boolean }>) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to write LEZ storage', e);
  }
}

export async function POST(req: Request) {
  try {
    const { action, accountId, amount, from, to } = await req.json();
    const store = getStorage();

    if (action === 'get_state') {
      const state = store[accountId] || { balance: 0, claimed: false };
      return NextResponse.json(state);
    }

    if (action === 'save_state') {
      store[accountId] = { ...store[accountId], ...amount };
      saveStorage(store);
      return NextResponse.json({ success: true });
    }

    if (action === 'transfer') {
      const numAmount = parseFloat(amount);
      const fromState = store[from] || { balance: 0, claimed: false };
      const toState = store[to] || { balance: 0, claimed: false };

      if (fromState.balance < numAmount) {
        return NextResponse.json({ error: 'Insufficient LEZ balance' }, { status: 400 });
      }

      fromState.balance -= numAmount;
      toState.balance += numAmount;

      store[from] = fromState;
      store[to] = toState;
      saveStorage(store);

      return NextResponse.json({ success: true });
    }

    if (action === 'claim_faucet') {
      const state = store[accountId] || { balance: 0, claimed: false };
      if (state.claimed) {
        return NextResponse.json({ error: 'Gift already claimed' }, { status: 400 });
      }
      state.balance += 150;
      state.claimed = true;
      store[accountId] = state;
      saveStorage(store);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Mock LEZ failed' }, { status: 500 });
  }
}
