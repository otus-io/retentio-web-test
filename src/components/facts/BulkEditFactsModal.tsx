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
  fetchOpenReportFactIds,
  isImportedDeck,
  request,
  fetchAllDeckFacts,
  fetchDeckFactsPage,
  fetchDeckFactsUnpaginated,
  getApiBaseUrl,
  uploadMultipart,
  type AddFactReq,
  type AddFactRes,
  type DeckItem,
  type Entry,
  type FactItem,
  type UpdateDeckReq,
  type UpdateDeckRes,
  type UpdateFactReq,
  type UploadMediaRes,
} from "@/lib/api";
import { fetchAllDeckConfidence } from "@/lib/confidence";
import {
  buildHumanVerifiedEntries,
  deleteFactQuality,
  fetchAllDeckQuality,
  getFactQuality,
  isFactHumanVerified,
  putFactQuality,
  stripHumanVerifiedAspects,
  type FactQuality,
} from "@/lib/quality";
import { AudioPreviewButton, BlobAudioPlayButton } from "@/components/media/AudioPreviewButton";
import { WikiRubyText } from "@/components/text/WikiRubyText";
import {
  loadFixFactSettings,
  saveFixFactSettings,
  type FixFactSettings,
} from "@/lib/fixFactSettings";
import {
  TTS_MODEL_OPTIONS,
  getElevenLabsApiKey,
  getElevenLabsVoiceId,
  synthesizeWithElevenLabs,
} from "@/lib/fixFactTts";
import { FactTagsPicker } from "./FactTagsPicker";

const PAGE_SIZE = 50;
const NO_DECK_FIELDS: string[] = [];
const CUSTOM_MODEL = "__custom__";

type AudioProposal = { factId: string; col: number; blob: Blob };

type EditFactsFilterKind =
  | "all"
  | "missing_media"
  | "open_reports"
  | "quality"
  | "confidence"
  | "not_verified";

function modelSelectValue(current: string, presets: { value: string }[]): string {
  return presets.some((p) => p.value === current) ? current : CUSTOM_MODEL;
}

function collectUserMediaIdsFromFact(fact: FactItem): string[] {
  const out: string[] = [];
  for (const e of fact.entries ?? []) {
    for (const key of ["audio", "image", "video", "json"] as const) {
      const id = (e[key] ?? "").trim();
      if (id && !id.startsWith("shared:")) out.push(id);
    }
  }
  return out;
}

function factReferencesMissingMedia(fact: FactItem, okById: Map<string, boolean>): boolean {
  for (const id of collectUserMediaIdsFromFact(fact)) {
    if (okById.get(id) === false) return true;
  }
  return false;
}

type MediaProbeResult =
  | { status: "ok"; filename: string }
  | { status: "missing" }
  | { status: "error"; httpStatus: number; message?: string };

