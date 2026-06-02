import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ChangeEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  appendEmptyEntryColumnToAllFacts,
  cloneFactsList,
  clearEntryMediaSlot,
  existingFactsColumnCount,
  existingFactsHeaderLabels,
  factEntryAt,
  factHasSomeContent,
  insertEmptyEntryAfter,
  mergeEntryMediaPatch,
  mergeParentFirstPagePreservingTail,
  mergeServerFactsPreservingDirty,
  mediaSlotForFile,
  minSpreadsheetColumnCount,
  removeFactEntryAt,
  trimAllFactsToEntryCount,
  updateFactEntryText,
} from "@/lib/existingFactsSpreadsheet";
import {
  buildTemplateForRequest,
  entryToDisplayString,
  fileLooksLikeJson,
  request,
  fetchDeckFactsPage,
  fetchDeckFactsUnpaginated,
  uploadMultipart,
  type AddFactReq,
  type AddFactRes,
  type DeckItem,
  type Entry,
  type FactItem,
  type MediaItem,
  type UpdateDeckReq,
  type UpdateDeckRes,
  type UpdateFactReq,
  type UploadMediaRes,
} from "@/lib/api";
import { FactTagsPicker } from "./FactTagsPicker";

const PAGE_SIZE = 50;
const NO_DECK_FIELDS: string[] = [];

const SLOT_LABEL: Record<"audio" | "image" | "video" | "json", string> = {
  audio: "Audio",
  image: "Image",
  video: "Video",
  json: "JSON",
};

export interface BulkEditFactsModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  token: string | null;
  factsList: FactItem[];
  /** True when the API reports more facts beyond `factsList` (same as GET /facts first page). */
  factsHasMore: boolean;
  /** `meta.total` from GET /facts (total facts in deck); drives page count. */
  factsTotal: number | null;
  onRefreshFacts: () => Promise<void>;
  onDeleteFact: (factId: string) => void | Promise<void>;
  deleteFactId: string | null;
  setDeleteFactId: (id: string | null) => void;
}

