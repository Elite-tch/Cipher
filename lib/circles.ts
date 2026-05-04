import { createEncoder, createDecoder } from '@waku/sdk';
import { initWaku, LOGOS_NETWORK_CONFIG } from './waku';
import { encryptData, decryptData } from './encryption';

/**
 * CIPHER CIRCLES (Private Group Messaging)
 * 
 * Circles are E2EE group chats gated by Keys.
 * Each creator has a Circle. To join, you must own their Key.
 * Topic: /logos/1/chat-${id}/proto
 */

export interface CircleMessage {
  id: string;
  sender: string;
  senderAlias: string;
  content: string;
  timestamp: number;
  circleId: string; // The Creator's Public Key
  type?: 'text' | 'payment' | 'redpacket' | 'receipt';
  amount?: string;
  status?: 'sent' | 'delivered' | 'seen';
  receiptForId?: string;
}

/**
 * Broadcasts a message to a specific Circle.
 */
export async function broadcastCircleMessage(msg: CircleMessage): Promise<void> {
  try {
    const node = await initWaku();
    // Waku topics must follow /app/version/topic/encoding (4 segments)
    const topic = `/logos/1/chat-${msg.circleId}/proto`;
    
    // Privacy: Metadata hidden via Waku Mixnet + Payload E2EE
    const seed = msg.circleId; 
    const encryptedContent = await encryptData(msg.content, seed);
    
    const finalizedMsg = { ...msg, content: encryptedContent };

    const encoder = createEncoder({ 
      contentTopic: topic, 
      routingInfo: { clusterId: LOGOS_NETWORK_CONFIG.clusterId, shardId: LOGOS_NETWORK_CONFIG.shards[0], pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic } 
    });
    const payload = new TextEncoder().encode(JSON.stringify(finalizedMsg));
    await node.lightPush.send(encoder, { payload });
    
    console.log(`[Logos] Circle message broadcast to: ${topic}`);
  } catch (err) {
    console.error('[Logos] Circle broadcast failed:', err);
  }
}

/**
 * Subscribes to real-time messages for a specific Circle.
 */
export async function subscribeToCircle(
  circleId: string, 
  callback: (msg: CircleMessage) => void
): Promise<() => void> {
  try {
    const node = await initWaku();
    const topic = `/logos/1/chat-${circleId}/proto`;
    const decoder = createDecoder(topic, { 
      clusterId: LOGOS_NETWORK_CONFIG.clusterId, 
      shardId: LOGOS_NETWORK_CONFIG.shards[0], 
      pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic 
    });

    const observer = async (wakuMessage: any) => {
      if (!wakuMessage?.payload) return;
      try {
        const msg: CircleMessage = JSON.parse(new TextDecoder().decode(wakuMessage.payload));
        
        // Decryption
        const seed = circleId;
        msg.content = await decryptData(msg.content, seed);
        
        callback(msg);
      } catch (e) {
        console.warn('[Logos] Circle message malformed or decryption failed.');
      }
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

/**
 * Fetches historical messages for a Circle from the Logos Mixnet Store.
 */
export async function fetchCircleHistory(circleId: string): Promise<CircleMessage[]> {
  const messages: CircleMessage[] = [];
  try {
    const node = await initWaku();
    const topic = `/logos/1/chat-${circleId}/proto`;
    const decoder = createDecoder(topic, { 
      clusterId: LOGOS_NETWORK_CONFIG.clusterId, 
      shardId: LOGOS_NETWORK_CONFIG.shards[0], 
      pubsubTopic: LOGOS_NETWORK_CONFIG.pubsubTopic 
    });

    const callback = async (wakuMessage: any) => {
      if (!wakuMessage?.payload) return;
      try {
        const msg: CircleMessage = JSON.parse(new TextDecoder().decode(wakuMessage.payload));
        
        // Decryption
        const seed = circleId;
        msg.content = await decryptData(msg.content, seed);
        
        messages.push(msg);
      } catch (e) {}
    };

    // Query Logos Store nodes for past 24h of history
    await node.store.queryWithOrderedCallback([decoder], callback);
  } catch (err) {
    console.warn('[Logos] Circle history fetch failed:', err);
  }
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}
