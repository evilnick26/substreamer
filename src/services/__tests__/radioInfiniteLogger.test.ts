import { TextEncoder } from 'node:util';

const mockFiles = new Map<string, Buffer>();
let mockWriteFails = false;
let mockMoveFails = false;
let mockFlagReadFails = false;

jest.mock('expo-file-system', () => ({
  Paths: {
    document: '/mock/document',
    cache: '/mock/cache',
  },
  File: class {
    private name: string;

    constructor(_directory: string, name: string) {
      this.name = name;
    }

    get exists() {
      if (
        mockFlagReadFails &&
        this.name === 'radio-infinite-diagnostics-enabled'
      ) {
        throw new Error('Flag read failed');
      }
      return mockFiles.has(this.name);
    }

    get size() {
      return mockFiles.get(this.name)?.length ?? 0;
    }

    get uri() {
      return `file:///mock/${this.name}`;
    }

    bytesSync() {
      const content = mockFiles.get(this.name);
      if (!content) throw new Error('File missing');
      return new Uint8Array(content);
    }

    create() {
      mockFiles.set(this.name, Buffer.alloc(0));
    }

    write(content: Uint8Array, options?: { append?: boolean }) {
      if (mockWriteFails) throw new Error('Write failed');

      const bytes = Buffer.from(content);
      const previous = options?.append
        ? mockFiles.get(this.name) ?? Buffer.alloc(0)
        : Buffer.alloc(0);

      mockFiles.set(this.name, Buffer.concat([previous, bytes]));
    }

    delete() {
      mockFiles.delete(this.name);
    }

    moveSync(destination: { name: string }) {
      if (mockMoveFails) throw new Error('Move failed');

      const content = mockFiles.get(this.name);
      if (!content) throw new Error('Source missing');

      mockFiles.set(destination.name, content);
      mockFiles.delete(this.name);
      this.name = destination.name;
    }
  },
}));

import {
  RADIO_INFINITE_DIAG_FLAG_FILE as FLAG,
  RADIO_INFINITE_DIAG_LOG_FILE as LOG,
  RADIO_INFINITE_DIAG_OLD_LOG_FILE as OLD,
  isRadioInfiniteLoggingEnabled,
  logRadioInfinite,
  flushRadioInfiniteLog,
  clearRadioInfiniteLog,
  RADIO_INFINITE_DIAG_EXPORT_FILE as EXPORT,
  setRadioInfiniteLoggingEnabled,
  getRadioInfiniteLogStatus,
  exportRadioInfiniteLog,
} from '../radioInfiniteLogger';

const MAX_BYTES = 512 * 1024;

function enableLogging() {
  mockFiles.set(FLAG, Buffer.alloc(0));
}

function contents(name = LOG) {
  return mockFiles.get(name)?.toString('utf8') ?? '';
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'TextEncoder', {
    value: TextEncoder,
    configurable: true,
    writable: true,
  });
});

beforeEach(async () => {
  await flushRadioInfiniteLog();
  mockFiles.clear();
  mockWriteFails = false;
  mockMoveFails = false;
  mockFlagReadFails = false;
});

