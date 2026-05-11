import type { PeerData } from './peers';

// 6 bytes per peer: 4 bytes IPv4 + 2 bytes port (big-endian)
export function compactPeers(peers: PeerData[]): Buffer {
  const ipv4 = peers.filter(p => {
    const parts = p.ip.split('.');
    return parts.length === 4 && parts.every(s => { const n = Number(s); return Number.isInteger(n) && n >= 0 && n <= 255; });
  });
  const buf = Buffer.allocUnsafe(ipv4.length * 6);
  let offset = 0;
  for (const peer of ipv4) {
    const parts = peer.ip.split('.').map(Number);
    buf[offset++] = parts[0];
    buf[offset++] = parts[1];
    buf[offset++] = parts[2];
    buf[offset++] = parts[3];
    buf.writeUInt16BE(peer.port, offset);
    offset += 2;
  }
  return buf;
}
