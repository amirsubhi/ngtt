import { logger } from '../lib/logger';

interface ShoutboxArchivePayload {
  message_id: number;
}

// Stub — implemented in Batch 10 (shoutbox feature)
export async function archiveShoutboxMsg(data: ShoutboxArchivePayload): Promise<void> {
  logger.info(data, 'shoutbox-archive: stub, not yet implemented');
}