describe('Radio Infinite diagnostic logger', () => {
  it('is disabled by default', async () => {
    expect(isRadioInfiniteLoggingEnabled()).toBe(false);

    logRadioInfinite('not recorded');
    await flushRadioInfiniteLog();

    expect(mockFiles.has(LOG)).toBe(false);
  });

  it('honours the persistent enable flag', async () => {
    enableLogging();
    expect(isRadioInfiniteLoggingEnabled()).toBe(true);

    logRadioInfinite('primary established');
    await flushRadioInfiniteLog();

    expect(contents()).toMatch(
      /^\[\d{4}-.*Z\] primary established\n$/,
    );
  });

  it('appends entries in submission order', async () => {
    enableLogging();

    logRadioInfinite('first');
    logRadioInfinite('second');
    logRadioInfinite('third');

    await flushRadioInfiniteLog();

    expect(
      contents().trim().split('\n').map(
        (line) => line.slice(line.indexOf('] ') + 2),
      ),
    ).toEqual(['first', 'second', 'third']);
  });

  it('preserves existing entries', async () => {
    enableLogging();
    mockFiles.set(LOG, Buffer.from('previous session\n'));

    logRadioInfinite('new session');
    await flushRadioInfiniteLog();

    expect(contents()).toContain('previous session\n');
    expect(contents()).toContain('new session\n');
  });

  it('stops recording when disabled before a queued write', async () => {
    enableLogging();

    logRadioInfinite('pending');
    mockFiles.delete(FLAG);

    await flushRadioInfiniteLog();

    expect(mockFiles.has(LOG)).toBe(false);
  });

  it('rotates the active file and writes to a fresh path', async () => {
    enableLogging();

    const previous = Buffer.alloc(MAX_BYTES, 'a');
    mockFiles.set(LOG, previous);
    mockFiles.set(OLD, Buffer.from('older history'));

    logRadioInfinite('after rotation');
    await flushRadioInfiniteLog();

    expect(mockFiles.get(OLD)).toEqual(previous);
    expect(contents()).toContain('after rotation');
    expect(contents()).not.toContain('older history');
    expect(mockFiles.get(LOG)!.length).toBeLessThan(MAX_BYTES);
  });

  it('uses UTF-8 byte length rather than character count', async () => {
    enableLogging();

    const previous = Buffer.alloc(MAX_BYTES - 100, 'a');
    mockFiles.set(LOG, previous);

    const message = '\u65e5'.repeat(30);

    logRadioInfinite(message);
    await flushRadioInfiniteLog();

    expect(mockFiles.get(OLD)).toEqual(previous);
    expect(contents()).toContain(message);
    expect(mockFiles.get(LOG)!.length).toBeLessThan(MAX_BYTES);
  });

  it('drops a single entry larger than the retention limit', async () => {
    enableLogging();

    logRadioInfinite('a'.repeat(MAX_BYTES + 1));
    await flushRadioInfiniteLog();

    expect(mockFiles.has(LOG)).toBe(false);
    expect(mockFiles.has(OLD)).toBe(false);
  });

  it('clears both files after pending writes', async () => {
    enableLogging();
    mockFiles.set(OLD, Buffer.from('history'));

    logRadioInfinite('pending');
    await clearRadioInfiniteLog();

    expect(mockFiles.has(LOG)).toBe(false);
    expect(mockFiles.has(OLD)).toBe(false);
    expect(isRadioInfiniteLoggingEnabled()).toBe(true);
  });

  it('allows clearing when no logs exist', async () => {
    await expect(clearRadioInfiniteLog()).resolves.toBeUndefined();
  });

  it('records new events submitted after clearing', async () => {
    enableLogging();

    logRadioInfinite('before clear');
    const clearing = clearRadioInfiniteLog();
    logRadioInfinite('after clear');

    await clearing;
    await flushRadioInfiniteLog();

    expect(contents()).not.toContain('before clear');
    expect(contents()).toContain('after clear');
  });

  it('contains write failures and allows subsequent writes', async () => {
    enableLogging();
    mockWriteFails = true;

    logRadioInfinite('failed write');
    await expect(flushRadioInfiniteLog()).resolves.toBeUndefined();

    mockWriteFails = false;
    logRadioInfinite('recovered');
    await flushRadioInfiniteLog();

    expect(contents()).toContain('recovered');
    expect(contents()).not.toContain('failed write');
  });

  it('contains rotation failures without growing the active file', async () => {
    enableLogging();
    mockFiles.set(LOG, Buffer.alloc(MAX_BYTES, 'a'));
    mockMoveFails = true;

    logRadioInfinite('failed rotation');
    await expect(flushRadioInfiniteLog()).resolves.toBeUndefined();

    expect(mockFiles.get(LOG)!.length).toBe(MAX_BYTES);

    mockMoveFails = false;
    logRadioInfinite('recovered rotation');
    await flushRadioInfiniteLog();

    expect(contents()).toContain('recovered rotation');
    expect(mockFiles.get(OLD)!.length).toBe(MAX_BYTES);
  });

  it('treats flag read failures as disabled logging', async () => {
    enableLogging();
    mockFlagReadFails = true;

    expect(isRadioInfiniteLoggingEnabled()).toBe(false);

    expect(() => logRadioInfinite('ignored')).not.toThrow();
    await flushRadioInfiniteLog();

    expect(mockFiles.has(LOG)).toBe(false);
  });
});

