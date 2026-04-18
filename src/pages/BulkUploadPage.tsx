import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ChangeEvent,
} from "react";
import JSZip from "jszip";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  BULK_IMPORT_UPLOAD_TIMEOUT_MS,
  buildTemplateForRequest,
  getApiBaseUrl,
  request,
  uploadMultipart,
  uploadMultipartWithProgress,
  type AddFactReq,
  type AddFactRes,
  type BulkImportRes,
  type Entry,
  type FactItem,
  type GetDeckRes,
  type GetFactsRes,
  type MediaItem,
  type UpdateDeckReq,
  type UpdateDeckRes,
  type UpdateFactReq,
  type UploadMediaRes,
  fileLooksLikeJson,
} from "@/lib/api";
import {
  filterDuplicateImportRows,
  importRowTextSignature,
} from "@/lib/bulkImportDuplicate";
import {
  bulkImportZipEntryIsMedia,
  bulkImportZipPathSkippable,
  listBulkImportMediaPaths,
  normalizeZipPath,
} from "@/lib/bulkImportNormalize";
import { cn } from "@/lib/utils";
import {
  appendEmptyEntryColumnToAllFacts,
  clearEntryMediaSlot,
  existingFactsColumnCount,
  existingFactsHeaderLabels,
  factEntryAt,
  factHasSomeContent,
  insertEmptyEntryAfter,
  mergeEntryMediaPatch,
  mergeFactListsPreservingPriorOrder,
  mediaSlotForFile,
  minSpreadsheetColumnCount,
  removeFactEntryAt,
  trimAllFactsToEntryCount,
  updateFactEntryText,
} from "@/lib/existingFactsSpreadsheet";

type PreviewRow = {
  id: string;
  /** 1-based display index in the table */
  index: number;
  values: string[];
};

const MAX_ZIP_SIZE_BYTES = 500 * 1024 * 1024;
const PREVIEW_PAGE_SIZE = 50;
const CSV_PARSE_LINES_PER_CHUNK = 400;
const PREVIEW_ROW_BUILD_YIELD_EVERY = 400;