/** Distinguish 404 (real missing) from transient failures — only 404 may be cached as missing. */
async function probeUserMediaMeta(mediaId: string, token: string): Promise<MediaProbeResult> {
  const url = `${getApiBaseUrl()}/api/media/${encodeURIComponent(mediaId)}/meta`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { data?: { filename?: string } };
      const filename = body.data?.filename?.trim() || mediaId;
      return { status: "ok", filename };
    }
    if (res.status === 404) return { status: "missing" };
    return { status: "error", httpStatus: res.status };
  } catch (e) {
    // Browser network/CORS blips surface as TypeError "Failed to fetch" — not missing media.
    return {
      status: "error",
      httpStatus: 0,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

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
  /** Called after a successful fact PATCH (e.g. record import pending contribution). */
  onFactSaved?: (fact: FactItem) => void;
  onDeleteFact: (factId: string) => void | Promise<void>;
  deleteFactId: string | null;
  setDeleteFactId: (id: string | null) => void;
  /** When set (e.g. from `?fact=`), jump to this fact id after the modal opens. */
  initialFactId?: string | null;
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
  onFactSaved,
  onDeleteFact,
  deleteFactId,
  setDeleteFactId,
  initialFactId = null,
}: BulkEditFactsModalProps) {
  const [localFacts, setLocalFacts] = useState<FactItem[]>([]);
  const [dirtyFactIds, setDirtyFactIds] = useState<Set<string>>(() => new Set());
  const [savingFactId, setSavingFactId] = useState<string | null>(null);
  const [mediaUploadingKey, setMediaUploadingKey] = useState<string | null>(null);
  const [mediaFilenameById, setMediaFilenameById] = useState<Map<string, string>>(() => new Map());
  const mediaFilenameByIdRef = useRef<Map<string, string>>(new Map());
  /** true = meta 200, false = missing/404; absent = not checked yet */
  const [mediaOkById, setMediaOkById] = useState<Map<string, boolean>>(() => new Map());
  const mediaOkByIdRef = useRef<Map<string, boolean>>(new Map());
  const [filterKind, setFilterKind] = useState<EditFactsFilterKind>("all");
  const [filterIdSet, setFilterIdSet] = useState<Set<string> | null>(null);
  const [qualityMaxScore, setQualityMaxScore] = useState(5);
  const [confMaxPGood, setConfMaxPGood] = useState(0.5);
  const [confMinReports, setConfMinReports] = useState(1);
  const [filterScanning, setFilterScanning] = useState(false);
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
  const [factIdQuery, setFactIdQuery] = useState("");
  const [highlightFactId, setHighlightFactId] = useState<string | null>(null);
  const [goingToFact, setGoingToFact] = useState(false);
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);
  const initialFactHandledRef = useRef<string | null>(null);
  const [fixSettings, setFixSettings] = useState<FixFactSettings>(() =>
    loadFixFactSettings(deck.id, Array.isArray(deck.fields) ? deck.fields : NO_DECK_FIELDS)
  );
  const [ttsModelCustom, setTtsModelCustom] = useState(() => {
    const s = loadFixFactSettings(deck.id, Array.isArray(deck.fields) ? deck.fields : NO_DECK_FIELDS);
    return !TTS_MODEL_OPTIONS.some((o) => o.value === s.ttsModel);
  });
  const [regenKey, setRegenKey] = useState<string | null>(null);
  const [audioProposal, setAudioProposal] = useState<AudioProposal | null>(null);
  /** `${factId}-${col}` while a cell textarea is open for raw markup editing. */
  const [editingTextKey, setEditingTextKey] = useState<string | null>(null);
  /** Source-deck editorial quality by fact id (human-verify ✓). */
  const [qualityByFactId, setQualityByFactId] = useState<Map<string, FactQuality>>(() => new Map());
  const [verifyingFactId, setVerifyingFactId] = useState<string | null>(null);
  const [loadingQuality, setLoadingQuality] = useState(false);

  const deckId = deck.id;
  const qualityEnabled = Boolean(token) && !isImportedDeck(deck);
  /** API may omit `field`; treat as [] so column math matches PATCH rules. */
  const deckFieldsSafe = Array.isArray(deck.fields) ? deck.fields : NO_DECK_FIELDS;
  const filterActive = filterKind !== "all";
  const colCount = existingFactsColumnCount(deckFieldsSafe, localFacts);
  const displayFacts = useMemo(() => {
    if (filterKind === "all") return localFacts;
    if (filterKind === "missing_media") {
      return localFacts.filter((f) => factReferencesMissingMedia(f, mediaOkById));
    }
    if (filterKind === "not_verified") {
      return localFacts.filter((f) => !isFactHumanVerified(f, qualityByFactId.get(f.id)));
    }
    if (filterIdSet) return localFacts.filter((f) => filterIdSet.has(f.id));
    return localFacts;
  }, [filterKind, filterIdSet, localFacts, mediaOkById, qualityByFactId]);
  const total = displayFacts.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const apiFactTotal = factsTotalFromApi ?? factsTotal;
  const pageCountTotal = filterActive
    ? totalPages
    : apiFactTotal != null && apiFactTotal > 0
      ? Math.max(Math.ceil(apiFactTotal / PAGE_SIZE), Math.max(1, Math.ceil(localFacts.length / PAGE_SIZE)))
      : Math.max(1, Math.ceil(localFacts.length / PAGE_SIZE));
  const start = (factPage - 1) * PAGE_SIZE;
  const pageRows = displayFacts.slice(start, start + PAGE_SIZE);

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
      initialFactHandledRef.current = null;
      setHighlightFactId(null);
      setFactIdQuery("");
      setGoingToFact(false);
      setFilterKind("all");
      setFilterIdSet(null);
      setFilterScanning(false);
      setAudioProposal(null);
      setEditingTextKey(null);
      setQualityByFactId(new Map());
      setVerifyingFactId(null);
      setLoadingQuality(false);
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
      setHighlightFactId(null);
      const seed = (initialFactId ?? "").trim();
      setFactIdQuery(seed);
      const loaded = loadFixFactSettings(deckId, deckFieldsSafe);
      setFixSettings(loaded);
      setTtsModelCustom(!TTS_MODEL_OPTIONS.some((o) => o.value === loaded.ttsModel));
      setRegenKey(null);
      setAudioProposal(null);
      setEditingTextKey(null);
      setQualityByFactId(new Map());
      setVerifyingFactId(null);
      setFilterKind("all");
      setFilterIdSet(null);
      setFilterScanning(false);
      return;
    }
    setLocalFacts((prev) => mergeParentFirstPagePreservingTail(prev, factsList, dirtyFactIdsRef.current));
  }, [open, factsList, factsHasMore, factsTotal, initialFactId]);

  const goToFactById = useCallback(
    async (rawId?: string) => {
      const id = (rawId ?? factIdQuery).trim();
      if (!id) {
        setSaveError("Enter a fact id.");
        return;
      }
      if (!token) {
        setSaveError("Sign in required.");
        return;
      }
      setSaveError("");
      setSaveSuccess("");
      setGoingToFact(true);
      try {
        let working = localFacts;
        let idx = working.findIndex((f) => f.id === id);
        if (idx < 0) {
          const res = await request<{ data: { fact: FactItem } }>(
            `/api/decks/${encodeURIComponent(deckId)}/facts/${encodeURIComponent(id)}`,
            { token }
          );
          const fact = res.data?.fact;
          if (!fact?.id) throw new Error("Fact not found");
          idx = working.findIndex((f) => f.id === fact.id);
          if (idx < 0) {
            working = [fact, ...working];
            idx = 0;
            setLocalFacts(working);
          }
        }
        const target = working[idx]!;
        for (const mid of collectUserMediaIdsFromFact(target)) {
          if (mediaOkByIdRef.current.get(mid) === true) continue;
          const result = await probeUserMediaMeta(mid, token);
          if (result.status === "ok") {
            mediaOkByIdRef.current.set(mid, true);
            mediaFilenameByIdRef.current.set(mid, result.filename);
          } else if (result.status === "missing") {
            mediaOkByIdRef.current.set(mid, false);
            mediaFilenameByIdRef.current.set(mid, "(missing)");
          }
        }
        setMediaOkById(new Map(mediaOkByIdRef.current));
        setMediaFilenameById(new Map(mediaFilenameByIdRef.current));

        let view = working;
        let viewIdx = idx;
        if (filterActive) {
          if (filterKind === "missing_media") {
            view = working.filter((f) => factReferencesMissingMedia(f, mediaOkByIdRef.current));
          } else if (filterKind === "not_verified") {
            view = working.filter((f) => !isFactHumanVerified(f, qualityByFactId.get(f.id)));
          } else if (filterIdSet) {
            view = working.filter((f) => filterIdSet.has(f.id));
          }
          viewIdx = view.findIndex((f) => f.id === id);
          if (viewIdx < 0) {
            setFilterKind("all");
            setFilterIdSet(null);
            viewIdx = idx;
            setSaveSuccess(`Showing fact ${id} (cleared filter — this fact was not in the filtered set).`);
          } else {
            setSaveSuccess(`Showing fact ${id}`);
          }
        } else {
          setSaveSuccess(`Showing fact ${id}`);
        }
        setFactPage(Math.floor(viewIdx / PAGE_SIZE) + 1);
        setHighlightFactId(id);
        setFactIdQuery(id);
      } catch (e) {
        setHighlightFactId(null);
        setSaveError(e instanceof Error ? e.message : `Fact ${id} not found`);
      } finally {
        setGoingToFact(false);
      }
    },
    [
      factIdQuery,
      token,
      localFacts,
      deckId,
      filterActive,
      filterKind,
      filterIdSet,
      qualityByFactId,
    ]
  );

  useEffect(() => {
    if (!open || !token) return;
    const seed = (initialFactId ?? "").trim();
    if (!seed || initialFactHandledRef.current === seed) return;
    // Wait until the open-init effect has seeded localFacts.
    if (!wasOpenRef.current) return;
    initialFactHandledRef.current = seed;
    void goToFactById(seed);
  }, [open, token, initialFactId, goToFactById]);

  useEffect(() => {
    if (!highlightFactId) return;
    highlightRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightFactId, factPage]);

  useEffect(() => {
    if (!open || !token || !qualityEnabled) {
      setQualityByFactId(new Map());
      setLoadingQuality(false);
      return;
    }
    let cancelled = false;
    setLoadingQuality(true);
    void (async () => {
      try {
        const items = await fetchAllDeckQuality(deckId, token);
        if (cancelled) return;
        const next = new Map<string, FactQuality>();
        for (const q of items) next.set(q.fact_id, q);
        setQualityByFactId(next);
      } catch (e) {
        if (!cancelled) {
          setSaveError(e instanceof Error ? e.message : "Failed to load quality");
          setQualityByFactId(new Map());
        }
      } finally {
        if (!cancelled) setLoadingQuality(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token, qualityEnabled, deckId]);

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
      for (const id of collectUserMediaIdsFromFact(f)) ids.add(id);
    }
    // Only probe ids we have never classified; do not cache non-404 failures as missing.
    const unchecked = [...ids].filter((id) => !mediaOkByIdRef.current.has(id));
    if (unchecked.length === 0) return;
    let cancelled = false;
    (async () => {
      const CHUNK = 4;
      for (let i = 0; i < unchecked.length; i += CHUNK) {
        if (cancelled) return;
        const chunk = unchecked.slice(i, i + CHUNK);
        await Promise.all(
          chunk.map(async (mid) => {
            const result = await probeUserMediaMeta(mid, token);
            if (cancelled) return;
            if (result.status === "ok") {
              mediaOkByIdRef.current.set(mid, true);
              mediaFilenameByIdRef.current.set(mid, result.filename);
            } else if (result.status === "missing") {
              mediaOkByIdRef.current.set(mid, false);
              mediaFilenameByIdRef.current.set(mid, "(missing)");
            }
            // error: leave unset so a later scan can retry
          })
        );
      }
      if (!cancelled) {
        setMediaOkById(new Map(mediaOkByIdRef.current));
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
    if (filterActive) return;
    const added = await fetchNextServerPage();
    if (added) setFactPage((p) => p + 1);
  }, [factPage, totalPages, fetchNextServerPage, filterActive]);

  const busy =
    savingFactId !== null ||
    mediaUploadingKey !== null ||
    savingColumns ||
    addingFactRow ||
    loadingMoreFacts ||
    goingToFact ||
    regenKey !== null ||
    filterScanning ||
    verifyingFactId !== null;

  const clearFactFilter = useCallback(() => {
    setFilterKind("all");
    setFilterIdSet(null);
    setSaveSuccess("");
  }, []);

  const applyFactFilter = useCallback(
    async (kind: EditFactsFilterKind) => {
      if (kind === "all") {
        clearFactFilter();
        return;
      }
      if (!token) {
        setSaveError("Sign in required.");
        return;
      }
      if (
        (kind === "open_reports" || kind === "quality" || kind === "not_verified") &&
        !qualityEnabled
      ) {
        setSaveError("This filter is only available on source decks you own.");
        return;
      }
      setFilterScanning(true);
      setSaveError("");
      setSaveSuccess("");
      try {
        const all = await fetchAllDeckFacts(deckId, token);
        setLocalFacts((prev) =>
          mergeServerFactsPreservingDirty(prev, all, dirtyFactIdsRef.current)
        );
        setServerHasMore(false);
        setServerNextOffset(all.length);
        setFactsTotalFromApi(all.length);

        if (kind === "missing_media") {
          const ids = new Set<string>();
          for (const f of all) {
            for (const id of collectUserMediaIdsFromFact(f)) ids.add(id);
          }
          const pending = [...ids].filter((id) => mediaOkByIdRef.current.get(id) !== true);
          let missingN = 0;
          let errorN = 0;
          const CHUNK = 4;
          for (let i = 0; i < pending.length; i += CHUNK) {
            const chunk = pending.slice(i, i + CHUNK);
            await Promise.all(
              chunk.map(async (mid) => {
                const result = await probeUserMediaMeta(mid, token);
                if (result.status === "ok") {
                  mediaOkByIdRef.current.set(mid, true);
                  mediaFilenameByIdRef.current.set(mid, result.filename);
                } else if (result.status === "missing") {
                  mediaOkByIdRef.current.set(mid, false);
                  mediaFilenameByIdRef.current.set(mid, "(missing)");
                  missingN += 1;
                } else {
                  mediaOkByIdRef.current.delete(mid);
                  errorN += 1;
                }
              })
            );
          }
          setMediaOkById(new Map(mediaOkByIdRef.current));
          setMediaFilenameById(new Map(mediaFilenameByIdRef.current));
          const broken = all.filter((f) => factReferencesMissingMedia(f, mediaOkByIdRef.current));
          setFilterIdSet(null);
          setFilterKind("missing_media");
          setFactPage(1);
          setSaveSuccess(
            broken.length === 0
              ? "No facts reference missing media."
              : `Showing ${broken.length} fact(s) with missing media (${missingN} missing ids` +
                  (errorN ? `, ${errorN} unchecked due to errors` : "") +
                  `).`
          );
          return;
        }

        if (kind === "open_reports") {
          const ids = await fetchOpenReportFactIds(deckId, token);
          setFilterIdSet(ids);
          setFilterKind("open_reports");
          setFactPage(1);
          setSaveSuccess(
            ids.size === 0
              ? "No open report contributions."
              : `Showing ${ids.size} fact(s) with open reports.`
          );
          return;
        }

        if (kind === "quality") {
          const maxScore = Math.min(10, Math.max(1, Math.round(qualityMaxScore)));
          const items = await fetchAllDeckQuality(deckId, token, { maxScore });
          const ids = new Set(items.map((q) => q.fact_id));
          setFilterIdSet(ids);
          setFilterKind("quality");
          setFactPage(1);
          setSaveSuccess(
            ids.size === 0
              ? `No facts with quality score ≤ ${maxScore}.`
              : `Showing ${ids.size} fact(s) with quality score ≤ ${maxScore}.`
          );
          return;
        }

        if (kind === "confidence") {
          const maxP = confMaxPGood;
          const minR = Math.max(0, Math.floor(confMinReports));
          const items = await fetchAllDeckConfidence(deckId, token);
          const ids = new Set(
            items
              .filter((c) => c.p_good <= maxP || c.reports >= minR)
              .map((c) => c.fact_id)
          );
          setFilterIdSet(ids);
          setFilterKind("confidence");
          setFactPage(1);
          setSaveSuccess(
            ids.size === 0
              ? `No facts with p_good ≤ ${maxP} or reports ≥ ${minR}.`
              : `Showing ${ids.size} fact(s) (p_good ≤ ${maxP} or reports ≥ ${minR}).`
          );
          return;
        }

        // not_verified — displayFacts filters via qualityByFactId
        let qMap = qualityByFactId;
        if (qMap.size === 0) {
          const items = await fetchAllDeckQuality(deckId, token);
          qMap = new Map<string, FactQuality>();
          for (const q of items) qMap.set(q.fact_id, q);
          setQualityByFactId(qMap);
        }
        setFilterIdSet(null);
        setFilterKind("not_verified");
        setFactPage(1);
        const unverifiedN = all.filter((f) => !isFactHumanVerified(f, qMap.get(f.id))).length;
        setSaveSuccess(
          unverifiedN === 0
            ? "All loaded facts are human verified."
            : `Showing ${unverifiedN} fact(s) not marked human verified.`
        );
      } catch (e) {
        setFilterKind("all");
        setFilterIdSet(null);
        setSaveError(e instanceof Error ? e.message : "Failed to apply filter");
      } finally {
        setFilterScanning(false);
      }
    },
    [
      token,
      deckId,
      qualityEnabled,
      qualityMaxScore,
      confMaxPGood,
      confMinReports,
      qualityByFactId,
      clearFactFilter,
    ]
  );

  const updateFixSettings = useCallback(
    (patch: Partial<FixFactSettings>) => {
      setFixSettings((prev) => {
        const next = { ...prev, ...patch };
        saveFixFactSettings(deckId, next);
        return next;
      });
    },
    [deckId]
  );

  const canRegenAudio = Boolean(getElevenLabsApiKey() && getElevenLabsVoiceId());
  const regenMissingKeys = useMemo(() => {
    const missing: string[] = [];
    if (!getElevenLabsApiKey()) missing.push("VITE_ELEVENLABS_API_KEY");
    if (!getElevenLabsVoiceId()) missing.push("VITE_ELEVENLABS_VOICE_ID");
    return missing;
  }, []);

  const ttsModelSelect = ttsModelCustom
    ? CUSTOM_MODEL
    : modelSelectValue(fixSettings.ttsModel, TTS_MODEL_OPTIONS);

  const regenAudio = useCallback(
    async (factId: string, col: number) => {
      const fact = localFacts.find((f) => f.id === factId);
      if (!fact) return;
      const text = (factEntryAt(fact, col).text ?? "").trim();
      if (!text) {
        setSaveError("Column has no text to synthesize.");
        return;
      }
      const key = `${factId}-${col}-audio`;
      setRegenKey(key);
      setSaveError("");
      setSaveSuccess("");
      try {
        const blob = await synthesizeWithElevenLabs({
          text,
          modelId: fixSettings.ttsModel,
        });
        setAudioProposal({ factId, col, blob });
        setSaveSuccess("New audio ready — preview, then Apply or Discard.");
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Audio regen failed");
      } finally {
        setRegenKey(null);
      }
    },
    [localFacts, fixSettings.ttsModel]
  );

  const discardAudioProposal = useCallback(() => {
    setAudioProposal(null);
    setSaveSuccess("");
  }, []);

  const applyAudioProposal = useCallback(async () => {
    if (!token || !audioProposal) return;
    const { factId, col, blob } = audioProposal;
    const fact = localFacts.find((f) => f.id === factId);
    if (!fact) return;
    setRegenKey(`${factId}-${col}-audio-apply`);
    setSaveError("");
    setSaveSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", blob, `${factId}_${col}.mp3`);
      formData.append("deck_id", deckId);
      const clientId = `eloc-${factId}-${col}-${blob.size}-${Date.now()}`;
      const res = (await uploadMultipart(
        "/api/media",
        formData,
        token,
        clientId
      )) as UploadMediaRes;
      const mediaId = res?.data?.id != null ? String(res.data.id).trim() : "";
      if (!mediaId) throw new Error("Upload response missing media id");
      const filename = res.data.filename ?? `${factId}_${col}.mp3`;
      mediaFilenameByIdRef.current.set(mediaId, filename);
      mediaOkByIdRef.current.set(mediaId, true);
      setMediaFilenameById(new Map(mediaFilenameByIdRef.current));
      setMediaOkById(new Map(mediaOkByIdRef.current));
      const nextFact = mergeEntryMediaPatch(fact, col, { audio: mediaId });
      if (!factHasSomeContent(nextFact.entries)) {
        throw new Error("Each fact needs at least one field with text or attached media.");
      }
      setLocalFacts((prev) => prev.map((f) => (f.id === factId ? nextFact : f)));
      setAudioProposal(null);
      setSavingFactId(factId);
      try {
        const body: UpdateFactReq = { entries: nextFact.entries };
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
        setSaveSuccess("Audio applied and fact saved.");
        onFactSaved?.(nextFact);
        await onRefreshFacts();
      } catch (patchErr) {
        setDirtyFactIds((d) => new Set(d).add(factId));
        throw patchErr;
      } finally {
        setSavingFactId(null);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Audio apply failed");
    } finally {
      setRegenKey(null);
    }
  }, [token, audioProposal, deckId, localFacts, onFactSaved, onRefreshFacts]);

  const toggleHumanVerified = useCallback(
    async (factId: string) => {
      if (!token || !qualityEnabled) return;
      const fact = localFacts.find((f) => f.id === factId);
      if (!fact) return;
      setVerifyingFactId(factId);
      setSaveError("");
      setSaveSuccess("");
      try {
        const existing = (await getFactQuality(deckId, factId, token)) ?? {
          fact_id: factId,
          entries: {},
          updated_at: "",
        };
        const currentlyVerified = isFactHumanVerified(fact, existing);
        if (currentlyVerified) {
          const remaining = stripHumanVerifiedAspects(existing.entries ?? {});
          if (Object.keys(remaining).length === 0) {
            await deleteFactQuality(deckId, factId, token);
            setQualityByFactId((prev) => {
              const next = new Map(prev);
              next.delete(factId);
              return next;
            });
          } else {
            const updated = await putFactQuality(deckId, factId, remaining, token);
            setQualityByFactId((prev) => new Map(prev).set(factId, updated));
          }
          setSaveSuccess("Cleared human verification.");
        } else {
          const entries = buildHumanVerifiedEntries(fact, existing.entries ?? {});
          if (Object.keys(entries).length === 0) {
            setSaveError("Add text or audio before marking verified.");
            return;
          }
          const updated = await putFactQuality(deckId, factId, entries, token);
          setQualityByFactId((prev) => new Map(prev).set(factId, updated));
          setSaveSuccess("Marked human verified.");
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to update verification");
      } finally {
        setVerifyingFactId(null);
      }
    },
    [token, qualityEnabled, localFacts, deckId]
  );

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
        formData.append("deck_id", deckId);
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
        mediaOkByIdRef.current.set(newId, true);
        setMediaFilenameById(new Map(mediaFilenameByIdRef.current));
        setMediaOkById(new Map(mediaOkByIdRef.current));
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setMediaUploadingKey(null);
      }
    },
    [token, deckId]
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
        onFactSaved?.(fact);
        await onRefreshFacts();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to save fact.");
      } finally {
        setSavingFactId(null);
      }
    },
    [token, deckId, localFacts, onRefreshFacts, onFactSaved]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-edit-facts-title"
    >
      <div className="relative z-50 flex h-full w-full flex-col overflow-hidden bg-card">
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
          <form
            className="mb-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void goToFactById();
            }}
          >
            <Input
              value={factIdQuery}
              onChange={(e) => setFactIdQuery(e.target.value)}
              placeholder="Fact id"
              aria-label="Fact id"
              className="h-8 w-40 font-mono text-xs"
              disabled={busy}
            />
            <Button type="submit" size="sm" variant="outline" disabled={busy || !factIdQuery.trim()}>
              {goingToFact ? "Going…" : "Go to fact"}
            </Button>
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground shrink-0">Filter</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={filterKind}
                disabled={busy}
                aria-label="Fact filter"
                onChange={(e) => {
                  const next = e.target.value as EditFactsFilterKind;
                  void applyFactFilter(next);
                }}
              >
                <option value="all">All facts</option>
                <option value="missing_media">Missing media</option>
                {qualityEnabled ? (
                  <>
                    <option value="open_reports">Open reports</option>
                    <option value="quality">Quality ≤ N</option>
                    <option value="not_verified">Not human verified</option>
                  </>
                ) : null}
                <option value="confidence">Confidence weak</option>
              </select>
            </label>
            {qualityEnabled ? (
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Q≤
                <Input
                  type="number"
                  min={1}
                  max={10}
                  className="h-8 w-14 text-xs"
                  value={qualityMaxScore}
                  disabled={busy}
                  title="Quality max score (Filter = Quality ≤ N, then Apply)"
                  onChange={(e) => setQualityMaxScore(Number(e.target.value) || 5)}
                />
              </label>
            ) : null}
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              p≤
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className="h-8 w-16 text-xs"
                value={confMaxPGood}
                disabled={busy}
                title="Max p_good (Filter = Confidence weak, then Apply)"
                onChange={(e) => setConfMaxPGood(Number(e.target.value) || 0)}
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              reports≥
              <Input
                type="number"
                min={0}
                className="h-8 w-14 text-xs"
                value={confMinReports}
                disabled={busy}
                title="Min reports (Filter = Confidence weak, then Apply)"
                onChange={(e) => setConfMinReports(Number(e.target.value) || 0)}
              />
            </label>
            {filterActive ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => clearFactFilter()}
              >
                Clear filter
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || filterKind === "all"}
              title="Re-run the current filter with the thresholds above"
              onClick={() => void applyFactFilter(filterKind)}
            >
              {filterScanning ? "Filtering…" : "Apply"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Filters load the whole deck. Quality / reports / verified need a source deck.
            </span>
          </form>
          <div className="mb-3 grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">TTS model</span>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                value={ttsModelSelect}
                disabled={busy}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === CUSTOM_MODEL) {
                    setTtsModelCustom(true);
                    return;
                  }
                  setTtsModelCustom(false);
                  updateFixSettings({ ttsModel: v });
                }}
              >
                {TTS_MODEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value={CUSTOM_MODEL}>Custom…</option>
              </select>
              {ttsModelCustom && (
                <Input
                  className="mt-1 h-8 font-mono text-xs"
                  value={fixSettings.ttsModel}
                  disabled={busy}
                  placeholder="eleven_…"
                  onChange={(e) => updateFixSettings({ ttsModel: e.target.value })}
                />
              )}
            </label>
          </div>
          {regenMissingKeys.length > 0 && (
            <p className="mb-3 text-xs rounded border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-amber-950 dark:text-amber-100">
              Missing env for regen: {regenMissingKeys.join(", ")}. Same keys as Fix fact (web-test{" "}
              <code className="text-[10px]">.env</code> /{" "}
              <code className="text-[10px]">./run-dev.sh release</code>).
            </p>
          )}
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
                        <tr
                          ref={fact.id === highlightFactId ? highlightRowRef : undefined}
                          className={
                            fact.id === highlightFactId
                              ? "border-b align-top bg-amber-500/10 ring-1 ring-inset ring-amber-600/40"
                              : "border-b align-top"
                          }
                        >
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">
                          <div>{start + i + 1}</div>
                          <div className="max-w-[5.5rem] truncate font-mono text-[10px] leading-tight" title={fact.id}>
                            {fact.id}
                          </div>
                        </td>
                        {Array.from({ length: colCount }, (_, idx) => {
                          const ent = factEntryAt(fact, idx);
                          const mediaUploading = mediaUploadingKey === `${fact.id}-${idx}`;
                          const regeneratingAudio = regenKey === `${fact.id}-${idx}-audio`;
                          const applyingAudio = regenKey === `${fact.id}-${idx}-audio-apply`;
                          const cellText = (ent.text ?? "").trim();
                          const textEditKey = `${fact.id}-${idx}`;
                          const editingText = editingTextKey === textEditKey;
                          const proposedAudio =
                            audioProposal &&
                            audioProposal.factId === fact.id &&
                            audioProposal.col === idx
                              ? audioProposal
                              : null;
                          const entryMediaFull =
                            Boolean(ent.audio) &&
                            Boolean(ent.image) &&
                            Boolean(ent.video) &&
                            Boolean(ent.json);
                          const cellAria = `${columnNames[idx] ?? `Column ${idx + 1}`}, row ${start + i + 1}`;
                          return (
                            <td key={`${fact.id}-c${idx}`} className="max-w-[20rem] px-3 py-2">
                              <div className="flex items-start gap-1.5">
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  {editingText ? (
                                    <textarea
                                      value={ent.text ?? ""}
                                      onChange={(e) => updateFactCell(fact.id, idx, e.target.value)}
                                      onBlur={() => setEditingTextKey(null)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          e.preventDefault();
                                          setEditingTextKey(null);
                                        }
                                      }}
                                      rows={2}
                                      autoFocus
                                      className="min-h-[3.25rem] min-w-[6rem] w-full resize-y rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm leading-snug ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                      aria-label={cellAria}
                                      disabled={busy}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      className="min-h-[3.25rem] min-w-[6rem] w-full rounded-md border border-input bg-background px-3 py-1.5 text-left text-sm leading-snug whitespace-pre-wrap break-words hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                                      aria-label={`Edit ${cellAria}`}
                                      title="Click to edit raw text"
                                      disabled={busy}
                                      onClick={() => setEditingTextKey(textEditKey)}
                                    >
                                      {cellText ? (
                                        <WikiRubyText text={ent.text ?? ""} />
                                      ) : (
                                        <span className="text-muted-foreground">(empty)</span>
                                      )}
                                    </button>
                                  )}
                                  {mediaUploading && (
                                    <p className="text-xs text-muted-foreground">Uploading…</p>
                                  )}
                                  {(() => {
                                    const iconBtnClass =
                                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-input bg-muted/50 text-foreground hover:bg-muted disabled:opacity-50";
                                    const regenAudioBtn = (
                                      <button
                                        type="button"
                                        className={iconBtnClass}
                                        disabled={
                                          busy ||
                                          !cellText ||
                                          !canRegenAudio ||
                                          regeneratingAudio ||
                                          applyingAudio
                                        }
                                        aria-label="Regenerate audio"
                                        title={
                                          !cellText
                                            ? "This cell needs text first"
                                            : !canRegenAudio
                                              ? "ElevenLabs env not set"
                                              : "Regenerate audio from this cell’s text"
                                        }
                                        onClick={() => void regenAudio(fact.id, idx)}
                                      >
                                        <span className="text-[12px] leading-none" aria-hidden>
                                          {regeneratingAudio ? "…" : "↻"}
                                        </span>
                                      </button>
                                    );
                                    const proposalControls = proposedAudio ? (
                                      <>
                                        <BlobAudioPlayButton mediaBlob={proposedAudio.blob} />
                                        <button
                                          type="button"
                                          className={`${iconBtnClass} border-amber-600/50 bg-amber-500/15`}
                                          disabled={busy || applyingAudio}
                                          aria-label="Apply proposed audio"
                                          title="Apply proposed audio"
                                          onClick={() => void applyAudioProposal()}
                                        >
                                          <span className="text-[12px] leading-none" aria-hidden>
                                            {applyingAudio ? "…" : "✓"}
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          className={iconBtnClass}
                                          disabled={busy || applyingAudio}
                                          aria-label="Discard proposed audio"
                                          title="Discard proposed audio"
                                          onClick={discardAudioProposal}
                                        >
                                          <span className="text-[12px] leading-none" aria-hidden>
                                            ✕
                                          </span>
                                        </button>
                                      </>
                                    ) : null;
                                    return (["audio", "image", "video", "json"] as const).map((slot) => {
                                    const mid = ent[slot];
                                    if (!mid) {
                                      if (slot !== "audio") return null;
                                      return (
                                        <div
                                          key={slot}
                                          className={
                                            proposedAudio
                                              ? "flex min-w-0 items-center gap-1.5 rounded-md border border-amber-600/40 bg-amber-500/10 px-1.5 py-1 text-xs leading-snug"
                                              : "flex min-w-0 items-center gap-1.5 text-xs leading-snug"
                                          }
                                        >
                                          <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">
                                            {SLOT_LABEL[slot]}
                                          </span>
                                          {regenAudioBtn}
                                          {proposalControls}
                                          {!proposedAudio && (
                                            <span className="text-[10px] text-muted-foreground">No audio</span>
                                          )}
                                        </div>
                                      );
                                    }
                                    const mediaMissing = mediaOkById.get(mid) === false;
                                    const fname = mediaMissing
                                      ? "(missing)"
                                      : (mediaFilenameById.get(mid) ?? `${mid.slice(0, 10)}…`);
                                    return (
                                      <div
                                        key={slot}
                                        className={
                                          slot === "audio" && proposedAudio
                                            ? "flex min-w-0 items-center gap-1.5 rounded-md border border-amber-600/40 bg-amber-500/10 px-1.5 py-1 text-xs leading-snug"
                                            : "flex min-w-0 items-center gap-1.5 text-xs leading-snug"
                                        }
                                      >
                                        <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">
                                          {SLOT_LABEL[slot]}
                                        </span>
                                        {slot === "audio" && token && !mediaMissing ? (
                                          <AudioPreviewButton mediaId={mid} token={token} />
                                        ) : null}
                                        {slot === "audio" ? regenAudioBtn : null}
                                        {slot === "audio" ? proposalControls : null}
                                        <div className="flex min-w-0 flex-1 justify-start overflow-hidden">
                                          <div className="flex w-max min-w-0 max-w-full items-center gap-0 overflow-hidden">
                                            <span
                                              className={
                                                mediaMissing
                                                  ? "min-w-0 shrink truncate font-medium text-destructive"
                                                  : "min-w-0 shrink truncate font-medium"
                                              }
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
                                  });
                                  })()}
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
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {qualityEnabled ? (
                              <button
                                type="button"
                                className={
                                  isFactHumanVerified(fact, qualityByFactId.get(fact.id))
                                    ? "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-green-600 text-xl font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                                    : "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/40 bg-background text-xl font-semibold text-muted-foreground hover:border-green-600/60 hover:text-green-700 disabled:opacity-50"
                                }
                                disabled={busy || loadingQuality}
                                aria-label={
                                  isFactHumanVerified(fact, qualityByFactId.get(fact.id))
                                    ? "Clear human verification"
                                    : "Mark human verified"
                                }
                                aria-pressed={isFactHumanVerified(fact, qualityByFactId.get(fact.id))}
                                title={
                                  isFactHumanVerified(fact, qualityByFactId.get(fact.id))
                                    ? "Human verified — click to clear"
                                    : "Mark this row human verified"
                                }
                                onClick={() => void toggleHumanVerified(fact.id)}
                              >
                                {verifyingFactId === fact.id ? "…" : "✓"}
                              </button>
                            ) : null}
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
                    Showing {start + 1}–{Math.min(start + PAGE_SIZE, total)} of {total} rows
                    {filterActive ? ` · filtered (${total})` : " in this editor"} · {PAGE_SIZE} per page
                    {!filterActive && apiFactTotal != null && apiFactTotal > localFacts.length
                      ? ` · ${apiFactTotal} in deck`
                      : ""}
                    {!filterActive && serverHasMore ? " · more on server — use Next" : ""}
                  </p>
                  {(totalPages > 1 || (!filterActive && serverHasMore)) && (
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
                        disabled={
                          busy ||
                          (factPage >= totalPages && (filterActive || !serverHasMore)) ||
                          !token
                        }
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
