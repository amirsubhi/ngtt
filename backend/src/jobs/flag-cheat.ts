import { execute } from '../lib/db';

interface FlagCheatPayload {
  user_id: number;
  torrent_id: number;
  type: string;
  peer_id: string;
  ip: string;
  [key: string]: unknown;
}

export async function flagCheat(data: FlagCheatPayload): Promise<void> {
  const { user_id, torrent_id, type, peer_id, ip, ...rest } = data;
  const evidence = JSON.stringify({ peer_id, ip, ...rest });

  await execute(
    `INSERT INTO cheat_signals (user_id, torrent_id, signal_type, evidence, peer_id, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user_id, torrent_id, type, evidence, peer_id, ip],
  );
}