export function BulkEditFactsModal({
  open,
  onClose,
  deck,
  token,
  factsList,
  factsHasMore,
  factsTotal,
  onRefreshFacts,
  onDeleteFact,
  deleteFactId,
  setDeleteFactId,
}: BulkEditFactsModalProps) {
  const [localFacts, setLocalFacts] = useState<FactItem[]>([]);
  const [dirtyFactIds, setDirtyFactIds] = useState<Set<string>>(() => new Set());
  const [savingFactId, setSavingFactId] = useState<string | null>(null);
  const [mediaUploadingKey, setMediaUploadingKey] = useState<string | null>(null);
  const [mediaFilenameById, setMediaFilenameById] = useState<Map<string, string>>(() => new Map());
  const mediaFilenameByIdRef = useRef<Map<string, string>>(new Map());
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const pendingMediaPickRef = useRef<{
    factId: string;
    entryIndex: number;
    replaceSlot?: "audio" | "image" | "video" | "json";
  } | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [factPage, setFactPage] = useState(1);
  const wasOpenRef = useRef(false);
  const dirtyFactIdsRef = useRef(dirtyFactIds);
  dirtyFactIdsRef.current = dirtyFactIds;
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [baselineColumnNames, setBaselineColumnNames] = useState<string[]>([]);
  const [savingColumns, setSavingColumns] = useState(false);
  const [addingFactRow, setAddingFactRow] = useState(false);
  const [goToLastPageAfterAdd, setGoToLastPageAfterAdd] = useState(false);
  const [serverHasMore, setServerHasMore] = useState(false);
  const [serverNextOffset, setServerNextOffset] = useState(0);
  const [loadingMoreFacts, setLoadingMoreFacts] = useState(false);
  /** Synced from GET /facts `meta.total` (prop + each paged fetch + full fetch after add). */
  const [factsTotalFromApi, setFactsTotalFromApi] = useState<number | null>(null);

  const deckId = deck.id;
  /** API may omit `field`; treat as [] so column math matches PATCH rules. */
  const deckFieldsSafe = Array.isArray(deck.fields) ? deck.fields : NO_DECK_FIELDS;
  const colCount = existingFactsColumnCount(deckFieldsSafe, localFacts);
  const total = localFacts.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const apiFactTotal = factsTotalFromApi ?? factsTotal;
  const pageCountTotal =
    apiFactTotal != null && apiFactTotal > 0
      ? Math.max(Math.ceil(apiFactTotal / PAGE_SIZE), totalPages)
      : totalPages;
  const start = (factPage - 1) * PAGE_SIZE;
  const pageRows = localFacts.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setFactPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!goToLastPageAfterAdd || addingFactRow) return;
    setFactPage(totalPages);
    setGoToLastPageAfterAdd(false);
  }, [goToLastPageAfterAdd, addingFactRow, totalPages]);

  useEffect(() => {
    if (factsTotal != null) setFactsTotalFromApi(factsTotal);
  }, [factsTotal]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      const initialFacts = cloneFactsList(factsList);
      setLocalFacts(initialFacts);
      setServerHasMore(factsHasMore);
      setServerNextOffset(initialFacts.length);
      setFactsTotalFromApi(factsTotal);
      const cc0 = existingFactsColumnCount(deckFieldsSafe, initialFacts);
      const labels0 = existingFactsHeaderLabels(cc0, deckFieldsSafe);
      setColumnNames(labels0);
      setBaselineColumnNames([...labels0]);
      setDirtyFactIds(new Set());
      setSaveError("");
      setSaveSuccess("");
      setFactPage(1);
      return;
    }
    setLocalFacts((prev) => mergeParentFirstPagePreservingTail(prev, factsList, dirtyFactIdsRef.current));
  }, [open, factsList, factsHasMore, factsTotal]);

  useEffect(() => {
    if (!open) return;
    const cc = existingFactsColumnCount(deckFieldsSafe, localFacts);
    setColumnNames((prev) => {
      if (prev.length > cc) return prev.slice(0, cc);
      if (prev.length >= cc) return prev;
      const pad = existingFactsHeaderLabels(cc, deckFieldsSafe);
      if (prev.length === 0) return pad;
      return [...prev, ...pad.slice(prev.length)];
    });
    setBaselineColumnNames((prev) => {
      if (prev.length > cc) return prev.slice(0, cc);
      if (prev.length >= cc) return prev;
      const pad = existingFactsHeaderLabels(cc, deckFieldsSafe);
      if (prev.length === 0) return pad;
      return [...prev, ...pad.slice(prev.length)];
    });
  }, [open, localFacts, deck.fields]);

  useEffect(() => {
    if (!open || !token) return;
    const ids = new Set<string>();
    for (const f of localFacts) {
      for (const e of f.entries) {
        if (e.audio) ids.add(e.audio);
        if (e.image) ids.add(e.image);
        if (e.video) ids.add(e.video);
        if (e.json) ids.add(e.json);
      }
    }
    const missing = [...ids].filter((id) => !mediaFilenameByIdRef.current.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const mid of missing) {
        try {
          const res = await request<{ data: MediaItem }>(`/api/media/${mid}/meta`, { token });
          if (!cancelled) {
            mediaFilenameByIdRef.current.set(mid, res.data.filename);
          }
        } catch {
          if (!cancelled) {
            mediaFilenameByIdRef.current.set(mid, `${mid.slice(0, 10)}…`);
          }
        }
      }
      if (!cancelled) {
        setMediaFilenameById(new Map(mediaFilenameByIdRef.current));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localFacts, token, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteFactId) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, deleteFactId]);

  /** Appends the next GET /facts page when paginating past loaded rows. Returns whether new rows were added. */
  const fetchNextServerPage = useCallback(async (): Promise<boolean> => {
    if (!token || !serverHasMore || loadingMoreFacts) return false;
    setSaveError("");
    setLoadingMoreFacts(true);
    try {
      const res = await fetchDeckFactsPage(deckId, token, { offset: serverNextOffset });
      const batch = res.data.facts;
      if (batch.length === 0) {
        setServerHasMore(false);
        return false;
      }
      setLocalFacts((prev) => {
        const seen = new Set(prev.map((f) => f.id));
        const toAdd = batch.filter((f) => !seen.has(f.id));
        return [
          ...prev,
          ...toAdd.map((f) => ({ ...f, entries: f.entries.map((e) => ({ ...e })) })),
        ];
      });
      setServerNextOffset((o) => o + batch.length);
      setServerHasMore(res.meta.has_more === true);
      if (typeof res.meta.total === "number" && res.meta.total >= 0) {
        setFactsTotalFromApi(res.meta.total);
      }
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to load more facts.");
      return false;
    } finally {
      setLoadingMoreFacts(false);
    }
  }, [token, deckId, serverHasMore, serverNextOffset, loadingMoreFacts]);

  const handleNextPage = useCallback(async () => {
    if (factPage < totalPages) {
      setFactPage((p) => p + 1);
      return;
    }
    const added = await fetchNextServerPage();
    if (added) setFactPage((p) => p + 1);
  }, [factPage, totalPages, fetchNextServerPage]);

  const busy =
    savingFactId !== null || mediaUploadingKey !== null || savingColumns || addingFactRow || loadingMoreFacts;

  const columnsDirty = useMemo(
    () =>
      columnNames.length !== baselineColumnNames.length ||
      columnNames.some((s, i) => s !== baselineColumnNames[i]),
    [columnNames, baselineColumnNames]
  );

  const saveDeckColumnNames = useCallback(async () => {
    if (!token) return;
    const deckFieldLen = deckFieldsSafe.length;
    // PATCH /api/decks/{id}: when the body includes `fields`, the list replaces deck column names (one or more).
    let outLen: number;
    if (deckFieldLen >= 1) {
      outLen = deckFieldLen;
    } else if (colCount >= 1) {
      outLen = colCount;
    } else {
      setSaveError(
        "This deck has no fields yet. Add at least one column (Add column), or define fields on Edit deck, then save names."
      );
      return;
    }
    const out = Array.from({ length: outLen }, (_, i) => columnNames[i] ?? "");
    const name = (deck.name ?? "").trim() || "Deck";
    setSaveError("");
    setSaveSuccess("");
    setSavingColumns(true);
    try {
      const body: UpdateDeckReq = { name, fields: out };
      await request<UpdateDeckRes>(`/api/decks/${deckId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setBaselineColumnNames([...out]);
      setColumnNames([...out]);
      setSaveSuccess("Column names saved.");
      await onRefreshFacts();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save column names.");
    } finally {
      setSavingColumns(false);
    }
  }, [token, deckId, deck.name, columnNames, deck.fields, localFacts, onRefreshFacts]);

  const addEntryColumnToAllFacts = useCallback(() => {
    setLocalFacts((prev) => {
      if (prev.length === 0) return prev;
      setDirtyFactIds(new Set(prev.map((f) => f.id)));
      return appendEmptyEntryColumnToAllFacts(prev);
    });
    setSaveError("");
    setSaveSuccess("");
  }, []);

  const removeLastEntryColumnFromAllFacts = useCallback(() => {
    if (
      !confirm(
        "Remove the rightmost column from every fact? Data in that column is discarded until you save each row."
      )
    ) {
      return;
    }
    setLocalFacts((prev) => {
      const wide = existingFactsColumnCount(deckFieldsSafe, prev);
      const minC = minSpreadsheetColumnCount(deckFieldsSafe);
      if (wide <= minC) return prev;
      setDirtyFactIds(new Set(prev.map((f) => f.id)));
      return trimAllFactsToEntryCount(prev, wide - 1);
    });
    setSaveError("");
    setSaveSuccess("");
  }, [deckFieldsSafe]);

  const addFactRow = useCallback(async () => {
    if (!token) return;
    const n = existingFactsColumnCount(deckFieldsSafe, localFacts);
    if (n < 1) {
      setSaveError("This deck has no fields yet. Add fields from the deck page (Edit deck) first.");
      return;
    }
    setSaveError("");
    setSaveSuccess("");
    setAddingFactRow(true);
    try {
      const entries: Entry[] = Array.from({ length: n }, (_, i) => (i === 0 ? { text: "New fact" } : {}));
      const body: AddFactReq = {
        facts: [{ entries }],
        ...buildTemplateForRequest(n, 1, false),
      };
      await request<AddFactRes>(`/api/decks/${deckId}/facts/append`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setSaveSuccess("Fact added.");
      setGoToLastPageAfterAdd(true);
      await onRefreshFacts();
      const full = await fetchDeckFactsUnpaginated(deckId, token);
      setLocalFacts((prev) => mergeServerFactsPreservingDirty(prev, full.data.facts, dirtyFactIdsRef.current));
      setServerHasMore(false);
      setServerNextOffset(full.data.facts.length);
      if (typeof full.meta.total === "number" && full.meta.total >= 0) {
        setFactsTotalFromApi(full.meta.total);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to add fact.");
    } finally {
      setAddingFactRow(false);
    }
  }, [token, deckId, deckFieldsSafe, localFacts, onRefreshFacts]);

  const updateFactCell = useCallback((factId: string, entryIndex: number, text: string) => {
    setLocalFacts((prev) => prev.map((f) => (f.id === factId ? updateFactEntryText(f, entryIndex, text) : f)));
    setDirtyFactIds((d) => new Set(d).add(factId));
    setSaveSuccess("");
    setSaveError("");
  }, []);

  const clearMediaSlot = useCallback((factId: string, entryIndex: number, slot: "audio" | "image" | "video" | "json") => {
    setLocalFacts((prev) => prev.map((f) => (f.id === factId ? clearEntryMediaSlot(f, entryIndex, slot) : f)));
    setDirtyFactIds((d) => new Set(d).add(factId));
    setSaveSuccess("");
    setSaveError("");
  }, []);

  const removeFactCell = useCallback((factId: string, entryIndex: number) => {
    setLocalFacts((prev) =>
      prev.map((f) => (f.id === factId ? removeFactEntryAt(f, entryIndex) : f))
    );
    setDirtyFactIds((d) => new Set(d).add(factId));
    setSaveSuccess("");
    setSaveError("");
  }, []);

  const insertFactCellAfter = useCallback((factId: string, entryIndex: number) => {
    setLocalFacts((prev) =>
      prev.map((f) => (f.id === factId ? insertEmptyEntryAfter(f, entryIndex) : f))
    );
    setDirtyFactIds((d) => new Set(d).add(factId));
    setSaveSuccess("");
    setSaveError("");
  }, []);

  const openMediaPicker = useCallback(
    (target: { factId: string; entryIndex: number; replaceSlot?: "audio" | "image" | "video" | "json" }) => {
      pendingMediaPickRef.current = target;
      mediaFileInputRef.current?.click();
    },
    []
  );

  const onMediaFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const target = pendingMediaPickRef.current;
      pendingMediaPickRef.current = null;
      if (!file || !token || !target) return;

      if (target.replaceSlot) {
        const ok =
          (target.replaceSlot === "image" && file.type.startsWith("image/")) ||
          (target.replaceSlot === "video" && file.type.startsWith("video/")) ||
          (target.replaceSlot === "audio" &&
            (file.type.startsWith("audio/") || file.type === "application/ogg")) ||
          (target.replaceSlot === "json" && fileLooksLikeJson(file));
        if (!ok) {
          setSaveError(`Please choose a ${target.replaceSlot} file for this slot.`);
          return;
        }
      } else {
        const slotFromMime = mediaSlotForFile(file);
        if (!slotFromMime) {
          setSaveError("Unsupported file type. Use an image, audio, video, or JSON file.");
          return;
        }
      }

      const uploadKey = `${target.factId}-${target.entryIndex}`;
      setMediaUploadingKey(uploadKey);
      setSaveError("");
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = (await uploadMultipart("/api/media", formData, token)) as UploadMediaRes;
        const newId = String(res.data.id).trim();
        if (!newId) throw new Error("Upload response missing media id");
        const filename = res.data.filename ?? file.name;

        const patch: Partial<Pick<Entry, "audio" | "image" | "video" | "json">> = {};
        if (target.replaceSlot) {
          patch[target.replaceSlot] = newId;
        } else {
          const slotFromMime = mediaSlotForFile(file);
          if (slotFromMime) patch[slotFromMime] = newId;
        }

        setLocalFacts((prev) =>
          prev.map((f) => (f.id === target.factId ? mergeEntryMediaPatch(f, target.entryIndex, patch) : f))
        );
        setDirtyFactIds((d) => new Set(d).add(target.factId));
        setSaveSuccess("");
        mediaFilenameByIdRef.current.set(newId, filename);
        setMediaFilenameById(new Map(mediaFilenameByIdRef.current));
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setMediaUploadingKey(null);
      }
    },
    [token]
  );

  const saveFactRow = useCallback(
    async (factId: string) => {
      if (!token) return;
      const fact = localFacts.find((f) => f.id === factId);
      if (!fact) return;
      if (!factHasSomeContent(fact.entries)) {
        setSaveError("Each fact needs at least one field with text or attached media.");
        return;
      }
      setSaveError("");
      setSaveSuccess("");
      setSavingFactId(factId);
      try {
        const body: UpdateFactReq = { entries: fact.entries };
        await request<unknown>(`/api/decks/${deckId}/facts/${factId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(body),
        });
        setDirtyFactIds((d) => {
          const next = new Set(d);
          next.delete(factId);
          return next;
        });
        setSaveSuccess("Fact saved.");
        await onRefreshFacts();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to save fact.");
      } finally {
        setSavingFactId(null);
      }
    },
    [token, deckId, localFacts, onRefreshFacts]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-edit-facts-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={() => !deleteFactId && onClose()} aria-hidden="true" />
      <div className="relative z-50 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border bg-card shadow-lg">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4">
          <h2 id="bulk-edit-facts-title" className="text-lg font-semibold">
            Edit Facts
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {saveError && <p className="mb-2 text-sm text-destructive">{saveError}</p>}
          {saveSuccess && <p className="mb-2 text-sm text-green-600">{saveSuccess}</p>}
          {localFacts.length === 0 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">No facts in this deck yet.</p>
              <Button type="button" size="sm" disabled={busy} onClick={() => void addFactRow()}>
                {addingFactRow ? "Adding…" : "Add row"}
              </Button>
              <p className="text-xs text-muted-foreground">
                To add more fields (columns), open this deck on the deck page and use Edit deck → Add field.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                Each row is one fact — edit text and media, then Save. Tags on each row save immediately when you add
                or remove them. Add column appends one empty cell on every row (facts can be wider than the deck field
                list). Save column names only updates deck field names; extra columns use the headers above until you add
                matching fields in Edit deck.
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={busy}
                  onClick={() => void addFactRow()}
                >
                  {addingFactRow ? "Adding…" : "Add row"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || localFacts.length === 0}
                  onClick={addEntryColumnToAllFacts}
                  title="Append one empty cell at the end of every fact"
                >
                  Add column
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  disabled={busy || colCount <= minSpreadsheetColumnCount(deckFieldsSafe)}
                  onClick={removeLastEntryColumnFromAllFacts}
                  title="Remove the rightmost column from every fact (cannot go below deck width)"
                >
                  Delete column
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!columnsDirty || savingColumns}
                  onClick={() => void saveDeckColumnNames()}
                >
                  {savingColumns ? "Saving…" : "Save column names"}
                </Button>
              </div>
              <input
                ref={mediaFileInputRef}
                type="file"
                className="sr-only"
                accept="image/*,audio/*,video/*,application/json,.json"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => void onMediaFileChange(e)}
              />
              <div className="overflow-x-auto rounded-md border bg-muted/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-12 px-3 py-2 text-left font-medium">#</th>
                      {Array.from({ length: colCount }, (_, idx) => (
                        <th key={`h-${idx}`} className="min-w-[7rem] px-2 py-2 text-left">
                          <Input
                            value={columnNames[idx] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setColumnNames((prev) => {
                                const next = [...prev];
                                while (next.length <= idx) next.push("");
                                next[idx] = v;
                                return next;
                              });
                            }}
                            className="h-8 min-w-0 text-xs font-medium"
                            aria-label={`Column ${idx + 1} name`}
                            disabled={busy}
                          />
                        </th>
                      ))}
                      <th className="w-36 px-3 py-2 text-right font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((fact, i) => (
                      <Fragment key={fact.id}>
                        <tr className="border-b align-top">
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">{start + i + 1}</td>
                        {Array.from({ length: colCount }, (_, idx) => {
                          const ent = factEntryAt(fact, idx);
                          const mediaUploading = mediaUploadingKey === `${fact.id}-${idx}`;
                          const entryMediaFull =
                            Boolean(ent.audio) &&
                            Boolean(ent.image) &&
                            Boolean(ent.video) &&
                            Boolean(ent.json);
                          return (
                            <td key={`${fact.id}-c${idx}`} className="max-w-[20rem] px-3 py-2">
                              <div className="flex items-start gap-1.5">
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <Input
                                    value={ent.text ?? ""}
                                    onChange={(e) => updateFactCell(fact.id, idx, e.target.value)}
                                    className="h-9 min-w-[6rem]"
                                    aria-label={`${columnNames[idx] ?? `Column ${idx + 1}`}, row ${start + i + 1}`}
                                    disabled={busy}
                                  />
                                  {mediaUploading && (
                                    <p className="text-xs text-muted-foreground">Uploading…</p>
                                  )}
                                  {(["audio", "image", "video", "json"] as const).map((slot) => {
                                    const mid = ent[slot];
                                    if (!mid) return null;
                                    const fname = mediaFilenameById.get(mid) ?? `${mid.slice(0, 10)}…`;
                                    return (
                                      <div
                                        key={slot}
                                        className="flex min-w-0 items-center gap-1.5 text-xs leading-snug"
                                      >
                                        <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">
                                          {SLOT_LABEL[slot]}
                                        </span>
                                        <div className="flex min-w-0 flex-1 justify-start overflow-hidden">
                                          <div className="flex w-max min-w-0 max-w-full items-center gap-0 overflow-hidden">
                                            <span
                                              className="min-w-0 shrink truncate font-medium"
                                              title={mid}
                                            >
                                              {fname}
                                            </span>
                                            <button
                                              type="button"
                                              className="shrink-0 rounded p-0 text-sm leading-none text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                              aria-label={`Remove ${SLOT_LABEL[slot]}`}
                                              title={`Remove ${SLOT_LABEL[slot]}`}
                                              disabled={busy}
                                              onClick={() => clearMediaSlot(fact.id, idx, slot)}
                                            >
                                              ×
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <DropdownMenu trigger="⋯" align="end" className="shrink-0 self-start">
                                  {!entryMediaFull ? (
                                    <DropdownMenuItem
                                      disabled={busy}
                                      onClick={() => openMediaPicker({ factId: fact.id, entryIndex: idx })}
                                    >
                                      Add media…
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    disabled={busy}
                                    onClick={() => insertFactCellAfter(fact.id, idx)}
                                    title="Insert an empty cell to the right of this column on this row"
                                  >
                                    Add cell
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    disabled={
                                      busy ||
                                      fact.entries.length <= 1 ||
                                      idx >= fact.entries.length
                                    }
                                    onClick={() => removeFactCell(fact.id, idx)}
                                    title="Remove this entry from the row (other rows keep their length)"
                                  >
                                    Delete cell
                                  </DropdownMenuItem>
                                </DropdownMenu>
                              </div>
                            </td>
                          );
                        })}
                        <td className="min-w-[9rem] px-3 py-2 text-right align-middle">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={!dirtyFactIds.has(fact.id) || busy}
                              onClick={() => void saveFactRow(fact.id)}
                            >
                              {savingFactId === fact.id ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/50 hover:bg-destructive/10"
                              disabled={busy}
                              onClick={() => setDeleteFactId(fact.id)}
                            >
                              Delete row
                            </Button>
                          </div>
                        </td>
                        </tr>
                        <tr className="border-b last:border-0 bg-muted/5">
                          <td
                            colSpan={colCount + 2}
                            className="px-3 py-2"
                          >
                            <FactTagsPicker
                              token={token}
                              deckId={deckId}
                              factId={fact.id}
                              idPrefix={fact.id}
                              tagItems={fact.tags}
                              selectedIds={(fact.tags ?? []).map((t) => t.id)}
                              onSelectedIdsChange={() => {}}
                              onTagsUpdated={(tags) => {
                                setLocalFacts((prev) =>
                                  prev.map((f) => (f.id === fact.id ? { ...f, tags } : f))
                                );
                              }}
                              compact
                              disabled={busy}
                            />
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {total > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Showing {start + 1}–{Math.min(start + PAGE_SIZE, total)} of {total} rows in this editor ·{" "}
                    {PAGE_SIZE} per page
                    {apiFactTotal != null && apiFactTotal > total ? ` · ${apiFactTotal} in deck` : ""}
                    {serverHasMore ? " · more on server — use Next" : ""}
                  </p>
                  {(totalPages > 1 || serverHasMore) && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFactPage((p) => Math.max(1, p - 1))}
                        disabled={factPage <= 1}
                      >
                        Previous
                      </Button>
                      <span className="px-2 text-sm text-muted-foreground tabular-nums">
                        page {factPage} of {pageCountTotal}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || (factPage >= totalPages && !serverHasMore) || !token}
                        onClick={() => void handleNextPage()}
                      >
                        {loadingMoreFacts && factPage >= totalPages ? "Loading…" : "Next"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Dialog
        open={deleteFactId !== null}
        onOpenChange={(dialogOpen) => !dialogOpen && setDeleteFactId(null)}
        title="Delete fact?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => {
          if (deleteFactId) void onDeleteFact(deleteFactId);
        }}
      >
        {deleteFactId && (() => {
          const fact = localFacts.find((x) => x.id === deleteFactId);
          return (
            <>
              Are you sure you want to delete this fact
              {fact ? <> (&quot;{fact.entries.map(entryToDisplayString).join(" · ")}&quot;)</> : null}? This cannot be
              undone.
            </>
          );
        })()}
      </Dialog>
    </div>
  );
}
