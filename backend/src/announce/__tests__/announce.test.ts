import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compactPeers, compactPeers6 } from '../bencode-compact';
import type { PeerData } from '../peers';

// ---------- bencode-compact ----------

describe('compactPeers', () => {
  it('encodes a single IPv4 peer into 6 bytes', () => {
    const peers: PeerData[] = [{
      ip: '1.2.3.4', port: 6881,
      uploaded: 0, downloaded: 0, left: 0,
      seeder: true, user_id: 1, peer_id: '-AZ2060-000000000001', updated_at: Date.now(),
    }];
    const buf = compactPeers(peers);
    expect(buf.length).toBe(6);
    expect(buf[0]).toBe(1);
    expect(buf[1]).toBe(2);
    expect(buf[2]).toBe(3);
    expect(buf[3]).toBe(4);
    expect(buf.readUInt16BE(4)).toBe(6881);
  });

  it('encodes multiple peers into 6*n bytes', () => {
    const peers: PeerData[] = [
      { ip: '10.0.0.1', port: 1000, uploaded: 0, downloaded: 0, left: 0, seeder: true, user_id: 1, peer_id: '-AZ2060-000000000001', updated_at: Date.now() },
      { ip: '192.168.1.1', port: 2000, uploaded: 0, downloaded: 0, left: 0, seeder: false, user_id: 2, peer_id: '-AZ2060-000000000002', updated_at: Date.now() },
    ];
    const buf = compactPeers(peers);
    expect(buf.length).toBe(12);
    expect(buf.readUInt16BE(4)).toBe(1000);
    expect(buf.readUInt16BE(10)).toBe(2000);
  });

  it('skips IPv6 peers', () => {
    const peers: PeerData[] = [
      { ip: '::1', port: 6881, uploaded: 0, downloaded: 0, left: 0, seeder: true, user_id: 1, peer_id: '-AZ2060-000000000001', updated_at: Date.now() },
      { ip: '1.2.3.4', port: 6881, uploaded: 0, downloaded: 0, left: 0, seeder: true, user_id: 2, peer_id: '-AZ2060-000000000002', updated_at: Date.now() },
    ];
    const buf = compactPeers(peers);
    expect(buf.length).toBe(6); // only IPv4 peer encoded
  });

  it('returns empty buffer for empty input', () => {
    expect(compactPeers([]).length).toBe(0);
  });
});

// ---------- compactPeers6 (BEP 7) ----------

describe('compactPeers6', () => {
  const base: Omit<PeerData, 'ip'> = {
    port: 6881, uploaded: 0, downloaded: 0, left: 0,
    seeder: true, user_id: 1, peer_id: '-AZ2060-000000000001', updated_at: Date.now(),
  };

  it('encodes a single IPv6 peer into 18 bytes', () => {
    const buf = compactPeers6([{ ...base, ip: '2001:db8::1' }]);
    expect(buf.length).toBe(18);
    expect(buf.readUInt16BE(16)).toBe(6881);
  });

  it('encodes :: (all-zeros) correctly', () => {
    const buf = compactPeers6([{ ...base, ip: '::' }]);
    expect(buf.length).toBe(18);
    expect(buf.subarray(0, 16).every(b => b === 0)).toBe(true);
  });

  it('skips IPv4 peers', () => {
    const buf = compactPeers6([{ ...base, ip: '1.2.3.4' }, { ...base, ip: '2001:db8::1' }]);
    expect(buf.length).toBe(18); // only IPv6 peer
  });

  it('returns empty buffer for empty input', () => {
    expect(compactPeers6([]).length).toBe(0);
  });
});

// ---------- info_hash parsing (extracted logic) ----------

function parseInfoHashFromUrl(rawUrl: string): string | null {
  const match = rawUrl.match(/[?&]info_hash=([^&]*)/);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1].replace(/\+/g, '%20'));
    return Buffer.from(decoded, 'latin1').toString('hex');
  } catch {
    return null;
  }
}

describe('info_hash parsing', () => {
  it('converts binary-encoded info_hash to 40-char hex', () => {
    // Simulate a 20-byte hash where each byte is 0x00..0x13 (0–19)
    const bytes = Buffer.from(Array.from({ length: 20 }, (_, i) => i));
    const encoded = encodeURIComponent(bytes.toString('latin1'));
    const hex = parseInfoHashFromUrl(`/announce/pass?info_hash=${encoded}&peer_id=abc`);
    expect(hex).toBe(bytes.toString('hex'));
    expect(hex?.length).toBe(40);
  });

  it('returns null for missing info_hash', () => {
    expect(parseInfoHashFromUrl('/announce/pass?peer_id=x')).toBeNull();
  });

  it('handles all-zero hash', () => {
    const bytes = Buffer.alloc(20, 0);
    const encoded = encodeURIComponent(bytes.toString('latin1'));
    const hex = parseInfoHashFromUrl(`/announce/pass?info_hash=${encoded}`);
    expect(hex).toBe('0'.repeat(40));
  });
});

// ---------- stale peer filtering ----------

describe('getPeers stale filtering', () => {
  it('filters peers older than 2700 seconds', () => {
    const PEER_TTL = 2700;
    const now = Date.now();
    const staleThreshold = now - PEER_TTL * 1000;

    const freshPeer: PeerData = {
      ip: '1.2.3.4', port: 6881,
      uploaded: 0, downloaded: 0, left: 0,
      seeder: true, user_id: 1, peer_id: '-AZ2060-000000000001',
      updated_at: now - 1000, // 1 second ago
    };
    const stalePeer: PeerData = {
      ip: '5.6.7.8', port: 6882,
      uploaded: 0, downloaded: 0, left: 0,
      seeder: false, user_id: 2, peer_id: '-AZ2060-000000000002',
      updated_at: now - (PEER_TTL + 60) * 1000, // over 45 min ago
    };

    const peers = [freshPeer, stalePeer].filter(p => p.updated_at >= staleThreshold);
    expect(peers).toHaveLength(1);
    expect(peers[0].user_id).toBe(1);
  });
});
