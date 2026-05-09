import { redis } from '../lib/redis';

const PEER_TTL = 2700; // 45 min

export interface PeerData {
  ip: string;
  port: number;
  uploaded: number;
  downloaded: number;
  left: number;
  seeder: boolean;
  user_id: number;
  updated_at: number;
}

function peerKey(infoHash: string): string {
  return `peers:${infoHash}`;
}

export async function updatePeer(infoHash: string, peerId: string, data: PeerData): Promise<void> {
  const key = peerKey(infoHash);
  await redis.hset(key, peerId, JSON.stringify(data));
  await redis.expire(key, PEER_TTL);
}

export async function removePeer(infoHash: string, peerId: string): Promise<void> {
  await redis.hdel(peerKey(infoHash), peerId);
}

export async function getPeers(infoHash: string, limit: number): Promise<PeerData[]> {
  const raw = await redis.hgetall(peerKey(infoHash));
  if (!raw) return [];
  const now = Date.now();
  const staleThreshold = now - PEER_TTL * 1000;
  const peers: PeerData[] = [];
  for (const v of Object.values(raw)) {
    const p = JSON.parse(v) as PeerData;
    if (p.updated_at >= staleThreshold) peers.push(p);
    if (peers.length >= limit) break;
  }
  return peers;
}

export async function getSeederCount(infoHash: string): Promise<number> {
  const raw = await redis.hgetall(peerKey(infoHash));
  if (!raw) return 0;
  return Object.values(raw).filter(v => (JSON.parse(v) as PeerData).seeder).length;
}

export async function getLeecherCount(infoHash: string): Promise<number> {
  const raw = await redis.hgetall(peerKey(infoHash));
  if (!raw) return 0;
  return Object.values(raw).filter(v => !(JSON.parse(v) as PeerData).seeder).length;
}
