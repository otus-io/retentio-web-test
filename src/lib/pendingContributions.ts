/** Client-side contribution box for imported decks: pending outbox + sent history. */

export type ContributionBoxKind =
  | "edit"
  | "add"
  | "deck_tags"
  | "fact_tags"
  | "template"
  | "field_rename"
  | "report";

export interface PendingContributionItem {
  /** Stable key for upsert/remove (e.g. edit:factId, deck_tags). */
  id: string;
  kind: ContributionBoxKind;
  factId?: string;
  /** ISO timestamp when recorded. */
  savedAt: string;
  preview?: string;
  addTags?: string[];
  removeTags?: string[];
  proposedFields?: string[];
  template?: number[][];
  message?: string;
}

export interface SentContributionItem {
  id: string;
  kind: ContributionBoxKind;
  factId?: string;
  sentAt: string;
  preview?: string;
  message?: string;
  contributionId?: string;
}

const PENDING_PREFIX = "retentio_pending_contribs_v2:";
const SENT_PREFIX = "retentio_sent_contribs_v1:";
const LEGACY_PENDING_PREFIX = "retentio_pending_contribs_v1:";

const KINDS = new Set<ContributionBoxKind>([
  "edit",
  "add",
  "deck_tags",
  "fact_tags",
  "template",
  "field_rename",
  "report",
]);

function pendingKey(deckId: string): string {
  return `${PENDING_PREFIX}${deckId}`;
}

function sentKey(deckId: string): string {
  return `${SENT_PREFIX}${deckId}`;
}

function isKind(v: unknown): v is ContributionBoxKind {
  return typeof v === "string" && KINDS.has(v as ContributionBoxKind);
}

function pendingItemId(kind: ContributionBoxKind, factId?: string): string {
  if (kind === "deck_tags" || kind === "field_rename") return kind;
  if (factId) return `${kind}:${factId}`;
  return kind;
}

function migrateLegacyPending(deckId: string): PendingContributionItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LEGACY_PENDING_PREFIX}${deckId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const migrated: PendingContributionItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const factId = (row as { factId?: string }).factId;
      const kind = (row as { kind?: string }).kind;
      if (typeof factId !== "string" || (kind !== "edit" && kind !== "add")) continue;
      migrated.push({
        id: pendingItemId(kind, factId),
        factId,
        kind,
        preview: (row as { preview?: string }).preview,
        savedAt: (row as { savedAt?: string }).savedAt ?? new Date().toISOString(),
      });
    }
    if (migrated.length > 0) {
      writePending(deckId, migrated);
      localStorage.removeItem(`${LEGACY_PENDING_PREFIX}${deckId}`);
    }
    return migrated;
  } catch {
    return [];
  }
}

function readPending(deckId: string): PendingContributionItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(pendingKey(deckId));
    if (!raw) return migrateLegacyPending(deckId);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is PendingContributionItem => {
      if (!row || typeof row !== "object") return false;
      const r = row as PendingContributionItem;
      return typeof r.id === "string" && isKind(r.kind) && typeof r.savedAt === "string";
    });
  } catch {
    return [];
  }
}

function writePending(deckId: string, items: PendingContributionItem[]): void {
  if (typeof localStorage === "undefined") return;
  if (items.length === 0) {
    localStorage.removeItem(pendingKey(deckId));
    return;
  }
  localStorage.setItem(pendingKey(deckId), JSON.stringify(items));
}

function readSent(deckId: string): SentContributionItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(sentKey(deckId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is SentContributionItem => {
      if (!row || typeof row !== "object") return false;
      const r = row as SentContributionItem;
      return typeof r.id === "string" && isKind(r.kind) && typeof r.sentAt === "string";
    });
  } catch {
    return [];
  }
}

