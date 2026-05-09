import { logger } from '../lib/logger';

interface ParseMediaInfoPayload {
  torrent_id: number;
  file_path: string;
}

// Stub — implemented in Batch 9 (mediainfo.js WebAssembly)
export async function parseMediaInfo(data: ParseMediaInfoPayload): Promise<void> {
  logger.info(data, 'parse-mediainfo: stub, not yet implemented');
}
