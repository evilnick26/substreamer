import { File, Paths } from 'expo-file-system';

export const RADIO_INFINITE_DIAG_FLAG_FILE =
  'radio-infinite-diagnostics-enabled';
export const RADIO_INFINITE_DIAG_LOG_FILE =
  'radio-infinite-diagnostics.log';
export const RADIO_INFINITE_DIAG_OLD_LOG_FILE =
  'radio-infinite-diagnostics.old.log';

export const RADIO_INFINITE_DIAG_EXPORT_FILE =
  'radio-infinite-diagnostics-export.log';

const MAX_LOG_BYTES = 512 * 1024;

let writeQueue: Promise<void> = Promise.resolve();

function enqueue(operation: () => void): Promise<void> {
  writeQueue = writeQueue.then(() => {
    try {
      operation();
    } catch {
      // Diagnostic I/O must not interfere with playback.
    }
  });
  return writeQueue;
}

export function isRadioInfiniteLoggingEnabled(): boolean {
  try {
    return new File(
      Paths.document,
      RADIO_INFINITE_DIAG_FLAG_FILE,
    ).exists;
  } catch {
    return false;
  }
}

export function logRadioInfinite(message: string): void {
  if (!isRadioInfiniteLoggingEnabled()) return;

  const line = `[${new Date().toISOString()}] ${message}\n`;

  void enqueue(() => {
    if (!isRadioInfiniteLoggingEnabled()) return;

    const bytes = new TextEncoder().encode(line);
    if (bytes.byteLength > MAX_LOG_BYTES) return;

    let logFile = new File(
      Paths.document,
      RADIO_INFINITE_DIAG_LOG_FILE,
    );

    if (
      logFile.exists &&
      logFile.size + bytes.byteLength > MAX_LOG_BYTES
    ) {
      const oldLog = new File(
        Paths.document,
        RADIO_INFINITE_DIAG_OLD_LOG_FILE,
      );

      if (oldLog.exists) oldLog.delete();

      logFile.moveSync(oldLog);

      logFile = new File(
        Paths.document,
        RADIO_INFINITE_DIAG_LOG_FILE,
      );
    }

    if (!logFile.exists) logFile.create();

    logFile.write(bytes, { append: true });
  });
}

export function flushRadioInfiniteLog(): Promise<void> {
  return writeQueue;
}

export interface RadioInfiniteLogStatus {
  enabled: boolean;
  logFileSize: number | null;
}

export async function setRadioInfiniteLoggingEnabled(
  enabled: boolean,
): Promise<void> {
  await enqueue(() => {
    const flag = new File(
      Paths.document,
      RADIO_INFINITE_DIAG_FLAG_FILE,
    );

    if (enabled) {
      if (!flag.exists) flag.create();
    } else if (flag.exists) {
      flag.delete();
    }
  });
}

export async function getRadioInfiniteLogStatus():
Promise<RadioInfiniteLogStatus | null> {
  let status: RadioInfiniteLogStatus | null = null;

  await enqueue(() => {
    const flag = new File(
      Paths.document,
      RADIO_INFINITE_DIAG_FLAG_FILE,
    );

    const files = [
      new File(Paths.document, RADIO_INFINITE_DIAG_OLD_LOG_FILE),
      new File(Paths.document, RADIO_INFINITE_DIAG_LOG_FILE),
    ];

    let size = 0;
    let found = false;

    for (const file of files) {
      if (file.exists) {
        found = true;
        size += file.size;
      }
    }

    status = {
      enabled: flag.exists,
      logFileSize: found ? size : null,
    };
  });

  return status;
}

export async function exportRadioInfiniteLog():
Promise<string | null> {
  let uri: string | null = null;

  await enqueue(() => {
    const oldLog = new File(
      Paths.document,
      RADIO_INFINITE_DIAG_OLD_LOG_FILE,
    );
    const activeLog = new File(
      Paths.document,
      RADIO_INFINITE_DIAG_LOG_FILE,
    );

    const exported = new File(
      Paths.cache,
      RADIO_INFINITE_DIAG_EXPORT_FILE,
    );

    if (exported.exists) exported.delete();

    if (!oldLog.exists && !activeLog.exists) return;

    try {
      exported.create();

      for (const file of [oldLog, activeLog]) {
        if (file.exists) {
          exported.write(file.bytesSync(), { append: true });
        }
      }

      uri = exported.uri;
    } catch {
      if (exported.exists) exported.delete();
    }
  });

  return uri;
}

export function clearRadioInfiniteLog(): Promise<void> {
  return enqueue(() => {
    const files = [
      new File(Paths.document, RADIO_INFINITE_DIAG_LOG_FILE),
      new File(Paths.document, RADIO_INFINITE_DIAG_OLD_LOG_FILE),
      new File(Paths.cache, RADIO_INFINITE_DIAG_EXPORT_FILE),
    ];

    for (const file of files) {
      if (file.exists) file.delete();
    }
  });
}
