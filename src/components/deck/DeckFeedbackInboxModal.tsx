import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptDeckFeedback,
  entryToDisplayString,
  feedbackHasMore,
  listDeckFeedback,
  patchDeckFeedback,
  publishDeck,
  type DeckFeedbackItem,
  type DeckItem,
  type Entry,
  type FeedbackStatus,
} from "@/lib/api";

const STATUS_FILTERS: { value: FeedbackStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "accepted", label: "Accepted" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

function formatFactPreview(entries: Entry[] | undefined): string {
  if (!entries?.length) return "(empty)";
  return entries.map((e) => entryToDisplayString(e)).join(" · ");
}

function FeedbackRow({
  item,
  busy,
  onAccept,
  onPatch,
}: {
  item: DeckFeedbackItem;
  busy: boolean;
  onAccept: (id: string) => void;
  onPatch: (id: string, status: "open" | "resolved" | "dismissed") => void;
}) {
  const hasProposal = (item.proposed_entries?.length ?? 0) > 0;
  const canAccept = item.status === "open" && hasProposal;
  const canResolve = item.status === "open" || item.status === "accepted";
  const canDismiss = item.status === "open" || item.status === "accepted";
  const canReopen = item.status === "resolved" || item.status === "dismissed";

  return (
    <li className="rounded-lg border p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{item.status}</span>
        <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{item.category}</span>
      </div>
      <p>
        <span className="text-muted-foreground">From </span>
        <span className="font-medium">{item.reporter}</span>
        <span className="text-muted-foreground"> · fact </span>
        <span className="font-mono text-xs">{item.fact_id}</span>
        <span className="text-muted-foreground"> · source v{item.source_version}</span>
      </p>
      {item.message?.trim() && <p className="whitespace-pre-wrap">{item.message}</p>}
      <div className="rounded bg-muted/40 px-2 py-1.5 text-xs space-y-1">
        <p>
          <span className="text-muted-foreground">Reported: </span>
          {formatFactPreview(item.reported_fact.entries)}
        </p>
        {hasProposal && (
          <p>
            <span className="text-muted-foreground">Proposed: </span>
            {formatFactPreview(item.proposed_entries)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {canAccept && (
          <Button type="button" size="sm" disabled={busy} onClick={() => onAccept(item.id)}>
            Accept proposal
          </Button>
        )}
        {canResolve && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onPatch(item.id, "resolved")}
          >
            Mark resolved
          </Button>
        )}
        {canDismiss && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onPatch(item.id, "dismissed")}
          >
            Dismiss
          </Button>
        )}
        {canReopen && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onPatch(item.id, "open")}
          >
            Reopen
          </Button>
        )}
      </div>
    </li>
  );
}

interface DeckFeedbackInboxModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  token: string;
  onAccepted?: (detail?: { published_version: number }) => void | Promise<void>;
  onFeedbackChanged?: () => void | Promise<void>;
}

export function DeckFeedbackInboxModal({
  open,
  onClose,
  deck,
  token,
  onAccepted,
  onFeedbackChanged,
}: DeckFeedbackInboxModalProps) {
  const [items, setItems] = useState<DeckFeedbackItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "">("open");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchPage = useCallback(
    async (pageOffset: number, append: boolean) => {
      if (!token || !deck.id) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const res = await listDeckFeedback(
          deck.id,
          { status: statusFilter, limit: 20, offset: pageOffset },
          token
        );
        const batch = res.data.feedback ?? [];
        setItems((prev) => (append ? [...prev, ...batch] : batch));
        setOffset(pageOffset + batch.length);
        setHasMore(feedbackHasMore(res.meta));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load feedback");
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [deck.id, token, statusFilter]
  );

  useEffect(() => {
    if (!open) {
      setItems([]);
      setOffset(0);
      setHasMore(false);
      setError("");
      setNotice("");
      return;
    }
    void fetchPage(0, false);
  }, [open, statusFilter, deck.id, token, fetchPage]);

  async function handleAccept(feedbackId: string) {
    setBusyId(feedbackId);
    setError("");
    setNotice("");
    try {
      await acceptDeckFeedback(deck.id, feedbackId, token);
      let publishedVersion: number | undefined;
      try {
        const pub = await publishDeck(deck.id, {}, token);
        publishedVersion = pub.data.published_version;
        setNotice(
          `Proposal applied and published as v${publishedVersion}. Importers can review and sync the update.`
        );
      } catch (pubErr) {
        setNotice(
          `Proposal applied to your working copy, but publish failed: ${
            pubErr instanceof Error ? pubErr.message : "unknown error"
          }. Use Publish update from the deck menu.`
        );
      }
      await fetchPage(0, false);
      await onAccepted?.(
        publishedVersion != null ? { published_version: publishedVersion } : undefined
      );
      await onFeedbackChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePatch(feedbackId: string, status: "open" | "resolved" | "dismissed") {
    setBusyId(feedbackId);
    setError("");
    setNotice("");
    try {
      await patchDeckFeedback(deck.id, feedbackId, { status }, token);
      await fetchPage(0, false);
      await onFeedbackChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-inbox-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="feedback-inbox-title" className="text-lg font-semibold">
          Feedback inbox
        </h2>
        <p className="text-sm text-muted-foreground">
          Reports and edit proposals from users who imported this deck.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value || "all"}
              type="button"
              size="sm"
              variant={statusFilter === f.value ? "default" : "outline"}
              onClick={() => setStatusFilter(f.value)}
              disabled={loading || busyId != null}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading feedback…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && (
          <p className="text-sm text-green-800 dark:text-green-200 rounded border border-green-600/40 bg-green-600/10 px-3 py-2">
            {notice}
          </p>
        )}
        {!loading && items.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        )}
        {items.length > 0 && (
          <ul className="space-y-3 list-none">
            {items.map((item) => (
              <FeedbackRow
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onAccept={(id) => void handleAccept(id)}
                onPatch={(id, status) => void handlePatch(id, status)}
              />
            ))}
          </ul>
        )}
        {hasMore && (
          <div className="flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loadingMore || busyId != null}
              onClick={() => void fetchPage(offset, true)}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
