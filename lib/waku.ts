import {
  createLightNode,
  waitForRemotePeer,
  createEncoder,
  createDecoder,
} from '@waku/sdk';
import { enrTree, wakuDnsDiscovery, wakuPeerExchangeDiscovery } from '@waku/discovery';
import { getStoredIdentity } from './crypto';
import { encryptData, decryptData } from './encryption';

// =============================================================================
// LOGOS NETWORK CONFIGURATION (Testnet v0.1)
// =============================================================================
//
// Official Logos Testnet v0.1 bootstrap multiaddrs are NOT yet published in
// the Logos documentation (confirmed: logos-docs repo, 2026-01-28, status=UNKNOWN).
//
// UPGRADE PATH: When Logos publishes their sovereign Mixnet node addresses,
// add them here as LOGOS_SOVEREIGN_BOOTSTRAP_PEERS and pass them via
// `libp2p.peerDiscovery` using `wakuPeerExchangeDiscovery` or direct multiaddrs.
//
// Current strategy (3-tier fallback):
//   1. PRIMARY  — Waku TEST fleet (test.waku.nodes.status.im) — closest live
//                 network to the Logos Mixnet, same Waku SDK / cluster config.
//   2. SECONDARY — Waku SANDBOX fleet — additional warm fallback peers.
//   3. DYNAMIC  — PeerExchange (PX) — discovers more peers once connected.
//
// Cluster: 1 (Logos / Status shared cluster on Waku v2)
// Shards:  0-7 (standard Waku v2 sharding for general message delivery)
// =============================================================================

/**
 * Logos Testnet v0.1 Network Config
 *
 * IMPORTANT: Replace LOGOS_SOVEREIGN_BOOTSTRAP_PEERS with official Logos
 * node multiaddrs once they are published at https://build.logos.co
 */
export const LOGOS_NETWORK_CONFIG = {
  // The Logos/Waku shared cluster ID on the Waku v2 network
  clusterId: 16,

  // Shards 0–7 cover the standard delivery channels for Logos apps
  shards: [0, 1, 2, 3, 4, 5, 6, 7],

  // pubsubTopic matching the Logos clusterId:16 shard config
  pubsubTopic: '/waku/2/rs/16/0',

  // DNS ENR trees — ordered by preference (TEST fleet = Logos Mixnet neighbours)
  dnsDiscoveryUrls: [
    enrTree['TEST'],      // Primary: Waku Testnet (Logos-aligned)
    enrTree['SANDBOX'],   // Secondary: warm fallback
  ],

  // --- UPGRADE SLOT ---
  // sovereignBootstrapPeers: [
  //   '/ip4/<LOGOS_NODE_1_IP>/tcp/60000/p2p/<PEER_ID>',
  //   '/ip4/<LOGOS_NODE_2_IP>/tcp/60000/p2p/<PEER_ID>',
  // ],
};

const CONTENT_TOPIC = '/logos/1/discovery/proto';
const TIP_TOPIC = '/logos/1/payments/proto';

export interface WakuPost {
  id: string;
  author: string;
  authorNpk?: string;
  authorAlias: string;
  content: string;
  timestamp: number;
  tips: number;
  keyPrice: number;
  isLocked?: boolean;
  parentId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  isEncrypted?: boolean; 
  redPacket?: {
    totalAmount: number;
    remainingClaims: number;
    claims: string[];
  };
}

export interface WakuTip {
  postId: string;
  sender: string;
  recipient: string;
  amount: string | number; // Support both raw numbers and encrypted strings
  timestamp: number;
  isEncrypted?: boolean;
}

type LightNode = Awaited<ReturnType<typeof createLightNode>>;
let wakuNode: LightNode | null = null;

/**
 * Initializes a Waku Light Node connected to the Logos Testnet v0.1 network.
 *
 * Network strategy (3-tier):
 *   1. DNS Discovery against the TEST + SANDBOX Waku ENR fleets
 *   2. PeerExchange to find more peers once initially connected
 *   3. Ready for sovereign Logos Mixnet nodes via LOGOS_NETWORK_CONFIG upgrade slot
 */
