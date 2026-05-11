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
  peer_id: string;
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

interface SwarmData {
  peers: PeerData[];
  seeders: number;
  leechers: number;
}

// Single HGETALL pass — avoids 3× round-trips and 3× full JSON scans per announce
// Exported convenience wrappers for routes that only need one value
export async function getPeers(infoHash: string, limit: number): Promise<PeerData[]> {
  return (await getSwarmData(infoHash, limit)).peers;
}
export async function getSeederCount(infoHash: string): Promise<number> {
  return (await getSwarmData(infoHash, 0)).seeders;
}
export async function getLeecherCount(infoHash: string): Promise<number> {
  return (await getSwarmData(infoHash, 0)).leechers;
}

export async function getSwarmData(infoHash: string, limit: number): Promise<SwarmData> {
  const raw = await redis.hgetall(peerKey(infoHash));
  if (!raw) return { peers: [], seeders: 0, leechers: 0 };

  const staleThreshold = Date.now() - PEER_TTL * 1000;
  const peers: PeerData[] = [];
  let seeders = 0;
  let leechers = 0;

  for (const v of Object.values(raw)) {
    const p = JSON.parse(v) as PeerData;
    if (p.updated_at < staleThreshold) continue;
    if (p.seeder) seeders++; else leechers++;
    if (peers.length < limit) peers.push(p);
  }

  return { peers, seeders, leechers };
}
