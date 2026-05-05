import fs from 'fs/promises';
import path from 'path';
import { config } from './config';

export async function saveFile(subpath: string, data: Buffer): Promise<void> {
  const dest = path.join(config.uploadPath, subpath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, data);
}

export async function deleteFile(subpath: string): Promise<void> {
  const dest = path.join(config.uploadPath, subpath);
  await fs.rm(dest, { force: true });
}

export function getFileUrl(subpath: string): string {
  return `${config.uploadUrl}/${subpath}`;
}
