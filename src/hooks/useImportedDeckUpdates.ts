import { useCallback, useEffect, useState } from "react";
import {
  anyDeckUpdates,
  countDeckUpdates,
  fetchImportedDeckUpdateFlags,
  flagsFromDeckList,
} from "@/lib/importedDeckUpdates";
import type { DeckItem } from "@/lib/api";

const DEFAULT_POLL_MS = 60 * 1000;

export function useImportedDeckUpdates(
  decks: DeckItem[],
  token: string | null | undefined,
  options?: { pollMs?: number; enabled?: boolean }
) {
  const [updateAvailableByDeckId, setUpdateAvailableByDeckId] = useState<
    Record<string, boolean>
  >({});
  const [checking, setChecking] = useState(false);

  const enabled = options?.enabled !== false;
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;

  const refresh = useCallback(async () => {
    if (!token || !enabled) {
      setUpdateAvailableByDeckId({});
      return;
    }
    const instant = flagsFromDeckList(decks);
    if (Object.keys(instant).length > 0) {
      setUpdateAvailableByDeckId((prev) => ({ ...prev, ...instant }));
    }
    setChecking(true);
    try {
      const flags = await fetchImportedDeckUpdateFlags(decks, token);
      setUpdateAvailableByDeckId(flags);
    } catch {
      if (Object.keys(instant).length > 0) {
        setUpdateAvailableByDeckId(instant);
      } else {
        setUpdateAvailableByDeckId({});
      }
    } finally {
      setChecking(false);
    }
  }, [decks, token, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token || !enabled || pollMs <= 0) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, token, enabled, pollMs]);

  useEffect(() => {
    if (!token || !enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh, token, enabled]);

  return {
    updateAvailableByDeckId,
    anyUpdateAvailable: anyDeckUpdates(updateAvailableByDeckId),
    updateCount: countDeckUpdates(updateAvailableByDeckId),
    checking,
    refresh,
  };
}