function writeSent(deckId: string, items: SentContributionItem[]): void {
  if (typeof localStorage === "undefined") return;
  if (items.length === 0) {
    localStorage.removeItem(sentKey(deckId));
    return;
  }
  // Cap history to keep localStorage small.
  const capped = items.slice(0, 200);
  localStorage.setItem(sentKey(deckId), JSON.stringify(capped));
}

export function listPendingContributions(deckId: string): PendingContributionItem[] {
  return readPending(deckId).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function countPendingContributions(deckId: string): number {
  return readPending(deckId).length;
}

export function listSentContributions(deckId: string): SentContributionItem[] {
  return readSent(deckId).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function upsertPendingContribution(
  deckId: string,
  item: Omit<PendingContributionItem, "savedAt" | "id"> & {
    id?: string;
    savedAt?: string;
    factId?: string;
  }
): PendingContributionItem[] {
  const id = item.id ?? pendingItemId(item.kind, item.factId);
  const nextItem: PendingContributionItem = {
    id,
    kind: item.kind,
    factId: item.factId,
    preview: item.preview,
    addTags: item.addTags,
    removeTags: item.removeTags,
    proposedFields: item.proposedFields,
    template: item.template,
    message: item.message,
    savedAt: item.savedAt ?? new Date().toISOString(),
  };
  const prev = readPending(deckId).filter((r) => r.id !== id);
  writePending(deckId, [nextItem, ...prev]);
  return listPendingContributions(deckId);
}

export function removePendingContribution(
  deckId: string,
  pendingId: string
): PendingContributionItem[] {
  const next = readPending(deckId).filter((r) => r.id !== pendingId);
  writePending(deckId, next);
  return listPendingContributions(deckId);
}

/** @deprecated Prefer removePendingContribution(deckId, pendingId). */
export function removePendingContributionByFactId(
  deckId: string,
  factId: string
): PendingContributionItem[] {
  const next = readPending(deckId).filter((r) => r.factId !== factId);
  writePending(deckId, next);
  return listPendingContributions(deckId);
}

export function clearPendingContributions(deckId: string): void {
  writePending(deckId, []);
}

export function appendSentContribution(
  deckId: string,
  item: Omit<SentContributionItem, "id" | "sentAt"> & {
    id?: string;
    sentAt?: string;
  }
): SentContributionItem[] {
  const row: SentContributionItem = {
    id: item.id ?? `${item.kind}:${item.factId ?? "deck"}:${Date.now()}`,
    kind: item.kind,
    factId: item.factId,
    preview: item.preview,
    message: item.message,
    contributionId: item.contributionId,
    sentAt: item.sentAt ?? new Date().toISOString(),
  };
  const next = [row, ...readSent(deckId)];
  writeSent(deckId, next);
  return listSentContributions(deckId);
}

/** Move a pending row to sent history (after successful API submit). */
export function markPendingAsSent(
  deckId: string,
  pendingId: string,
  extra?: { contributionId?: string; message?: string }
): void {
  const pending = readPending(deckId).find((r) => r.id === pendingId);
  removePendingContribution(deckId, pendingId);
  if (!pending) return;
  appendSentContribution(deckId, {
    kind: pending.kind,
    factId: pending.factId,
    preview: pending.preview,
    message: extra?.message ?? pending.message,
    contributionId: extra?.contributionId,
  });
}

export function previewFromEntries(
  entries: { text?: string }[] | undefined
): string | undefined {
  if (!entries?.length) return undefined;
  for (const e of entries) {
    const t = e.text?.trim();
    if (t) return t.length > 80 ? `${t.slice(0, 77)}…` : t;
  }
  return undefined;
}

export function formatContributionKind(kind: ContributionBoxKind): string {
  switch (kind) {
    case "edit":
      return "Fact edit";
    case "add":
      return "New fact";
    case "deck_tags":
      return "Deck tags";
    case "fact_tags":
      return "Fact tags";
    case "template":
      return "Template";
    case "field_rename":
      return "Field rename";
    case "report":
      return "Report";
  }
}
