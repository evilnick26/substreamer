/**
 * Delete library rows the server no longer has, once per earned resync epoch.
 *
 * `syncStatusStore.fullResyncEpoch` holds the start time of the last `full` resync that
 * reached BOTH completion markers; null means no run has ever enumerated the whole
 * library and nothing is authorised. Everything that run wrote carries
 * `synced_at >= epoch`, so what is older is what the server no longer lists — minus the
 * hard exclusions in `db/repository/reap.ts`, which no epoch overrides.
 *
 * OFF the boot path (idle-scheduled from `_layout.tsx`), chunked with a macrotask yield
 * so a 200k-album / 1–3M-song library never holds the single pool thread. The reaped
 * epoch is recorded on success, so a relaunch does not walk the tables again; a run
 * killed part-way records nothing and simply repeats — deleting an already-deleted row
 * is a no-op, so no cursor needs persisting.
 *
 * Songs first, then albums: an album's tracks go before the row they hang off.
 */
import { reapStaleAlbums, reapStaleSongs, type ReapChunk } from '../db/repository/reap';
import { errMessage } from '../utils/errorMessage';
import { getDb, type InternalDb } from '../store/persistence/db';
import { kvStorage } from '../store/persistence';
import { syncStatusStore } from '../store/syncStatusStore';

/** The epoch already reaped. Its own KV row rather than a store field: it is bookkeeping
 *  for this pass, read once per launch and by nothing else. */
const STATE_KEY = 'substreamer-library-reap';

const yieldMacrotask = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

/** Walk one table to exhaustion, a chunk at a time, yielding between chunks. */
async function reapTable(
  chunkOf: (db: InternalDb, epoch: number, afterId: string) => Promise<ReapChunk>,
  db: InternalDb,
  epoch: number,
): Promise<number> {
  let cursor = '';
  let deleted = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const chunk = await chunkOf(db, epoch, cursor);
    if (chunk.cursor === null) return deleted;
    cursor = chunk.cursor;
    deleted += chunk.deleted;
    // eslint-disable-next-line no-await-in-loop
    await yieldMacrotask();
  }
}

export type LibraryReapResult =
  | { status: 'completed'; albums: number; songs: number }
  | { status: 'already-completed'; albums: 0; songs: 0 }
  | { status: 'skipped'; reason: 'no-database' | 'no-epoch' }
  | { status: 'failed'; message: string };

let inFlight: Promise<LibraryReapResult> | null = null;

/**
 * Reap against the current epoch if one has been earned and not yet acted on. Safe to
 * call on every launch: it returns immediately when there is no epoch or the epoch is
 * already reaped, and a run already in flight is shared rather than started twice.
 */
export function runLibraryReapIfNeeded(): Promise<LibraryReapResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const db = getDb();
      if (!db) return { status: 'skipped', reason: 'no-database' } as const;
      const epoch = syncStatusStore.getState().fullResyncEpoch;
      // No full resync has ever finished — nothing authorises a delete.
      if (epoch === null) return { status: 'skipped', reason: 'no-epoch' } as const;
      if ((await kvStorage.getItem(STATE_KEY)) === String(epoch)) {
        return { status: 'already-completed', albums: 0, songs: 0 } as const;
      }

      const songs = await reapTable(reapStaleSongs, db, epoch);
      const albums = await reapTable(reapStaleAlbums, db, epoch);
      await kvStorage.setItem(STATE_KEY, String(epoch));

      // eslint-disable-next-line no-console
      console.log('[library-reap] done', { epoch, songs, albums });
      return { status: 'completed', albums, songs } as const;
    } catch (e) {
      // Nothing is stamped, so the next launch retries the whole pass.
      // eslint-disable-next-line no-console
      console.warn('[library-reap] failed', errMessage(e));
      return { status: 'failed', message: errMessage(e) } as const;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Test-only: drop the shared in-flight promise between cases. */
export const __resetLibraryReapForTests = (): void => {
  inFlight = null;
};