describe('Radio Infinite diagnostic storage management', () => {
  it('creates a persistent enable flag', async () => {
    await setRadioInfiniteLoggingEnabled(true);

    expect(mockFiles.has(FLAG)).toBe(true);
    expect(isRadioInfiniteLoggingEnabled()).toBe(true);
  });

  it('allows repeated enable operations', async () => {
    await setRadioInfiniteLoggingEnabled(true);
    await setRadioInfiniteLoggingEnabled(true);

    expect(isRadioInfiniteLoggingEnabled()).toBe(true);
  });

  it('allows disabling when already disabled', async () => {
    await setRadioInfiniteLoggingEnabled(false);

    expect(isRadioInfiniteLoggingEnabled()).toBe(false);
  });

  it('retains pending entries when disabling logging', async () => {
    await setRadioInfiniteLoggingEnabled(true);

    logRadioInfinite('before disable');
    await setRadioInfiniteLoggingEnabled(false);

    logRadioInfinite('after disable');
    await flushRadioInfiniteLog();

    expect(mockFiles.has(FLAG)).toBe(false);
    expect(contents()).toContain('before disable');
    expect(contents()).not.toContain('after disable');
  });

  it('reports disabled logging with no retained files', async () => {
    await expect(getRadioInfiniteLogStatus()).resolves.toEqual({
      enabled: false,
      logFileSize: null,
    });
  });

  it('reports enabled logging with no retained files', async () => {
    await setRadioInfiniteLoggingEnabled(true);

    await expect(getRadioInfiniteLogStatus()).resolves.toEqual({
      enabled: true,
      logFileSize: null,
    });
  });

  it('reports the combined retained byte size', async () => {
    enableLogging();

    mockFiles.set(OLD, Buffer.from('history'));
    mockFiles.set(LOG, Buffer.from('current'));

    await expect(getRadioInfiniteLogStatus()).resolves.toEqual({
      enabled: true,
      logFileSize: 14,
    });
  });

  it('reports retained history when logging is disabled', async () => {
    mockFiles.set(OLD, Buffer.from('history'));

    await expect(getRadioInfiniteLogStatus()).resolves.toEqual({
      enabled: false,
      logFileSize: 7,
    });
  });

  it('includes pending writes in the reported size', async () => {
    enableLogging();

    logRadioInfinite('pending');

    const status = await getRadioInfiniteLogStatus();

    expect(status?.logFileSize).toBe(mockFiles.get(LOG)?.length);
    expect(status?.logFileSize).toBeGreaterThan(0);
  });

  it('returns no export when neither retained file exists', async () => {
    await expect(exportRadioInfiniteLog()).resolves.toBeNull();

    expect(mockFiles.has(EXPORT)).toBe(false);
  });

  it('exports the active log on its own', async () => {
    mockFiles.set(LOG, Buffer.from('current\n'));

    await expect(exportRadioInfiniteLog()).resolves.toBe(
      `file:///mock/${EXPORT}`,
    );

    expect(contents(EXPORT)).toBe('current\n');
  });

  it('exports historical entries on their own', async () => {
    mockFiles.set(OLD, Buffer.from('history\n'));

    await exportRadioInfiniteLog();

    expect(contents(EXPORT)).toBe('history\n');
  });

  it('exports both logs in chronological order', async () => {
    mockFiles.set(OLD, Buffer.from('history\n'));
    mockFiles.set(LOG, Buffer.from('current\n'));

    await exportRadioInfiniteLog();

    expect(contents(EXPORT)).toBe('history\ncurrent\n');
    expect(contents(OLD)).toBe('history\n');
    expect(contents(LOG)).toBe('current\n');
  });

  it('preserves Unicode content in the export', async () => {
    mockFiles.set(OLD, Buffer.from('Björk\n'));
    mockFiles.set(LOG, Buffer.from('日本語\n'));

    await exportRadioInfiniteLog();

    expect(contents(EXPORT)).toBe('Björk\n日本語\n');
  });

  it('includes writes submitted before export', async () => {
    enableLogging();

    logRadioInfinite('pending');
    await exportRadioInfiniteLog();

    expect(contents(EXPORT)).toContain('pending');
  });

  it('does not modify the exported snapshot on subsequent writes', async () => {
    enableLogging();

    logRadioInfinite('before export');
    await exportRadioInfiniteLog();

    const snapshot = contents(EXPORT);

    logRadioInfinite('after export');
    await flushRadioInfiniteLog();

    expect(contents(EXPORT)).toBe(snapshot);
    expect(contents(LOG)).toContain('after export');
  });

  it('replaces the previous export rather than appending to it', async () => {
    mockFiles.set(LOG, Buffer.from('current\n'));
    mockFiles.set(EXPORT, Buffer.from('obsolete export\n'));

    await exportRadioInfiniteLog();

    expect(contents(EXPORT)).toBe('current\n');
  });

  it('removes obsolete exports when no retained logs exist', async () => {
    mockFiles.set(EXPORT, Buffer.from('obsolete export\n'));

    await expect(exportRadioInfiniteLog()).resolves.toBeNull();

    expect(mockFiles.has(EXPORT)).toBe(false);
  });

  it('clears retained logs and the temporary export', async () => {
    enableLogging();

    mockFiles.set(LOG, Buffer.from('current'));
    mockFiles.set(OLD, Buffer.from('history'));
    mockFiles.set(EXPORT, Buffer.from('snapshot'));

    await clearRadioInfiniteLog();

    expect(mockFiles.has(LOG)).toBe(false);
    expect(mockFiles.has(OLD)).toBe(false);
    expect(mockFiles.has(EXPORT)).toBe(false);
    expect(mockFiles.has(FLAG)).toBe(true);
  });

  it('returns no status when reading the flag fails', async () => {
    mockFlagReadFails = true;

    await expect(getRadioInfiniteLogStatus()).resolves.toBeNull();
  });

  it('contains export failures without changing retained logs', async () => {
    mockFiles.set(LOG, Buffer.from('current'));
    mockWriteFails = true;

    await expect(exportRadioInfiniteLog()).resolves.toBeNull();

    expect(mockFiles.has(EXPORT)).toBe(false);
    expect(contents(LOG)).toBe('current');

    mockWriteFails = false;

    await exportRadioInfiniteLog();

    expect(contents(EXPORT)).toBe('current');
  });
});
