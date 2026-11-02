import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { buildAutoName, capturePlayerSnapshot, commitBookmark } from '../services/bookmarkService';
import { bookmarkSheetStore } from '../store/bookmarkSheetStore';
import { bookmarksStore } from '../store/bookmarksStore';
import { playbackToastStore } from '../store/playbackToastStore';

/** Capture at tap time; let an enclosing menu close before opening the name sheet. */
export function useBookmarkAction(beforeSave?: () => Promise<void>) {
  const { t, i18n } = useTranslation();
  const autoName = bookmarksStore((s) => s.autoName);

  return useCallback(async () => {
    // Capture the queue/position NOW, at tap time, regardless of which path we
    // take — the manual-name sheet commits this same snapshot on Save.
    const snapshot = capturePlayerSnapshot();
    if (!snapshot) return;
    const existingNames = Object.values(bookmarksStore.getState().bookmarks).map((b) => b.name);
    const suggested = buildAutoName(t, i18n.language, existingNames);
    if (beforeSave) await beforeSave();
    if (autoName) {
      commitBookmark(snapshot, suggested);
      playbackToastStore.getState().flashSuccess(t('bookmarkSaved'));
    } else {
      bookmarkSheetStore.getState().showCreate(suggested, snapshot);
    }
  }, [autoName, t, i18n.language, beforeSave]);
}
