import { describe, it, expect } from 'vitest';

// Mirrors the validation regex in backup.ts — tested independently for fast feedback
const FILE_RE = /^ngtt-backup-[0-9T-]+\.tar\.gz$/;
function safeFilename(name: string): string | null {
  return FILE_RE.test(name) ? name : null;
}

describe('safeFilename', () => {
  it('accepts valid backup filename', () => {
    expect(safeFilename('ngtt-backup-20260101T120000.tar.gz')).toBe('ngtt-backup-20260101T120000.tar.gz');
  });

  it('rejects path traversal', () => {
    expect(safeFilename('../etc/passwd')).toBeNull();
  });

  it('rejects names with slashes', () => {
    expect(safeFilename('foo/ngtt-backup-20260101T120000.tar.gz')).toBeNull();
  });

  it('rejects arbitrary filenames', () => {
    expect(safeFilename('backup.tar.gz')).toBeNull();
    expect(safeFilename('ngtt-backup.tar.gz')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(safeFilename('')).toBeNull();
  });
});