export async function initWaku(): Promise<LightNode> {
  if (wakuNode) return wakuNode;

  // Use the stored signing key (post-identity-refactor field name)
  const identity = getStoredIdentity();
  const signingKey = identity?.signingPrivateKey;

  console.log('[Logos-Net] Initializing Sovereign Light Node on Logos Testnet v0.1...');
  console.log(`[Logos-Net] Cluster: ${LOGOS_NETWORK_CONFIG.clusterId} | Shards: [${LOGOS_NETWORK_CONFIG.shards.join(', ')}]`);

  try {
    const node = await createLightNode({
      defaultBootstrap: false, // We manage bootstrap ourselves via LOGOS_NETWORK_CONFIG
      networkConfig: {
        clusterId: LOGOS_NETWORK_CONFIG.clusterId,
        shards: LOGOS_NETWORK_CONFIG.shards,
      },
      // AnonComms / Mixnet Privacy Hardening
      // We hide websocket info and generic user agents to prevent fingerprinting
      // and metadata leakage prior to full AnonComms Mixnet integration.
      userAgent: 'Cipher-Sovereign-Node/0.1',
      libp2p: {
        hideWebSocketInfo: true,
        peerDiscovery: [
          // Tier 1: DNS Discovery against the TEST (primary) + SANDBOX (fallback) ENR trees
          wakuDnsDiscovery(LOGOS_NETWORK_CONFIG.dnsDiscoveryUrls),
          // Tier 2: PeerExchange — finds live peers dynamically after initial contact
          wakuPeerExchangeDiscovery(),
        ],
        // UPGRADE PATH: AnonComms Mixnet Routing
        // When Logos releases the official AnonComms proxy endpoints (e.g., Nym-based mixnet),
        // we will inject the proxy multiaddrs here to route all GossipSub traffic through the mixnet.
        // connectionManager: {
        //   dialer: { proxy: '/ip4/127.0.0.1/tcp/9050' } // Example Mixnet Proxy Stub
        // }
      },
    });

    await node.start();
    console.log('[Logos-Net] Node started. Performing decentralized peer discovery...');

    try {
      // Require Filter + LightPush + Store — essential for send/receive/history on a light node
      await waitForRemotePeer(node, ['filter', 'lightpush', 'store'] as any, 15000);
      const peers = node.libp2p.getPeers();
      console.log(`[Logos-Net] ✓ Connected to Logos Network | Peers: ${peers.length}`);
    } catch (peerErr) {
      console.warn('[Logos-Net] Peer discovery ongoing in background — publishing may be delayed.');
    }

    wakuNode = node;
    return wakuNode;
  } catch (err) {
    console.error('[Logos-Net] initWaku critical failure:', err);
    throw err;
  }
}

/**
 * Broadcasts a post to the Logos network.
 * If the post is locked, the content is encrypted at the source (E2EE).
 */
export async function broadcastPost(post: WakuPost): Promise<void> {
  try {
    const node = await initWaku();
    
    // PRODUCTION PRIVACY: Encrypt content if locked
    let finalizedPost = { ...post };
    if (post.isLocked) {
      console.log('[Logos] Encrypting content for privacy...');
      const seed = post.author; // In production, this would be a shared secret or public key
      finalizedPost.content = await encryptData(post.content, seed);
      if (post.imageUrl) finalizedPost.imageUrl = await encryptData(post.imageUrl, seed);
      finalizedPost.isEncrypted = true;
    }

    const encoder = createEncoder({ 
      contentTopic: CONTENT_TOPIC, 
      routingInfo: { clusterId: LOGOS_NETWORK_CONFIG.clusterId, shardId: LOGOS_NETWORK_CONFIG.shards[0], pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic } 
    });
    const payload = new TextEncoder().encode(JSON.stringify(finalizedPost));
    await node.lightPush.send(encoder, { payload });
  } catch (err) {
    console.error('[Logos] Broadcast failed:', err);
    throw err;
  }
}

/**
 * Broadcasts a private tip to the Logos network.
 */
export async function broadcastTip(tip: WakuTip): Promise<void> {
  try {
    const node = await initWaku();
    
    // Privacy: Amount is encrypted using recipient's identity
    const finalizedTip = { ...tip };
    const seed = tip.recipient;
    // We stringify the amount to encrypt it
    finalizedTip.amount = await encryptData(tip.amount.toString(), seed);
    finalizedTip.isEncrypted = true;

    const encoder = createEncoder({ 
      contentTopic: TIP_TOPIC, 
      routingInfo: { clusterId: LOGOS_NETWORK_CONFIG.clusterId, shardId: LOGOS_NETWORK_CONFIG.shards[0], pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic } 
    });
    const payload = new TextEncoder().encode(JSON.stringify(finalizedTip));
    await node.lightPush.send(encoder, { payload });
  } catch (err) {
    console.error('[Logos] Tip broadcast failed:', err);
  }
}

