/**
 * LOGOS CODEX (Decentralized Durability Engine)
 * 
 * Codex provides censorship-resistant, decentralized storage for large assets.
 * We use it to store post images and other media, avoiding heavy Waku payloads.
 * 
 * In a real environment, this connects to a local or remote Codex node's REST API.
 */

// Replace with actual Codex node API endpoint, often localhost:8080 or a public gateway
const CODEX_API_ENDPOINT = process.env.NEXT_PUBLIC_CODEX_API || 'http://localhost:8080/api/codex/v1';
// Public gateway for fetching if local node isn't available
const CODEX_GATEWAY_URL = process.env.NEXT_PUBLIC_CODEX_GATEWAY || 'http://localhost:8080/api/codex/v1';

/**
 * Uploads an asset to the Logos Codex network via the Decentralized Durability Engine REST API.
 * Returns a Content Identifier (CID).
 */
export async function uploadToCodex(data: string | File): Promise<string> {
  console.log('[Logos-Codex] Uploading asset to Decentralized Durability Engine...');
  
  try {
    let body: BodyInit;
    let contentType = 'application/octet-stream';

    if (data instanceof File) {
      body = data;
      contentType = data.type || 'application/octet-stream';
    } else if (typeof data === 'string') {
      // If it's a data URL (e.g. from a file picker readAsDataURL), extract the binary
      if (data.startsWith('data:')) {
        const arr = data.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        contentType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        body = new Blob([u8arr], { type: contentType });
      } else {
        body = data;
        contentType = 'text/plain';
      }
    } else {
      throw new Error('Unsupported data type for Codex upload');
    }

    // Standard Codex upload endpoint
    const response = await fetch(`${CODEX_API_ENDPOINT}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Codex API error (${response.status}): ${errorText}`);
    }

    const cid = await response.text();
    console.log(`[Logos-Codex] ✓ Asset persisted on DDE. CID: ${cid}`);
    
    return cid;

  } catch (error) {
    console.warn('[Logos-Codex] Upload failed (likely no local node running). Falling back to mock-codex server...');
    
    let base64Data = typeof data === 'string' ? data : '';
    
    if (data instanceof File) {
      base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
    }

    if (base64Data && base64Data.startsWith('data:')) {
        try {
          const mockRes = await fetch('/api/mock-codex', {
             method: 'POST',
             body: base64Data
          });
          const json = await mockRes.json();
          if (json.cid) return json.cid;
        } catch (e) {
          console.error('[Logos-Codex] Mock server fallback also failed', e);
        }
    }

    return `mock-bafy-default-fallback-cid`; 
  }
}

/**
 * Returns the gateway URL for a Codex CID.
 */
export function getCodexUrl(cid: string): string {
  if (!cid) return '';
  
  if (cid.startsWith('data:')) {
      return cid;
  }

  // If it's our mock in-memory CID from the demo
  if (cid.startsWith('mock-bafy')) {
      return `/api/mock-codex?cid=${cid}`;
  }

  // Retrieve via standard Codex REST API
  return `${CODEX_GATEWAY_URL}/data/${cid}`;
}

/**
 * Checks if a string is a Codex CID.
 */
export function isCodexCid(str: string): boolean {
  if (str.startsWith('data:')) return true; // Account for our fallback
  if (str.startsWith('mock-bafy')) return true; // Mock API Fallback
  return str.startsWith('bafy') || str.length >= 46;
}
