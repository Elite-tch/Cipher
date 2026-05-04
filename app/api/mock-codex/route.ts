import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const STORAGE_FILE = path.join(process.cwd(), '.codex-mock.json');

function getStorage(): Record<string, string> {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read storage', e);
  }
  return {};
}

function saveStorage(data: Record<string, string>) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to write storage', e);
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.text();
    // Create a fake CID
    const cid = 'mock-bafy-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const store = getStorage();
    store[cid] = data;
    saveStorage(store);
    return NextResponse.json({ cid });
  } catch (err) {
    return NextResponse.json({ error: 'Mock upload failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cid = searchParams.get('cid');
  
  if (!cid) {
    return new NextResponse('Not found', { status: 404 });
  }
  
  const store = getStorage();
  const data = store[cid];
  
  if (!data) {
    return new NextResponse('Not found', { status: 404 });
  }
  
  // If it's a base64 data URL, decode it and return the binary image
  if (data.startsWith('data:')) {
    const arr = data.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const contentType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const buffer = Buffer.from(arr[1], 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
      },
    });
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