/** Lets React commit `setParseProgress` before the next update (avoids React 18 batching the whole loop into one paint). */
function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function parseCsvLine(line: string, delimiter: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Parses CSV in chunks with yields so the UI stays responsive on huge CSVs inside ZIPs. */
async function parseCsvTextAsync(text: string): Promise<{ rows: string[][]; delimiter: "," | ";" }> {
  const rawLines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (rawLines.length === 0) return { rows: [], delimiter: "," };
  const commaCount = (rawLines[0].match(/,/g) ?? []).length;
  const semicolonCount = (rawLines[0].match(/;/g) ?? []).length;
  const delimiter: "," | ";" = semicolonCount > commaCount ? ";" : ",";
  const rows: string[][] = [];
  for (let i = 0; i < rawLines.length; i += CSV_PARSE_LINES_PER_CHUNK) {
    const end = Math.min(i + CSV_PARSE_LINES_PER_CHUNK, rawLines.length);
    for (let j = i; j < end; j += 1) {
      rows.push(parseCsvLine(rawLines[j], delimiter));
    }
    await nextMacrotask();
  }
  return { rows, delimiter };
}

function escapeCsvField(s: string, delimiter: "," | ";"): string {
  const needsQuote =
    s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(delimiter);
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** True if the parsed CSV row has at least one field (column), even if every cell is blank. */
function rowHasAtLeastOneColumn(cells: string[]): boolean {
  return cells.length >= 1;
}

/** True if the row has at least one non-empty cell after trim (allows empty columns elsewhere). */
function rowHasNonEmptyCell(cells: string[]): boolean {
  return cells.some((c) => c.trim() !== "");
}

function withRenumberedRows(list: PreviewRow[]): PreviewRow[] {
  return list.map((r, i) => ({ ...r, index: i + 1 }));
}

/** Row ids whose full row text matches at least one other row (same columns). */
function duplicatePreviewRowIds(rows: PreviewRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = importRowTextSignature(r.values);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out = new Set<string>();
  for (const r of rows) {
    const k = importRowTextSignature(r.values);
    if ((counts.get(k) ?? 0) > 1) out.add(r.id);
  }
  return out;
}

export default function BulkUploadPage() {
  const { id } = useParams<{ id: string }>();
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [deckName, setDeckName] = useState("");
  /** Deck field names — align “existing facts” columns with the deck schema. */
  const [deckFields, setDeckFields] = useState<string[]>([]);
  const [existingFacts, setExistingFacts] = useState<FactItem[]>([]);
  const [loadingExistingFacts, setLoadingExistingFacts] = useState(false);
  const [existingFactsError, setExistingFactsError] = useState("");
  const [existingFactsPage, setExistingFactsPage] = useState(1);
  /** Fact ids with unsaved text edits (each table row is one fact). */
  const [dirtyFactIds, setDirtyFactIds] = useState<Set<string>>(() => new Set());
  const [savingFactId, setSavingFactId] = useState<string | null>(null);
  const [existingMediaUploadingKey, setExistingMediaUploadingKey] = useState<string | null>(null);
  const [mediaFilenameById, setMediaFilenameById] = useState<Map<string, string>>(() => new Map());
  const mediaFilenameByIdRef = useRef<Map<string, string>>(new Map());
  const existingMediaFileInputRef = useRef<HTMLInputElement>(null);
  const pendingExistingMediaPickRef = useRef<{
    factId: string;
    entryIndex: number;
    replaceSlot?: "audio" | "image" | "video" | "json";
  } | null>(null);
  const [existingSaveError, setExistingSaveError] = useState("");
  const [existingSaveSuccess, setExistingSaveSuccess] = useState("");
  const [editableColumnNames, setEditableColumnNames] = useState<string[]>([]);
  const [savingColumnLabels, setSavingColumnLabels] = useState(false);
  const [addingExistingFactRow, setAddingExistingFactRow] = useState(false);
  /** Selected fact ids on “Facts already in this deck” for bulk delete from server. */
  const [selectedExistingFactIds, setSelectedExistingFactIds] = useState<Set<string>>(() => new Set());
  const [bulkDeletingExisting, setBulkDeletingExisting] = useState(false);
  const [deletingExistingFactId, setDeletingExistingFactId] = useState<string | null>(null);
  const selectAllExistingCheckboxRef = useRef<HTMLInputElement>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  /** All CSV data rows from the ZIP (before hiding duplicates vs deck / within file). */
  const [csvRawRows, setCsvRawRows] = useState<PreviewRow[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [importDedupeStats, setImportDedupeStats] = useState<{
    skippedAlreadyInDeck: number;
    skippedDuplicateInCsv: number;
  } | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  /** Normalized ZIP paths for supported media files (same matching rules as the API). */
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  /** After a successful ZIP parse: presence + supported file counts under audio/, image/, video/, json/. */
  const [csvPathInZip, setCsvPathInZip] = useState("facts.csv");
  const [csvDelimiter, setCsvDelimiter] = useState<"," | ";">(",");
  const [includeHeaderRow, setIncludeHeaderRow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [parsing, setParsing] = useState(false);
  /** 0–100 while parsing ZIP for preview (determinate progress). */
  const [parseProgress, setParseProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<"idle" | "building" | "uploading">("idle");
  const [submitUploadProgress, setSubmitUploadProgress] = useState(0);
  /** User must check this after reviewing the table before Submit import is enabled */
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  /** Row ids selected for bulk delete */
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const routeDeckIdRef = useRef(id);
  routeDeckIdRef.current = id;

  useEffect(() => {
    setExistingFacts([]);
    setDirtyFactIds(new Set());
    setSelectedExistingFactIds(new Set());
    setExistingFactsError("");
    setExistingSaveError("");
    setExistingSaveSuccess("");
  }, [id]);

  const previewTotal = rows.length;
  const previewTotalPages = Math.max(1, Math.ceil(previewTotal / PREVIEW_PAGE_SIZE));
  const previewStart = (previewPage - 1) * PREVIEW_PAGE_SIZE;
  const paginatedRows = rows.slice(previewStart, previewStart + PREVIEW_PAGE_SIZE);

  const duplicateRowIds = useMemo(() => duplicatePreviewRowIds(rows), [rows]);

  const zipMediaFileCount = useMemo(
    () => new Set(mediaPaths.map((p) => normalizeZipPath(p))).size,
    [mediaPaths]
  );

  const existingColCount = useMemo(
    () => existingFactsColumnCount(deckFields, existingFacts),
    [deckFields, existingFacts]
  );
  const serverColumnHeaderLabels = useMemo(
    () => existingFactsHeaderLabels(existingColCount, deckFields),
    [existingColCount, deckFields]
  );
  const columnLabelsDirty = useMemo(
    () =>
      editableColumnNames.length !== serverColumnHeaderLabels.length ||
      editableColumnNames.some((s, i) => s !== serverColumnHeaderLabels[i]),
    [editableColumnNames, serverColumnHeaderLabels]
  );
  const minColCountForSpreadsheet = useMemo(() => minSpreadsheetColumnCount(deckFields), [deckFields]);
  const existingTotal = existingFacts.length;
  const existingTotalPages = Math.max(1, Math.ceil(existingTotal / PREVIEW_PAGE_SIZE));
  const existingStart = (existingFactsPage - 1) * PREVIEW_PAGE_SIZE;
  const paginatedExisting = existingFacts.slice(existingStart, existingStart + PREVIEW_PAGE_SIZE);

  useEffect(() => {
    setPreviewPage((p) => Math.min(p, previewTotalPages));
  }, [previewTotalPages]);

  useEffect(() => {
    setExistingFactsPage((p) => Math.min(p, existingTotalPages));
  }, [existingTotalPages]);

  useEffect(() => {
    setEditableColumnNames((prev) => {
      if (prev.length > existingColCount) return prev.slice(0, existingColCount);
      if (prev.length >= existingColCount) return prev;
      const pad = existingFactsHeaderLabels(existingColCount, deckFields);
      if (prev.length === 0) return pad;
      return [...prev, ...pad.slice(prev.length)];
    });
  }, [existingColCount, deckFields]);

  const loadDeckAndFacts = useCallback(async (): Promise<FactItem[]> => {
    if (!token || !id) return [];
    const targetDeckId = id;
    let facts: FactItem[] = [];
    setLoadingDeck(true);
    setLoadingExistingFacts(true);
    setExistingFactsError("");
    try {
      const deckRes = await request<GetDeckRes>(`/api/decks/${id}`, { token });
      if (routeDeckIdRef.current !== targetDeckId) return [];
      setDeckName(deckRes.data.name);
      setDeckFields(deckRes.data.field ?? []);
    } catch {
      if (routeDeckIdRef.current !== targetDeckId) return [];
      setDeckName("");
      setDeckFields([]);
    } finally {
      if (routeDeckIdRef.current === targetDeckId) setLoadingDeck(false);
    }
    try {
      const factsRes = await request<GetFactsRes>(`/api/decks/${id}/facts`, { token });
      if (routeDeckIdRef.current !== targetDeckId) return [];
      facts = factsRes.data.facts;
      setExistingFacts((prev) => mergeFactListsPreservingPriorOrder(prev, facts));
      setDirtyFactIds(new Set());
      setSelectedExistingFactIds(new Set());
      setExistingSaveError("");
      setExistingSaveSuccess("");
    } catch (e) {
      if (routeDeckIdRef.current !== targetDeckId) return [];
      facts = [];
      setExistingFacts([]);
      setDirtyFactIds(new Set());
      setSelectedExistingFactIds(new Set());
      setExistingFactsError(e instanceof Error ? e.message : "Failed to load facts.");
    } finally {
      if (routeDeckIdRef.current === targetDeckId) setLoadingExistingFacts(false);
    }
    return facts;
  }, [id, token]);

  async function saveEditableColumnLabels() {
    if (!token || !id) return;
    const dfLen = deckFields.length;
    // PATCH /api/decks/{id}: non-empty name; fields length must match existing schema, or first-time ≥2 when deck has no fields.
    let outLen: number;
    if (dfLen >= 1) {
      outLen = dfLen;
    } else if (existingColCount >= 2) {
      outLen = existingColCount;
    } else {
      setExistingSaveError(
        "This deck has no fields yet. Add at least two columns (Add column) or define fields on Edit deck, then save names here."
      );
      return;
    }
    const out = Array.from({ length: outLen }, (_, i) => editableColumnNames[i] ?? "");
    setExistingSaveError("");
    setExistingSaveSuccess("");
    setSavingColumnLabels(true);
    try {
      const body: UpdateDeckReq = { name: (deckName ?? "").trim() || "Deck", fields: out };
      await request<UpdateDeckRes>(`/api/decks/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setExistingSaveSuccess("Column names saved.");
      await loadDeckAndFacts();
    } catch (e) {
      setExistingSaveError(e instanceof Error ? e.message : "Failed to save column names.");
    } finally {
      setSavingColumnLabels(false);
    }
  }

  async function appendExistingFactRow() {
    if (!token || !id) return;
    if (existingColCount < 1) {
      setExistingSaveError("Add fields to the deck first (deck page → Edit deck).");
      return;
    }
    setExistingSaveError("");
    setExistingSaveSuccess("");
    setAddingExistingFactRow(true);
    try {
      const entries: Entry[] = Array.from({ length: existingColCount }, (_, i) =>
        i === 0 ? { text: "New fact" } : {}
      );
      const body: AddFactReq = {
        facts: [{ entries }],
        ...buildTemplateForRequest(existingColCount, 1, false),
      };
      await request<AddFactRes>(`/api/decks/${id}/facts/append`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setExistingSaveSuccess("Fact added.");
      await loadDeckAndFacts();
    } catch (e) {
      setExistingSaveError(e instanceof Error ? e.message : "Failed to add fact.");
    } finally {
      setAddingExistingFactRow(false);
    }
  }

  useEffect(() => {
    void loadDeckAndFacts();
  }, [loadDeckAndFacts]);

  useEffect(() => {
    if (!token) return;
    const ids = new Set<string>();
    for (const f of existingFacts) {
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
  }, [existingFacts, token]);

  useEffect(() => {
    if (csvRawRows.length === 0) {
      setRows([]);
      setImportDedupeStats(null);
      return;
    }
    const columnCount = columns.length;
    if (columnCount < 1) return;
    const { kept, skippedAlreadyInDeck, skippedDuplicateInCsv } = filterDuplicateImportRows(
      csvRawRows,
      existingFacts,
      columnCount
    );
    startTransition(() => {
      setRows(withRenumberedRows(kept));
      setImportDedupeStats({ skippedAlreadyInDeck, skippedDuplicateInCsv });
    });
  }, [existingFacts, csvRawRows, columns.length]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function updateExistingFactCell(factId: string, entryIndex: number, text: string) {
    setExistingFacts((prev) =>
      prev.map((f) => (f.id === factId ? updateFactEntryText(f, entryIndex, text) : f))
    );
    setDirtyFactIds((d) => new Set(d).add(factId));
    setExistingSaveSuccess("");
  }

  function addColumnToAllExistingFacts() {
    setExistingFacts((prev) => {
      if (prev.length === 0) return prev;
      setDirtyFactIds(new Set(prev.map((f) => f.id)));
      return appendEmptyEntryColumnToAllFacts(prev);
    });
    setExistingSaveSuccess("");
    setExistingSaveError("");
  }

  function removeLastColumnFromAllExistingFacts() {
    if (!confirm("Remove the rightmost column from every fact? Data in that column is discarded until you save.")) {
      return;
    }
    setExistingFacts((prev) => {
      const wide = existingFactsColumnCount(deckFields, prev);
      const minC = minSpreadsheetColumnCount(deckFields);
      if (wide <= minC) return prev;
      setDirtyFactIds(new Set(prev.map((f) => f.id)));
      return trimAllFactsToEntryCount(prev, wide - 1);
    });
    setExistingSaveSuccess("");
    setExistingSaveError("");
  }

  function openExistingMediaPicker(target: {
    factId: string;
    entryIndex: number;
    replaceSlot?: "audio" | "image" | "video" | "json";
  }) {
    pendingExistingMediaPickRef.current = target;
    existingMediaFileInputRef.current?.click();
  }

  function clearExistingFactMediaSlot(
    factId: string,
    entryIndex: number,
    slot: "audio" | "image" | "video" | "json"
  ) {
    setExistingFacts((prev) =>
      prev.map((f) => (f.id === factId ? clearEntryMediaSlot(f, entryIndex, slot) : f))
    );
    setDirtyFactIds((d) => new Set(d).add(factId));
    setExistingSaveSuccess("");
  }

  function removeExistingFactCell(factId: string, entryIndex: number) {
    setExistingFacts((prev) =>
      prev.map((f) => (f.id === factId ? removeFactEntryAt(f, entryIndex) : f))
    );
    setDirtyFactIds((d) => new Set(d).add(factId));
    setExistingSaveSuccess("");
    setExistingSaveError("");
  }

  function insertExistingFactCellAfter(factId: string, entryIndex: number) {
    setExistingFacts((prev) =>
      prev.map((f) => (f.id === factId ? insertEmptyEntryAfter(f, entryIndex) : f))
    );
    setDirtyFactIds((d) => new Set(d).add(factId));
    setExistingSaveSuccess("");
    setExistingSaveError("");
  }

  async function handleExistingMediaFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = pendingExistingMediaPickRef.current;
    pendingExistingMediaPickRef.current = null;
    if (!file || !token || !target) return;

    if (target.replaceSlot) {
      const ok =
        (target.replaceSlot === "image" && file.type.startsWith("image/")) ||
        (target.replaceSlot === "video" && file.type.startsWith("video/")) ||
        (target.replaceSlot === "audio" &&
          (file.type.startsWith("audio/") || file.type === "application/ogg")) ||
        (target.replaceSlot === "json" && fileLooksLikeJson(file));
      if (!ok) {
        setExistingSaveError(`Please choose a ${target.replaceSlot} file for this slot.`);
        return;
      }
    } else {
      const slotFromMime = mediaSlotForFile(file);
      if (!slotFromMime) {
        setExistingSaveError("Unsupported file type. Use an image, audio, video, or JSON file.");
        return;
      }
    }

    const uploadKey = `${target.factId}-${target.entryIndex}`;
    setExistingMediaUploadingKey(uploadKey);
    setExistingSaveError("");
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

      setExistingFacts((prev) =>
        prev.map((f) =>
          f.id === target.factId ? mergeEntryMediaPatch(f, target.entryIndex, patch) : f
        )
      );
      setDirtyFactIds((d) => new Set(d).add(target.factId));
      setExistingSaveSuccess("");
      mediaFilenameByIdRef.current.set(newId, filename);
      setMediaFilenameById(new Map(mediaFilenameByIdRef.current));
    } catch (err) {
      setExistingSaveError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setExistingMediaUploadingKey(null);
    }
  }

  async function saveExistingFactRow(factId: string) {
    if (!token || !id) return;
    const fact = existingFacts.find((f) => f.id === factId);
    if (!fact) return;
    if (!factHasSomeContent(fact.entries)) {
      setExistingSaveError("Each fact needs at least one field with text or attached media.");
      return;
    }
    setExistingSaveError("");
    setExistingSaveSuccess("");
    setSavingFactId(factId);
    try {
      const body: UpdateFactReq = { entries: fact.entries };
      await request<unknown>(`/api/decks/${id}/facts/${factId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setDirtyFactIds((d) => {
        const next = new Set(d);
        next.delete(factId);
        return next;
      });
      setExistingSaveSuccess("Fact saved.");
    } catch (e) {
      setExistingSaveError(e instanceof Error ? e.message : "Failed to save fact.");
    } finally {
      setSavingFactId(null);
    }
  }

  function toggleExistingFactSelected(factId: string) {
    setSelectedExistingFactIds((prev) => {
      const next = new Set(prev);
      if (next.has(factId)) next.delete(factId);
      else next.add(factId);
      return next;
    });
  }

  function toggleSelectAllExistingOnPage() {
    const idsOnPage = paginatedExisting.map((f) => f.id);
    const allOnPageSelected =
      idsOnPage.length > 0 && idsOnPage.every((fid) => selectedExistingFactIds.has(fid));
    setSelectedExistingFactIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const fid of idsOnPage) next.delete(fid);
      } else {
        for (const fid of idsOnPage) next.add(fid);
      }
      return next;
    });
  }

  async function deleteOneExistingFactRow(factId: string) {
    if (!token || !id) return;
    if (!confirm("Remove this fact from the deck? This cannot be undone.")) return;
    setExistingSaveError("");
    setExistingSaveSuccess("");
    setDeletingExistingFactId(factId);
    try {
      await request<unknown>(`/api/decks/${id}/facts/${factId}`, { method: "DELETE", token });
      setDirtyFactIds((d) => {
        const next = new Set(d);
        next.delete(factId);
        return next;
      });
      setSelectedExistingFactIds((prev) => {
        const next = new Set(prev);
        next.delete(factId);
        return next;
      });
      await loadDeckAndFacts();
      setExistingSaveSuccess("Fact removed.");
    } catch (e) {
      setExistingSaveError(e instanceof Error ? e.message : "Failed to delete fact.");
      await loadDeckAndFacts();
    } finally {
      setDeletingExistingFactId(null);
    }
  }

  async function deleteSelectedExistingFacts() {
    if (!token || !id) return;
    const ids = [...selectedExistingFactIds];
    if (ids.length === 0) return;
    if (!confirm(`Remove ${ids.length} fact(s) from this deck? This cannot be undone.`)) return;
    setExistingSaveError("");
    setExistingSaveSuccess("");
    setBulkDeletingExisting(true);
    try {
      for (const factId of ids) {
        await request<unknown>(`/api/decks/${id}/facts/${factId}`, { method: "DELETE", token });
      }
      setDirtyFactIds((d) => {
        const next = new Set(d);
        for (const fid of ids) next.delete(fid);
        return next;
      });
      await loadDeckAndFacts();
      setExistingSaveSuccess(`${ids.length} fact(s) removed from the deck.`);
    } catch (e) {
      setExistingSaveError(e instanceof Error ? e.message : "Failed to delete fact(s).");
      await loadDeckAndFacts();
    } finally {
      setBulkDeletingExisting(false);
    }
  }

  const allExistingPageSelected =
    paginatedExisting.length > 0 &&
    paginatedExisting.every((f) => selectedExistingFactIds.has(f.id));
  const someExistingPageSelected = paginatedExisting.some((f) => selectedExistingFactIds.has(f.id));
  const existingFactsBusy =
    bulkDeletingExisting ||
    deletingExistingFactId !== null ||
    savingFactId !== null ||
    existingMediaUploadingKey !== null ||
    savingColumnLabels ||
    addingExistingFactRow;

  useEffect(() => {
    const el = selectAllExistingCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someExistingPageSelected && !allExistingPageSelected;
  }, [someExistingPageSelected, allExistingPageSelected, paginatedExisting]);

  async function parseZipForPreview(file: File, factsForFilter: FactItem[]) {
    setParsing(true);
    setParseProgress(5);
    setError("");
    setSuccess("");
    try {
      const zip = await (async () => {
        const creepZip = window.setInterval(() => {
          setParseProgress((p) => (p < 20 ? p + 1 : p));
        }, 40);
        try {
          return await JSZip.loadAsync(file);
        } finally {
          clearInterval(creepZip);
        }
      })();
      setParseProgress(22);
      await nextMacrotask();
      const allFiles = Object.values(zip.files).filter((entry) => !entry.dir);
      const csvFiles = allFiles.filter((entry) => {
        const n = normalizeZipPath(entry.name);
        if (bulkImportZipPathSkippable(n)) return false;
        const depth = n.split("/").filter(Boolean).length;
        return depth === 1 && n.toLowerCase().endsWith(".csv");
      });
      if (csvFiles.length !== 1) {
        throw new Error("ZIP must contain exactly one CSV at the archive root.");
      }
      setParseProgress(32);
      await nextMacrotask();
      const mediaFiles = allFiles.filter((entry) => bulkImportZipEntryIsMedia(entry.name));
      const csvText = await (async () => {
        const creepCsv = window.setInterval(() => {
          setParseProgress((p) => (p < 46 ? p + 1 : p));
        }, 35);
        try {
          return await csvFiles[0].async("text");
        } finally {
          clearInterval(creepCsv);
        }
      })();
      setParseProgress(48);
      await nextMacrotask();
      const { rows: parsed, delimiter } = await parseCsvTextAsync(csvText);
      if (parsed.length === 0) throw new Error("CSV is empty.");

      let startRow = 0;
      if (parsed.length > 1 && parsed[0].every((cell) => cell.trim() !== "")) {
        startRow = 1;
      }
      const maxCols = parsed.reduce((m, row) => Math.max(m, row.length), 0);
      const header = startRow === 1
        ? Array.from({ length: maxCols }, (_, i) => parsed[0][i] ?? "")
        : Array.from({ length: maxCols }, (_, i) => "");

      const paths = listBulkImportMediaPaths(mediaFiles.map((m) => m.name));

      const previewRows: PreviewRow[] = [];
      let displayIndex = 0;
      const lineTotal = Math.max(1, parsed.length - startRow);
      /** ~50 paint steps max while scanning rows so the bar moves without one macrotask per line. */
      const rowScanUpdateEvery = Math.max(1, Math.ceil(lineTotal / 50));
      for (let i = startRow; i < parsed.length; i += 1) {
        const row = parsed[i];
        if (!rowHasAtLeastOneColumn(row)) {
          throw new Error("The CSV contains a row with no columns.");
        }
        if (!rowHasNonEmptyCell(row)) continue;
        const values = Array.from({ length: maxCols }, (_, c) => row[c] ?? "");
        displayIndex += 1;
        previewRows.push({
          id: `ir-${i}`,
          index: displayIndex,
          values,
        });
        const lineDone = i - startRow + 1;
        if (
          lineDone % rowScanUpdateEvery === 0 ||
          lineDone === lineTotal ||
          lineDone % PREVIEW_ROW_BUILD_YIELD_EVERY === 0
        ) {
          setParseProgress(48 + Math.min(22, Math.floor((lineDone / lineTotal) * 22)));
          await nextMacrotask();
        }
      }
      if (previewRows.length === 0) {
        throw new Error(
          "No valid data rows found. Each row needs at least one column and at least one non-empty cell."
        );
      }
      setParseProgress(72);
      await nextMacrotask();
      const { kept } = filterDuplicateImportRows(previewRows, factsForFilter, maxCols);
      if (kept.length === 0) {
        throw new Error(
          "Every row in this CSV matches a fact already in this deck or duplicates another row in the file."
        );
      }
      setParseProgress(92);
      await nextMacrotask();
      startTransition(() => {
        setCsvPathInZip(normalizeZipPath(csvFiles[0].name));
        setCsvDelimiter(delimiter);
        setIncludeHeaderRow(startRow === 1);
        setMediaPaths(paths);
        setColumns(header);
        setCsvRawRows(previewRows);
        setPreviewConfirmed(false);
        setSelectedRowIds(new Set());
        setPreviewPage(1);
      });
      setParseProgress(100);
      await nextMacrotask();
    } catch (e) {
      setColumns([]);
      setCsvRawRows([]);
      setRows([]);
      setImportDedupeStats(null);
      setMediaPaths([]);
      setCsvPathInZip("facts.csv");
      setCsvDelimiter(",");
      setIncludeHeaderRow(false);
      setPreviewConfirmed(false);
      setSelectedRowIds(new Set());
      setPreviewPage(1);
      setError(e instanceof Error ? e.message : "Failed to parse ZIP.");
    } finally {
      setParsing(false);
      setParseProgress(0);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    setZipFile(null);
    setCsvRawRows([]);
    setRows([]);
    setImportDedupeStats(null);
    setColumns([]);
    setMediaPaths([]);
    setCsvPathInZip("facts.csv");
    setCsvDelimiter(",");
    setIncludeHeaderRow(false);
    setPreviewConfirmed(false);
    setSelectedRowIds(new Set());
    setPreviewPage(1);
    setError("");
    setSuccess("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Please select a .zip file.");
      return;
    }
    if (file.size > MAX_ZIP_SIZE_BYTES) {
      setError("ZIP is too large. Max size is 500 MB.");
      return;
    }
    setZipFile(file);
    void (async () => {
      const facts = await loadDeckAndFacts();
      await parseZipForPreview(file, facts);
    })();
  }

  function updateCell(rowId: string, colIdx: number, value: string) {
    setCsvRawRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const nextValues = columns.map((_, i) => (i === colIdx ? value : r.values[i] ?? ""));
        return {
          ...r,
          values: nextValues,
        };
      })
    );
    setPreviewConfirmed(false);
  }

  function deleteAllRows() {
    if (rows.length === 0) return;
    if (!confirm(`Remove all ${rows.length} row(s) from the preview? You can re-select the ZIP to restore.`)) return;
    setCsvRawRows([]);
    setSelectedRowIds(new Set());
    setPreviewConfirmed(false);
    setPreviewPage(1);
  }

  function toggleRowSelected(rowId: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
    setPreviewConfirmed(false);
  }

  function toggleSelectAllRows() {
    const allSelected = rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id));
    setSelectedRowIds(() => {
      if (allSelected) return new Set();
      return new Set(rows.map((r) => r.id));
    });
    setPreviewConfirmed(false);
  }

  function deleteSelectedRows() {
    const n = selectedRowIds.size;
    if (n === 0) return;
    if (!confirm(`Remove ${n} selected row(s) from the preview?`)) return;
    setCsvRawRows((prev) =>
      withRenumberedRows(prev.filter((r) => !selectedRowIds.has(r.id)))
    );
    setSelectedRowIds(new Set());
    setPreviewConfirmed(false);
  }

  const allRowsSelected = rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id));
  const someRowsSelected = rows.some((r) => selectedRowIds.has(r.id));

  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someRowsSelected && !allRowsSelected;
  }, [someRowsSelected, allRowsSelected, rows]);

  async function buildImportZipBlob(): Promise<Blob> {
    if (!zipFile) throw new Error("No ZIP file");
    const zip = await JSZip.loadAsync(zipFile);
    const out = new JSZip();
    const normToZipKey = new Map<string, string>();
    for (const path of Object.keys(zip.files)) {
      const entry = zip.files[path];
      if (entry.dir) continue;
      if (bulkImportZipEntryIsMedia(path)) {
        normToZipKey.set(normalizeZipPath(path), path);
      }
    }
    for (const norm of mediaPaths) {
      const n = normalizeZipPath(norm);
      const zipKey = normToZipKey.get(n);
      if (!zipKey) continue;
      const entry = zip.files[zipKey];
      out.file(n, await entry.async("uint8array"));
    }
    const delim = csvDelimiter;
    const lines: string[] = [];
    if (includeHeaderRow) {
      lines.push(columns.map((c) => escapeCsvField(c, delim)).join(delim));
    }
    for (const row of rows) {
      lines.push(columns.map((_, i) => escapeCsvField(row.values[i] ?? "", delim)).join(delim));
    }
    const csvBody = lines.join("\r\n");
    out.file(normalizeZipPath(csvPathInZip), csvBody);
    // STORE (no DEFLATE): some Go archive/zip builds reject JSZip's default DEFLATE bitstreams (400 "not a valid ZIP").
    return out.generateAsync({ type: "blob", compression: "STORE" });
  }

  async function handleSubmit() {
    if (!token || !id || !zipFile || rows.length === 0) return;
    for (const row of rows) {
      if (!rowHasAtLeastOneColumn(row.values)) {
        setError("Each row needs at least one column.");
        return;
      }
      if (!rowHasNonEmptyCell(row.values)) {
        setError("Each row needs at least one non-empty cell (empty columns are allowed).");
        return;
      }
    }
    setSubmitting(true);
    setSubmitStage("building");
    setSubmitUploadProgress(0);
    setError("");
    setSuccess("");
    try {
      const blob = await buildImportZipBlob();
      const editedZip = new File([blob], "bulk-import.zip", { type: "application/zip" });
      const form = new FormData();
      form.append("file", editedZip);
      setSubmitStage("uploading");
      setSubmitUploadProgress(0);
      const res = (await uploadMultipartWithProgress(
        `/api/decks/${id}/facts/bulk-import`,
        form,
        token,
        undefined,
        BULK_IMPORT_UPLOAD_TIMEOUT_MS,
        (pct) => setSubmitUploadProgress(pct)
      )) as BulkImportRes;
      const added = res?.data?.facts_added ?? 0;
      const uploaded = res?.data?.media_uploaded ?? 0;
      setSuccess(`Bulk import completed: ${added} facts added, ${uploaded} media uploaded.`);
      setPreviewConfirmed(false);
      void loadDeckAndFacts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bulk import failed.";
      console.error("[bulk-import]", {
        message: msg,
        deckId: id,
        apiBaseUrl: getApiBaseUrl(),
        path: `/api/decks/${id}/facts/bulk-import`,
      });
      console.error("[bulk-import] cause", e);
      setError(msg);
    } finally {
      setSubmitting(false);
      setSubmitStage("idle");
      setSubmitUploadProgress(0);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Bulk upload {deckName ? `- ${deckName}` : ""}</h1>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/decks">Deck</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to={`/decks/${id}`}>Back to deck</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/profile">Profile</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
          </nav>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload zip</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingDeck && <p className="text-sm text-muted-foreground">Loading deck…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={handleFileChange}
              disabled={parsing || submitting}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <p className="text-xs text-muted-foreground">
              expected zip: one csv at the root and optional flat <code>audio/</code>, <code>image/</code>, <code>video/</code>, <code>json/</code> folders (max 500&nbsp;MB). use <code>row_column.ext</code> names (ankifacts <code>-M</code>) or exact cell text as the file stem for legacy matching.
            </p>
            <p className="text-xs text-muted-foreground max-w-xl">
              when the preview appears below, review and edit rows if needed, confirm, then use <strong>submit import</strong>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview table</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-sm font-medium">Facts already in this deck</h2>
                  {!loadingExistingFacts && existingTotal > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {existingTotal} fact{existingTotal === 1 ? "" : "s"} — use Add column for an extra entry on every
                      row, then Save. Save column names updates deck fields only; extra columns are per-fact.
                    </span>
                  )}
                </div>
                {!loadingExistingFacts && !existingFactsError && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={existingFactsBusy}
                      onClick={() => void appendExistingFactRow()}
                    >
                      {addingExistingFactRow ? "Adding…" : "Add row"}
                    </Button>
                    {existingTotal > 0 && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={existingFactsBusy}
                          onClick={addColumnToAllExistingFacts}
                          title="Append one empty cell at the end of every fact"
                        >
                          Add column
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/50 hover:bg-destructive/10"
                          disabled={
                            existingFactsBusy || existingColCount <= minColCountForSpreadsheet
                          }
                          onClick={removeLastColumnFromAllExistingFacts}
                          title="Remove the rightmost column from every fact (cannot go below deck width)"
                        >
                          Delete column
                        </Button>
                      </>
                    )}
                    {(deckFields.length >= 1 || existingColCount >= 2) && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={!columnLabelsDirty || existingFactsBusy}
                        onClick={() => void saveEditableColumnLabels()}
                      >
                        {savingColumnLabels ? "Saving…" : "Save column names"}
                      </Button>
                    )}
                    {existingTotal > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        disabled={selectedExistingFactIds.size === 0 || existingFactsBusy}
                        onClick={() => void deleteSelectedExistingFacts()}
                      >
                        Delete selected ({selectedExistingFactIds.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {existingSaveError && <p className="text-sm text-destructive">{existingSaveError}</p>}
              {existingSaveSuccess && <p className="text-sm text-green-600">{existingSaveSuccess}</p>}
              {loadingExistingFacts && <p className="text-sm text-muted-foreground">Loading facts…</p>}
              {existingFactsError && <p className="text-sm text-destructive">{existingFactsError}</p>}
              {!loadingExistingFacts && !existingFactsError && existingTotal === 0 && (
                <p className="text-sm text-muted-foreground">
                  No facts in this deck yet. Use Add row to create one, or import a ZIP below. Extra deck fields
                  (columns) are added from the deck page → Edit deck.
                </p>
              )}
              {existingTotal > 0 && (
                <>
                  <input
                    ref={existingMediaFileInputRef}
                    type="file"
                    className="sr-only"
                    accept="image/*,audio/*,video/*,application/json,.json"
                    aria-hidden="true"
                    tabIndex={-1}
                    onChange={(e) => void handleExistingMediaFileChange(e)}
                  />
                  <div className="overflow-x-auto rounded-md border bg-muted/10">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-2 py-2 w-10 text-center align-bottom" scope="col">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
                                Remove
                              </span>
                              <input
                                ref={selectAllExistingCheckboxRef}
                                type="checkbox"
                                checked={allExistingPageSelected}
                                onChange={toggleSelectAllExistingOnPage}
                                className="h-4 w-4 rounded border border-input"
                                disabled={existingFactsBusy}
                                aria-label="Select all facts on this page for removal"
                                title="Select all on this page"
                              />
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left font-medium w-12">#</th>
                          {Array.from({ length: existingColCount }, (_, idx) => (
                            <th key={`ex-h-${idx}`} className="min-w-[7rem] px-2 py-2 text-left">
                              <Input
                                value={editableColumnNames[idx] ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditableColumnNames((prev) => {
                                    const next = [...prev];
                                    while (next.length <= idx) next.push("");
                                    next[idx] = v;
                                    return next;
                                  });
                                }}
                                className="h-8 min-w-0 text-xs font-medium"
                                aria-label={`Column ${idx + 1} name`}
                                disabled={existingFactsBusy}
                              />
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-medium w-28"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedExisting.map((fact, i) => (
                          <tr key={fact.id} className="border-b last:border-0 align-top">
                            <td className="px-2 py-2 text-center align-middle">
                              <input
                                type="checkbox"
                                checked={selectedExistingFactIds.has(fact.id)}
                                onChange={() => toggleExistingFactSelected(fact.id)}
                                className="h-4 w-4 rounded border border-input"
                                disabled={existingFactsBusy}
                                aria-label={`Select row ${existingStart + i + 1} for removal from deck`}
                              />
                            </td>
                            <td className="px-3 py-2 text-muted-foreground tabular-nums">{existingStart + i + 1}</td>
                            {Array.from({ length: existingColCount }, (_, idx) => {
                              const ent = factEntryAt(fact, idx);
                              const mediaUploading =
                                existingMediaUploadingKey === `${fact.id}-${idx}`;
                              const slotLabel: Record<"audio" | "image" | "video" | "json", string> = {
                                audio: "Audio",
                                image: "Image",
                                video: "Video",
                                json: "JSON",
                              };
                              const entryMediaFull =
                                Boolean(ent.audio) &&
                                Boolean(ent.image) &&
                                Boolean(ent.video) &&
                                Boolean(ent.json);
                              return (
                                <td key={`${fact.id}-c${idx}`} className="px-3 py-2 max-w-[20rem]">
                                  <div className="flex items-start gap-1.5">
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                      <Input
                                        value={ent.text ?? ""}
                                        onChange={(e) => updateExistingFactCell(fact.id, idx, e.target.value)}
                                        className="h-9 min-w-[6rem]"
                                        aria-label={`${editableColumnNames[idx] ?? `Column ${idx + 1}`}, row ${existingStart + i + 1}`}
                                        disabled={existingFactsBusy}
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
                                              {slotLabel[slot]}
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
                                                  aria-label={`Remove ${slotLabel[slot]}`}
                                                  title={`Remove ${slotLabel[slot]}`}
                                                  disabled={existingFactsBusy}
                                                  onClick={() =>
                                                    clearExistingFactMediaSlot(fact.id, idx, slot)
                                                  }
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
                                          disabled={existingFactsBusy}
                                          onClick={() =>
                                            openExistingMediaPicker({
                                              factId: fact.id,
                                              entryIndex: idx,
                                            })
                                          }
                                        >
                                          Add media…
                                        </DropdownMenuItem>
                                      ) : null}
                                      <DropdownMenuItem
                                        disabled={existingFactsBusy}
                                        onClick={() => insertExistingFactCellAfter(fact.id, idx)}
                                        title="Insert an empty cell to the right of this column on this row"
                                      >
                                        Add cell
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        variant="destructive"
                                        disabled={
                                          existingFactsBusy ||
                                          fact.entries.length <= 1 ||
                                          idx >= fact.entries.length
                                        }
                                        onClick={() => removeExistingFactCell(fact.id, idx)}
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
                                  disabled={!dirtyFactIds.has(fact.id) || existingFactsBusy}
                                  onClick={() => void saveExistingFactRow(fact.id)}
                                >
                                  {savingFactId === fact.id ? "Saving…" : "Save"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                                  disabled={existingFactsBusy}
                                  onClick={() => void deleteOneExistingFactRow(fact.id)}
                                >
                                  {deletingExistingFactId === fact.id ? "Removing…" : "Delete row"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {existingTotal > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        Showing {existingStart + 1}–{Math.min(existingStart + PREVIEW_PAGE_SIZE, existingTotal)} of{" "}
                        {existingTotal} rows · {PREVIEW_PAGE_SIZE} per page
                      </p>
                      {existingTotalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setExistingFactsPage((p) => Math.max(1, p - 1))}
                            disabled={existingFactsPage <= 1}
                          >
                            Previous
                          </Button>
                          <span className="px-2 text-sm text-muted-foreground tabular-nums">
                            page {existingFactsPage} of {existingTotalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setExistingFactsPage((p) => Math.min(existingTotalPages, p + 1))}
                            disabled={existingFactsPage >= existingTotalPages}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="space-y-3 border-t pt-6">
              <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium">From your zip (import preview)</h2>
                {rows.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      disabled={selectedRowIds.size === 0}
                      onClick={deleteSelectedRows}
                      title="Remove checked rows from this import preview only"
                    >
                      Delete selected rows ({selectedRowIds.size})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      onClick={deleteAllRows}
                    >
                      Delete all rows
                    </Button>
                  </div>
                )}
              </div>
            {parsing ? (
              <div
                className="rounded-lg border border-border bg-muted/50 p-4 dark:bg-muted/40"
                role="status"
                aria-live="polite"
                aria-busy="true"
                aria-label="Parsing zip file"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Parsing zip…</p>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {parseProgress}%
                  </span>
                </div>
                <div
                  className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={parseProgress}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                    style={{ width: `${parseProgress}%` }}
                  />
                </div>
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Select a zip file to preview import rows.</p>
            ) : (
              <div className="space-y-6">
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm tabular-nums"
                >
                  <p className="font-medium text-foreground">Import summary</p>
                  <p className="mt-1.5 text-muted-foreground">
                    <span className="font-semibold text-foreground">{rows.length.toLocaleString()}</span>{" "}
                    row{rows.length === 1 ? "" : "s"} ·{" "}
                    <span className="font-semibold text-foreground">{zipMediaFileCount.toLocaleString()}</span>{" "}
                    media file{zipMediaFileCount === 1 ? "" : "s"}
                  </p>
                </div>
                {importDedupeStats &&
                  (importDedupeStats.skippedAlreadyInDeck > 0 ||
                    importDedupeStats.skippedDuplicateInCsv > 0) && (
                  <div
                    role="status"
                    className="rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-sm text-sky-950 dark:border-sky-500/25 dark:bg-sky-950/35 dark:text-sky-100"
                  >
                    <span className="font-medium">filtered from your csv: </span>
                    {importDedupeStats.skippedAlreadyInDeck > 0 && (
                      <>
                        {importDedupeStats.skippedAlreadyInDeck} row
                        {importDedupeStats.skippedAlreadyInDeck === 1 ? "" : "s"} already match a fact in this deck
                      </>
                    )}
                    {importDedupeStats.skippedAlreadyInDeck > 0 &&
                      importDedupeStats.skippedDuplicateInCsv > 0 &&
                      "; "}
                    {importDedupeStats.skippedDuplicateInCsv > 0 && (
                      <>
                        {importDedupeStats.skippedDuplicateInCsv} duplicate row
                        {importDedupeStats.skippedDuplicateInCsv === 1 ? "" : "s"} in the file (only the first of each identical row is shown)
                      </>
                    )}
                    .
                  </div>
                )}
                {duplicateRowIds.size > 0 && (
                  <div
                    role="status"
                    className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
                  >
                    <span className="font-medium">duplicate rows: </span>
                    {duplicateRowIds.size} row{duplicateRowIds.size === 1 ? "" : "s"} match another row exactly (same text in every column). They are highlighted below;
                    remove or edit extras if you did not intend to import the same fact more than once.
                  </div>
                )}
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-2 py-2 w-10 text-center align-bottom" scope="col">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
                              Remove
                            </span>
                            <input
                              ref={selectAllCheckboxRef}
                              type="checkbox"
                              checked={allRowsSelected}
                              onChange={toggleSelectAllRows}
                              className="h-4 w-4 rounded border border-input"
                              aria-label="Select all import rows for removal"
                              title="Select all rows"
                            />
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-medium w-12">#</th>
                        {columns.map((col, idx) => (
                          <th
                            key={`col-header-${idx}`}
                            className="px-3 py-2 text-left font-medium min-w-[12rem]"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-b last:border-0 align-top",
                            duplicateRowIds.has(row.id) &&
                              "bg-amber-500/10 dark:bg-amber-950/35"
                          )}
                          title={
                            duplicateRowIds.has(row.id)
                              ? "Duplicate row — same content as another row in this preview"
                              : undefined
                          }
                        >
                          <td className="px-2 py-2 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={selectedRowIds.has(row.id)}
                              onChange={() => toggleRowSelected(row.id)}
                              className="h-4 w-4 rounded border border-input"
                              aria-label={`Select import row ${row.index} for removal`}
                            />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground tabular-nums">
                            <span className="inline-flex items-center gap-1.5">
                              {row.index}
                              {duplicateRowIds.has(row.id) && (
                                <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-950 dark:text-amber-100">
                                  Dup
                                </span>
                              )}
                            </span>
                          </td>
                          {columns.map((_, idx) => (
                            <td key={`${row.id}-${idx}`} className="px-3 py-2 align-top">
                              <Input
                                value={row.values[idx] ?? ""}
                                onChange={(e) => updateCell(row.id, idx, e.target.value)}
                                className="h-9 min-w-0 w-full min-w-[6rem]"
                                aria-label={`${columns[idx] ?? `Column ${idx + 1}`}, text row ${row.index}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewTotal > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2 bg-muted/20">
                    <p className="text-xs text-muted-foreground">
                      Showing {previewStart + 1}–{Math.min(previewStart + PREVIEW_PAGE_SIZE, previewTotal)} of {previewTotal} rows · {PREVIEW_PAGE_SIZE} per page
                    </p>
                    {previewTotalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                          disabled={previewPage <= 1}
                        >
                          Previous
                        </Button>
                        <span className="px-2 text-sm text-muted-foreground tabular-nums">
                          page {previewPage} of {previewTotalPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                          disabled={previewPage >= previewTotalPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <p className="text-sm font-medium">Ready to import?</p>
                  {error && (
                    <div
                      role="alert"
                      className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    >
                      {error}
                    </div>
                  )}
                  {success && (
                    <div role="status" className="rounded-md border border-green-600/30 bg-green-600/5 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                      {success}
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <input
                      id="bulk-preview-confirm"
                      type="checkbox"
                      checked={previewConfirmed}
                      onChange={(e) => setPreviewConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border border-input"
                      disabled={parsing || submitting}
                    />
                    <Label htmlFor="bulk-preview-confirm" className="font-normal text-sm leading-snug cursor-pointer">
                      I&apos;ve reviewed the preview and I&apos;m ready to add these facts to the deck.
                    </Label>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      size="default"
                      onClick={handleSubmit}
                      disabled={!previewConfirmed || !zipFile || rows.length === 0 || parsing || submitting}
                    >
                      {submitting ? "Submitting…" : "Submit import"}
                    </Button>
                    {!previewConfirmed && rows.length > 0 && (
                      <p className="text-xs text-muted-foreground">Check the box above to enable submit.</p>
                    )}
                  </div>
                  {submitting && (
                    <div
                      className="rounded-lg border border-border bg-muted/50 p-4 dark:bg-muted/40"
                      role="status"
                      aria-live="polite"
                      aria-busy="true"
                      aria-label={
                        submitStage === "building"
                          ? "Preparing import zip"
                          : "Uploading bulk import"
                      }
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          {submitStage === "building" ? "Preparing import ZIP…" : "Uploading to server…"}
                        </p>
                        {submitStage === "uploading" && (
                          <span className="text-xs font-medium tabular-nums text-muted-foreground">
                            {submitUploadProgress}%
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={submitStage === "uploading" ? submitUploadProgress : undefined}
                      >
                        {submitStage === "building" ? (
                          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/70" />
                        ) : (
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                            style={{ width: `${submitUploadProgress}%` }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground max-w-2xl">
                    Submit sends a new ZIP built from this table and only the media files referenced here. Rows that
                    matched a fact already in the deck (same text in every column) or repeated rows in the CSV are not
                    included.
                  </p>
                </div>
              </div>
            )}
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