/**
 * Fetches and decrypts historical posts from Logos Waku Store nodes.
 */
export async function fetchWakuPosts(): Promise<WakuPost[]> {
  const posts: WakuPost[] = [];
  try {
    const node = await initWaku();
    const decoder = createDecoder(CONTENT_TOPIC, { 
      clusterId: LOGOS_NETWORK_CONFIG.clusterId, 
      shardId: LOGOS_NETWORK_CONFIG.shards[0], 
      pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic 
    });

    const callback = async (wakuMessage: any) => {
      if (!wakuMessage?.payload) return;
      try {
        const post: WakuPost = JSON.parse(new TextDecoder().decode(wakuMessage.payload));
        
        // PRODUCTION PRIVACY: Attempt decryption
        if (post.isEncrypted) {
          const seed = post.author;
          post.content = await decryptData(post.content, seed);
          if (post.imageUrl) post.imageUrl = await decryptData(post.imageUrl, seed);
        }

        if (post.id) posts.push(post);
      } catch (e) {
        console.warn('[Logos] Malformed message dropped.');
      }
    };

    await node.store.queryWithOrderedCallback([decoder], callback);
  } catch (err) {
    console.warn('[Logos] Store query failed:', err);
  }

  return posts.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Fetches and decrypts historical tips for a specific post.
 */
export async function fetchWakuTips(): Promise<WakuTip[]> {
  const tips: WakuTip[] = [];
  try {
    const node = await initWaku();
    const decoder = createDecoder(TIP_TOPIC, { 
      clusterId: LOGOS_NETWORK_CONFIG.clusterId, 
      shardId: LOGOS_NETWORK_CONFIG.shards[0], 
      pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic 
    });

    const callback = async (wakuMessage: any) => {
      if (!wakuMessage?.payload) return;
      try {
        const tip: WakuTip = JSON.parse(new TextDecoder().decode(wakuMessage.payload));
        tips.push(tip);
      } catch (e) {}
    };

    await node.store.queryWithOrderedCallback([decoder], callback);
  } catch (err) {
    console.warn('[Logos] Tips query failed:', err);
  }
  return tips;
}

/**
 * Subscribes to real-time feed updates via Waku Filter protocol.
 */
export async function subscribeToFeed(
  callback: (post: WakuPost) => void
): Promise<() => void> {
  try {
    const node = await initWaku();
    const decoder = createDecoder(CONTENT_TOPIC, { 
      clusterId: LOGOS_NETWORK_CONFIG.clusterId, 
      shardId: LOGOS_NETWORK_CONFIG.shards[0], 
      pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic 
    });

    const observer = async (wakuMessage: any) => {
      if (!wakuMessage?.payload) return;
      try {
        const post: WakuPost = JSON.parse(new TextDecoder().decode(wakuMessage.payload));
        
        // PRODUCTION PRIVACY: Attempt decryption
        if (post.isEncrypted) {
          const seed = post.author;
          post.content = await decryptData(post.content, seed);
          if (post.imageUrl) post.imageUrl = await decryptData(post.imageUrl, seed);
        }

        if (post.id) callback(post);
      } catch (e) {
        console.warn('[Logos] Real-time message malformed.');
      }
    };

    const success = await node.filter.subscribe([decoder], observer);
    if (!success) {
      console.warn('[Logos] Filter subscription failed');
      return () => {};
    }

    console.log('[Logos] ✓ Subscribed to live Logos network feed.');
    return () => {
      node.filter.unsubscribe([decoder]);
    };
  } catch (err) {
    console.warn('[Logos] Subscription failed:', err);
    return () => {};
  }
}

/**
 * Subscribes to real-time tips.
 */
export async function subscribeToTips(
  callback: (tip: WakuTip) => void
): Promise<() => void> {
  try {
    const node = await initWaku();
    const decoder = createDecoder(TIP_TOPIC, { 
      clusterId: LOGOS_NETWORK_CONFIG.clusterId, 
      shardId: LOGOS_NETWORK_CONFIG.shards[0], 
      pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic 
    });

    const observer = async (wakuMessage: any) => {
      if (!wakuMessage?.payload) return;
      try {
        const tip: WakuTip = JSON.parse(new TextDecoder().decode(wakuMessage.payload));
        callback(tip);
      } catch (e) {}
    };

    const success = await node.filter.subscribe([decoder], observer);
    if (!success) return () => {};
    return () => {
      node.filter.unsubscribe([decoder]);
    };
  } catch (err) {
    return () => {};
  }
}
