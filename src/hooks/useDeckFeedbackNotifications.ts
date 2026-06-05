import { useCallback, useEffect, useState } from "react";
import {
  anyOpenFeedback,
  decksWithOpenFeedback,
  fetchOpenFeedbackCounts,
  firstDeckIdWithMostFeedback,
  totalOpenFeedback,
} from "@/lib/deckFeedbackNotifications";
import type { DeckItem } from "@/lib/api";

const DEFAULT_POLL_MS = 60 * 1000;

export function useDeckFeedbackNotifications(
  decks: DeckItem[],
  token: string | null | undefined,
  options?: { pollMs?: number; enabled?: boolean }
) {
  const [openCountByDeckId, setOpenCountByDeckId] = useState<Record<string, number>>({});
  const [checking, setChecking] = useState(false);

  const enabled = options?.enabled !== false;
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;

  const refresh = useCallback(async () => {
    if (!token || !enabled) {
      setOpenCountByDeckId({});
      return;
    }
    setChecking(true);
    try {
      const counts = await fetchOpenFeedbackCounts(decks, token);
      setOpenCountByDeckId(counts);
    } catch {
      setOpenCountByDeckId({});
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
    openCountByDeckId,
    anyOpenFeedback: anyOpenFeedback(openCountByDeckId),
    feedbackDeckCount: decksWithOpenFeedback(openCountByDeckId),
    totalOpenCount: totalOpenFeedback(openCountByDeckId),
    firstDeckId: firstDeckIdWithMostFeedback(openCountByDeckId),
    checking,
    refresh,
  };
}
