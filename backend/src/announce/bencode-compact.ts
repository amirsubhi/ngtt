import type { PeerData } from './peers';
import { isIPv4, isIPv6 } from 'net';

function isValidIPv4(ip: string): boolean {
  if (!isIPv4(ip)) return false;
  return ip.split('.').every(s => { const n = Number(s); return Number.isInteger(n) && n >= 0 && n <= 255; });
}

// BEP 3 compact: 4 bytes IPv4 + 2 bytes port = 6 bytes per peer
export function compactPeers(peers: PeerData[]): Buffer {
  const ipv4 = peers.filter(p => isValidIPv4(p.ip));
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

// BEP 7 compact: 16 bytes IPv6 + 2 bytes port = 18 bytes per peer
export function compactPeers6(peers: PeerData[]): Buffer {
  const ipv6 = peers.filter(p => isIPv6(p.ip));
  const buf = Buffer.allocUnsafe(ipv6.length * 18);
  let offset = 0;
  for (const peer of ipv6) {
    const addrBuf = addrToBuffer(peer.ip);
    if (!addrBuf) continue;
    addrBuf.copy(buf, offset);
    offset += 16;
    buf.writeUInt16BE(peer.port, offset);
    offset += 2;
  }
  // Trim in case any peers failed to parse
  return buf.subarray(0, offset);
}

function addrToBuffer(ip: string): Buffer | null {
  try {
    // Expand :: notation via the dns/net API approach: node's net.isIPv6 validates
    // but doesn't expand. Use a manual expansion for the 16-byte write.
    const expanded = expandIPv6(ip);
    if (!expanded) return null;
    const groups = expanded.split(':');
    const buf = Buffer.allocUnsafe(16);
    for (let i = 0; i < 8; i++) {
      buf.writeUInt16BE(parseInt(groups[i], 16), i * 2);
    }
    return buf;
  } catch {
    return null;
  }
}

function expandIPv6(ip: string): string | null {
  if (ip.includes('::')) {
    const [left, right] = ip.split('::');
    const leftGroups  = left  ? left.split(':')  : [];
    const rightGroups = right ? right.split(':') : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    if (missing < 0) return null;
    const middle = Array(missing).fill('0000');
    return [...leftGroups, ...middle, ...rightGroups].join(':');
  }
  const groups = ip.split(':');
  if (groups.length !== 8) return null;
  return groups.join(':');
}
