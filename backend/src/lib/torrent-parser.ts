import crypto from 'crypto';
import { decode, encodeToBytes } from 'bencodec';

export interface ParsedTorrent {
  infoHash: string;
  name: string;
  size: number;
  files: { path: string; size: number }[];
  isMultiFile: boolean;
}

function bufferToString(val: unknown): string {
  if (Buffer.isBuffer(val)) return val.toString('utf8');
  if (typeof val === 'string') return val;
  return '';
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'bigint') return Number(val);
  return 0;
}

export function parseTorrentBuffer(buf: Buffer): ParsedTorrent {
  let decoded: Record<string, unknown>;
  try {
    decoded = decode(buf) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid torrent file');
  }

  const info = decoded['info'] as Record<string, unknown> | undefined;
  if (!info || typeof info !== 'object') {
    throw new Error('Torrent missing info dictionary');
  }

  const infoBytes = encodeToBytes(info);
  const infoHash = crypto.createHash('sha1').update(infoBytes).digest('hex');
  const name = bufferToString(info['name']);

  const fileList = info['files'] as Array<Record<string, unknown>> | undefined;
  let files: { path: string; size: number }[];
  let totalSize: number;

  if (fileList && Array.isArray(fileList)) {
    files = fileList.map(f => {
      const pathParts = (f['path'] as unknown[]) ?? [];
      const filePath = pathParts.map(bufferToString).join('/');
      return { path: `${name}/${filePath}`, size: toNumber(f['length']) };
    });
    totalSize = files.reduce((sum, f) => sum + f.size, 0);
  } else {
    totalSize = toNumber(info['length']);
    files = [{ path: name, size: totalSize }];
  }

  return {
    infoHash,
    name,
    size: totalSize,
    files,
    isMultiFile: !!fileList,
  };
}
