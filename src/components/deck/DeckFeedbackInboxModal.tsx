import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptContribution,
  contributionsHasMore,
  entryToDisplayString,
  listDeckContributions,
  patchContribution,
  publishDeck,
  type ContributionStatus,
  type DeckContributionItem,
  type DeckItem,
  type Entry,
} from "@/lib/api";

const STATUS_FILTERS: { value: ContributionStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "accepted", label: "Accepted" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

function formatTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function formatFactPreview(entries: Entry[] | undefined): string {
  if (!entries?.length) return "(empty)";
  return entries.map((e) => entryToDisplayString(e)).join(" · ");
}

function canAcceptItem(item: DeckContributionItem): boolean {
  return item.status === "open" && item.type !== "report";
}

function canResolveItem(item: DeckContributionItem): boolean {
  return item.status === "open" || item.status === "accepted";
}

function canDismissItem(item: DeckContributionItem): boolean {
  return item.status === "open" || item.status === "accepted";
}

function ContributionRow({
  item,
  selected,
  busy,
  bulkBusy,
  onToggle,
  onAccept,
  onPatch,
}: {
  item: DeckContributionItem;
  selected: boolean;
  busy: boolean;
  bulkBusy: boolean;
  onToggle: (id: string) => void;
  onAccept: (id: string) => void;
  onPatch: (id: string, status: "open" | "resolved" | "dismissed") => void;
}) {
  const hasProposal = (item.proposed_entries?.length ?? 0) > 0;
  const hasTagDiff =
    (item.add_tags?.length ?? 0) > 0 || (item.remove_tags?.length ?? 0) > 0;
  const hasFieldRename = (item.proposed_fields?.length ?? 0) > 0;
  const hasTemplate = (item.template?.length ?? 0) > 0;
  const canAccept = canAcceptItem(item);
  const canResolve = canResolveItem(item);
  const canDismiss = canDismissItem(item);
  const canReopen = item.status === "resolved" || item.status === "dismissed";
  const disabled = busy || bulkBusy;

  return (
    <li className="rounded-lg border p-3 space-y-2 text-sm">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(item.id)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border"
        />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
              {item.status}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
              {formatTypeLabel(item.type)}
            </span>
          </span>
          <span className="block">
            <span className="text-muted-foreground">From </span>
            <span className="font-medium">{item.reporter}</span>
            {item.fact_id && (
              <>
                <span className="text-muted-foreground"> · fact </span>
                <span className="font-mono text-xs">{item.fact_id}</span>
              </>
            )}
            <span className="text-muted-foreground"> · source v{item.source_version}</span>
          </span>
          {item.message?.trim() && (
            <span className="block whitespace-pre-wrap">{item.message}</span>
          )}
          {(item.reported_fact || hasProposal || hasTagDiff || hasFieldRename || hasTemplate) && (
            <span className="block rounded bg-muted/40 px-2 py-1.5 text-xs space-y-1">
              {item.reported_fact && (
                <p>
                  <span className="text-muted-foreground">Reported: </span>
                  {formatFactPreview(item.reported_fact.entries)}
                </p>
              )}
              {hasProposal && (
                <p>
                  <span className="text-muted-foreground">Proposed: </span>
                  {formatFactPreview(item.proposed_entries)}
                </p>
              )}
              {hasTagDiff && (
                <p>
                  <span className="text-muted-foreground">Tags: </span>
                  {item.add_tags?.length ? `+${item.add_tags.join(", ")}` : ""}
                  {item.add_tags?.length && item.remove_tags?.length ? " · " : ""}
                  {item.remove_tags?.length ? `−${item.remove_tags.join(", ")}` : ""}
                </p>
              )}
              {hasFieldRename && (
                <p>
                  <span className="text-muted-foreground">Fields: </span>
                  {(item.reported_fields ?? []).join(" · ") || "(current)"}
                  {" → "}
                  {(item.proposed_fields ?? []).join(" · ")}
                </p>
              )}
              {hasTemplate && (
                <p>
                  <span className="text-muted-foreground">Template: </span>
                  <span className="font-mono">{JSON.stringify(item.template)}</span>
                </p>
              )}
            </span>
          )}
          <span className="flex flex-wrap gap-2 pt-1">
            {canAccept && (
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault();
                  onAccept(item.id);
                }}
              >
                Accept proposal
              </Button>
            )}
            {canResolve && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault();
                  onPatch(item.id, "resolved");
                }}
              >
                Mark resolved
              </Button>
            )}
            {canDismiss && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault();
                  onPatch(item.id, "dismissed");
                }}
              >
                Dismiss
              </Button>
            )}
            {canReopen && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault();
                  onPatch(item.id, "open");
                }}
              >
                Reopen
              </Button>
            )}
          </span>
        </span>
      </label>
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
  const [items, setItems] = useState<DeckContributionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<ContributionStatus | "">("open");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchPage = useCallback(
    async (pageOffset: number, append: boolean) => {
      if (!token || !deck.id) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const res = await listDeckContributions(
          deck.id,
          { status: statusFilter, limit: 20, offset: pageOffset },
          token
        );
        const batch = res.data.contributions ?? [];
        setItems((prev) => (append ? [...prev, ...batch] : batch));
        setOffset(pageOffset + batch.length);
        setHasMore(contributionsHasMore(res.meta));
        if (!append) setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load contributions");
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
      setSelected(new Set());
      setBulkBusy(false);
      return;
    }
    void fetchPage(0, false);
  }, [open, statusFilter, deck.id, token, fetchPage]);

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.id)),
    [items, selected]
  );
  const selectableAccept = selectedItems.filter(canAcceptItem);
  const selectableResolve = selectedItems.filter(canResolveItem);
  const selectableDismiss = selectedItems.filter(canDismissItem);

  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && selected.size < items.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((i) => i.id)));
  }

  async function publishOnce(): Promise<number | undefined> {
    try {
      const pub = await publishDeck(deck.id, {}, token);
      return pub.data.published_version;
    } catch {
      return undefined;
    }
  }

  async function handleAccept(contributionId: string) {
    setBusyId(contributionId);
    setError("");
    setNotice("");
    try {
      await acceptContribution(deck.id, contributionId, token);
      const publishedVersion = await publishOnce();
      if (publishedVersion != null) {
        setNotice(
          `Proposal applied and published as v${publishedVersion}. Importers can review and sync the update.`
        );
      } else {
        setNotice(
          "Proposal applied to your working copy, but publish failed. Use Publish update from the deck menu."
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

  async function handlePatch(contributionId: string, status: "open" | "resolved" | "dismissed") {
    setBusyId(contributionId);
    setError("");
    setNotice("");
    try {
      await patchContribution(deck.id, contributionId, { status }, token);
      await fetchPage(0, false);
      await onFeedbackChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkAcceptAndPublish() {
    if (selectableAccept.length === 0) return;
    setBulkBusy(true);
    setError("");
    setNotice("");
    let accepted = 0;
    const failures: string[] = [];
    for (const item of selectableAccept) {
      try {
        await acceptContribution(deck.id, item.id, token);
        accepted += 1;
      } catch (e) {
        failures.push(`${item.id}: ${e instanceof Error ? e.message : "accept failed"}`);
      }
    }
    let publishedVersion: number | undefined;
    if (accepted > 0) {
      publishedVersion = await publishOnce();
    }
    await fetchPage(0, false);
    await onFeedbackChanged?.();
    if (accepted > 0) {
      await onAccepted?.(
        publishedVersion != null ? { published_version: publishedVersion } : undefined
      );
      if (publishedVersion != null) {
        setNotice(
          `Accepted ${accepted} and published as v${publishedVersion}. Importers can sync the update.`
        );
      } else {
        setNotice(
          `Accepted ${accepted} into your working copy, but publish failed. Use Publish update from the deck menu.`
        );
      }
    }
    if (failures.length > 0) {
      setError(failures.slice(0, 3).join(" · ") + (failures.length > 3 ? "…" : ""));
    }
    setBulkBusy(false);
  }

  async function handleBulkPatch(status: "resolved" | "dismissed") {
    const targets = status === "resolved" ? selectableResolve : selectableDismiss;
    if (targets.length === 0) return;
    setBulkBusy(true);
    setError("");
    setNotice("");
    let ok = 0;
    const failures: string[] = [];
    for (const item of targets) {
      try {
        await patchContribution(deck.id, item.id, { status }, token);
        ok += 1;
      } catch (e) {
        failures.push(`${item.id}: ${e instanceof Error ? e.message : "update failed"}`);
      }
    }
    await fetchPage(0, false);
    await onFeedbackChanged?.();
    if (ok > 0) {
      setNotice(
        status === "resolved" ? `Marked ${ok} as resolved.` : `Dismissed ${ok} contribution(s).`
      );
    }
    if (failures.length > 0) {
      setError(failures.slice(0, 3).join(" · ") + (failures.length > 3 ? "…" : ""));
    }
    setBulkBusy(false);
  }

  if (!open) return null;

  const actionsDisabled = loading || busyId != null || bulkBusy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contributions-inbox-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="contributions-inbox-title" className="text-lg font-semibold">
          Contributions inbox
        </h2>
        <p className="text-sm text-muted-foreground">
          Select contributions to bulk accept &amp; publish (importers can then sync), or resolve /
          dismiss.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value || "all"}
              type="button"
              size="sm"
              variant={statusFilter === f.value ? "default" : "outline"}
              onClick={() => setStatusFilter(f.value)}
              disabled={actionsDisabled}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading contributions…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && (
          <p className="text-sm text-green-800 dark:text-green-200 rounded border border-green-600/40 bg-green-600/10 px-3 py-2">
            {notice}
          </p>
        )}
        {!loading && items.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No contributions yet.</p>
        )}
        {items.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
                disabled={actionsDisabled}
                className="h-4 w-4 rounded border"
              />
              <span>Select all ({items.length})</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={actionsDisabled || selectableAccept.length === 0}
                onClick={() => void handleBulkAcceptAndPublish()}
              >
                {bulkBusy
                  ? "Working…"
                  : selectableAccept.length === 0
                    ? "Accept & publish selected"
                    : `Accept & publish selected (${selectableAccept.length})`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={actionsDisabled || selectableResolve.length === 0}
                onClick={() => void handleBulkPatch("resolved")}
              >
                Resolve selected
                {selectableResolve.length > 0 ? ` (${selectableResolve.length})` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={actionsDisabled || selectableDismiss.length === 0}
                onClick={() => void handleBulkPatch("dismissed")}
              >
                Dismiss selected
                {selectableDismiss.length > 0 ? ` (${selectableDismiss.length})` : ""}
              </Button>
            </div>
            <ul className="space-y-3 list-none">
              {items.map((item) => (
                <ContributionRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  busy={busyId === item.id}
                  bulkBusy={bulkBusy}
                  onToggle={toggleOne}
                  onAccept={(id) => void handleAccept(id)}
                  onPatch={(id, status) => void handlePatch(id, status)}
                />
              ))}
            </ul>
          </>
        )}
        {hasMore && (
          <div className="flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loadingMore || actionsDisabled}
              onClick={() => void fetchPage(offset, true)}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={bulkBusy}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
