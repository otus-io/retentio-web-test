import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  request,
  fetchDeckFactsPage,
  fetchAllDeckFacts,
  uploadMultipart,
  buildTemplateForRequest,
  validateAddFactBody,
  isImportedDeck,
  importedDeckUpdateAvailable,
  isPublishedSourceDeck,
  type AddFactOperation,
  type AddFactReq,
  type AddFactRes,
  type DeckItem,
  type Entry,
  type FactItem,
  type GetCardsRes,
  type GetDeckRes,
  type GetNextCardRes,
  type NextCardItem,
  type RescheduleReq,
  type RescheduleRes,
  type UpdateDeckReq,
  type UpdateDeckRes,
  type UpdateCardReq,
  type UpdateCardRes,
  normalizeStoredMediaRef,
  type UpdateFactReq,
  type UploadMediaRes,
  fileLooksLikeJson,
} from "@/lib/api";
import { getDeckCards, getDeckTags, getNextCard, listTags, type TagItem } from "@/lib/tags";
import { Label } from "@/components/ui/label";
import {
  DeckHeader,
  DeckEditForm,
  DeckInfoCard,
  DeckCardFontDialog,
  DeckAllCardsModal,
  DeckPublishDialog,
  DeckSyncUpdatesModal,
  SubmitFactContributionModal,
  SubmitFieldRenameContributionModal,
  SubmitTagContributionModal,
  PendingContributionsOutboxModal,
  PendingContributionsBanner,
  DeckFeedbackInboxModal,
  DeckOpenFeedbackBanner,
  DeckProvenanceBanner,
  DeckPublishedBanner,
} from "@/components/deck";
import type { FactContributionKind } from "@/components/deck/SubmitFactContributionModal";
import {
  countPendingContributions,
  previewFromEntries,
  removePendingContributionByFactId,
  appendSentContribution,
  upsertPendingContribution,
  type ContributionBoxKind,
} from "@/lib/pendingContributions";
import type { StagedTagContribution } from "@/components/deck/SubmitTagContributionModal";
import type { StagedFieldRenameContribution } from "@/components/deck/SubmitFieldRenameContributionModal";
import {
  DECK_CARD_TYPOGRAPHY_DEFAULTS,
  loadDeckCardSidesTypography,
  saveDeckCardSidesTypography,
  type DeckCardSidesTypography,
} from "@/lib/deckCardTypography";
import { nowUnixSecondsUtc } from "@/lib/unixTime";
import { CardSection } from "@/components/card";
import {
  AddFactsForm,
  BulkEditFactsModal,
  type AddFactEntry,
  makeInitialFactRow,
} from "@/components/facts";
import { useImportedDeckUpdates } from "@/hooks/useImportedDeckUpdates";
import { useDeckFeedbackNotifications } from "@/hooks/useDeckFeedbackNotifications";

export default function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const factQueryParam = (searchParams.get("fact") ?? "").trim();
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  /** Ignore async results after navigating to another deck (avoids stale UI). */
  const routeDeckIdRef = useRef(id);
  routeDeckIdRef.current = id;
  const [deck, setDeck] = useState<DeckItem | null>(null);
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [sibling, setSibling] = useState(false);
  const [rate, setRate] = useState(20);
  const [deckTagIds, setDeckTagIds] = useState<string[]>([]);
  const [deckTagsRefreshKey, setDeckTagsRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [factRow, setFactRow] = useState<AddFactEntry[]>([]);
  const [addFactOp, setAddFactOp] = useState<AddFactOperation>("append");
  const [addFactSplit, setAddFactSplit] = useState(1);
  const [addingFacts, setAddingFacts] = useState(false);
  const [addFactsError, setAddFactsError] = useState("");
  const [addFactTagIds, setAddFactTagIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [factsList, setFactsList] = useState<FactItem[]>([]);
  const [factsHasMore, setFactsHasMore] = useState(false);
  const [factsTotal, setFactsTotal] = useState<number | null>(null);
  const [deleteFactId, setDeleteFactId] = useState<string | null>(null);
  const [nextCard, setNextCard] = useState<GetNextCardRes["data"] | null>(null);
  const [nextCardMeta, setNextCardMeta] = useState<GetNextCardRes["meta"] | null>(null);
  const [nextCardFact, setNextCardFact] = useState<FactItem | null>(null);
  const [loadingNextCard, setLoadingNextCard] = useState(false);
  const [cardError, setCardError] = useState("");
  const [cardSuccess, setCardSuccess] = useState("");
  const [studyTagId, setStudyTagId] = useState("");
  const [studyTags, setStudyTags] = useState<TagItem[]>([]);
  /** Study header stats: from deck.stats (all tags) or GET /cards?tag_id (tag filter). */
  const [studyCardStats, setStudyCardStats] = useState<{
    cardsCount: number;
    dueCards: number;
    reviewedCards: number;
  } | null>(null);
  /** Which filter the stats belong to: "" = all tags, tag id = that tag, null = none/loading. */
  const [studyCardStatsScope, setStudyCardStatsScope] = useState<string | null>(null);
  const [studyStatsRefreshKey, setStudyStatsRefreshKey] = useState(0);
  const [addFactsOpen, setAddFactsOpen] = useState(false);
  const [bulkEditFactsOpen, setBulkEditFactsOpen] = useState(false);
  const openedFactQueryRef = useRef<string | null>(null);
  const [cardFontsOpen, setCardFontsOpen] = useState(false);
  const [allCardsOpen, setAllCardsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [feedbackSubmitOpen, setFeedbackSubmitOpen] = useState(false);
  const [feedbackSubmitFact, setFeedbackSubmitFact] = useState<FactItem | null>(null);
  const [feedbackSubmitKind, setFeedbackSubmitKind] = useState<FactContributionKind>("report");
  const [feedbackInboxOpen, setFeedbackInboxOpen] = useState(false);
  const [fieldRenameOpen, setFieldRenameOpen] = useState(false);
  const [deckTagContributeOpen, setDeckTagContributeOpen] = useState(false);
  const [pendingOutboxOpen, setPendingOutboxOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [cardTypography, setCardTypography] = useState<DeckCardSidesTypography>(() =>
    id ? loadDeckCardSidesTypography(id) : DECK_CARD_TYPOGRAPHY_DEFAULTS
  );

  useEffect(() => {
    if (!successMessage) return;
    const t = window.setTimeout(() => setSuccessMessage(""), 12_000);
    return () => window.clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (!addFactsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddFactsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addFactsOpen]);

  useEffect(() => {
    setDeck(null);
    setFactsList([]);
    setNextCard(null);
    setNextCardFact(null);
    setNextCardMeta(null);
    setStudyTagId("");
    setStudyTags([]);
    setStudyCardStats(null);
    setStudyCardStatsScope(null);
    setStudyStatsRefreshKey(0);
    setError("");
    setEditing(false);
    setSuccessMessage("");
    setCardSuccess("");
    setBulkEditFactsOpen(false);
    setAllCardsOpen(false);
    setPublishOpen(false);
    setSyncOpen(false);
    setFeedbackSubmitOpen(false);
    setFeedbackSubmitFact(null);
    setFeedbackInboxOpen(false);
    setFieldRenameOpen(false);
    setDeckTagContributeOpen(false);
    setPendingOutboxOpen(false);
    setPendingCount(0);
    setFactsHasMore(false);
    setFactsTotal(null);
    openedFactQueryRef.current = null;
  }, [id]);

  useEffect(() => {
    if (!id) {
      setPendingCount(0);
      return;
    }
    setPendingCount(countPendingContributions(id));
  }, [id]);

  useEffect(() => {
    if (!factQueryParam || !deck || !token) return;
    if (openedFactQueryRef.current === factQueryParam) return;
    openedFactQueryRef.current = factQueryParam;
    setBulkEditFactsOpen(true);
  }, [factQueryParam, deck, token]);

  const refreshPendingCount = useCallback(() => {
    if (!id) {
      setPendingCount(0);
      return;
    }
    setPendingCount(countPendingContributions(id));
  }, [id]);

  const recordPendingContribution = useCallback(
    (
      kind: ContributionBoxKind,
      opts?: {
        factId?: string;
        entries?: Entry[];
        preview?: string;
        addTags?: string[];
        removeTags?: string[];
        proposedFields?: string[];
        template?: number[][];
        message?: string;
      }
    ) => {
      if (!id) return;
      const preview =
        opts?.preview ??
        (opts?.addTags?.length || opts?.removeTags?.length
          ? [
              opts.addTags?.length ? `+${opts.addTags.join(", ")}` : "",
              opts.removeTags?.length ? `−${opts.removeTags.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : opts?.proposedFields?.join(" · ")) ??
        previewFromEntries(opts?.entries);
      upsertPendingContribution(id, {
        kind,
        factId: opts?.factId,
        preview,
        addTags: opts?.addTags,
        removeTags: opts?.removeTags,
        proposedFields: opts?.proposedFields,
        template: opts?.template,
        message: opts?.message,
      });
      refreshPendingCount();
    },
    [id, refreshPendingCount]
  );

  useEffect(() => {
    if (!id) return;
    setCardTypography(loadDeckCardSidesTypography(id));
    setCardFontsOpen(false);
  }, [id]);

  const handleCardTypographyChange = useCallback(
    (next: DeckCardSidesTypography) => {
      setCardTypography(next);
      if (id) saveDeckCardSidesTypography(id, next);
    },
    [id]
  );

  const fetchDeck = useCallback(async () => {
    if (!token || !id) return;
    const targetDeckId = id;
    // Soft refresh when a deck is already shown — full-page `loading` would unmount modals (e.g. Edit Facts) and wipe filters.
    const current = deckRef.current;
    const soft = current != null && current.id === targetDeckId;
    if (!soft) setLoading(true);
    setError("");
    try {
      const res = await request<GetDeckRes>(`/api/decks/${id}`, { token });
      if (routeDeckIdRef.current !== targetDeckId) return;
      const data = res.data;
      setDeck(data);
      setName(data.name);
      setFieldNames([...data.fields]);
      setRate(data.rate);
      setFactRow(makeInitialFactRow(data));
      setAddFactSplit(1);
      try {
        const tagsRes = await getDeckTags(targetDeckId, token);
        if (routeDeckIdRef.current !== targetDeckId) return;
        setDeckTagIds(tagsRes.data.tags.map((t) => t.id));
      } catch {
        if (routeDeckIdRef.current === targetDeckId) setDeckTagIds([]);
      }
    } catch (e) {
      if (routeDeckIdRef.current !== targetDeckId) return;
      setError(e instanceof Error ? e.message : "Failed to load deck");
      setDeck(null);
    } finally {
      if (routeDeckIdRef.current === targetDeckId && !soft) setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  const decksForUpdates = useMemo(() => (deck ? [deck] : []), [deck]);
  const { updateAvailableByDeckId, refresh: refreshDeckUpdates } = useImportedDeckUpdates(
    decksForUpdates,
    token,
    { pollMs: 60 * 1000 }
  );
  const updateAvailable = Boolean(
    deck &&
      (updateAvailableByDeckId[deck.id] || importedDeckUpdateAvailable(deck))
  );

  const { openCountByDeckId, refresh: refreshFeedbackCounts } = useDeckFeedbackNotifications(
    decksForUpdates,
    token,
    { pollMs: 60 * 1000 }
  );
  const openFeedbackCount = deck ? (openCountByDeckId[deck.id] ?? 0) : 0;

  const fetchFacts = useCallback(async () => {
    if (!token || !id) return;
    const targetDeckId = id;
    try {
      const res = await fetchDeckFactsPage(id, token);
      if (routeDeckIdRef.current !== targetDeckId) return;
      setFactsList(res.data.facts);
      setFactsHasMore(res.meta.has_more === true);
      setFactsTotal(typeof res.meta.total === "number" && res.meta.total >= 0 ? res.meta.total : null);
    } catch {
      if (routeDeckIdRef.current !== targetDeckId) return;
      setFactsList([]);
      setFactsHasMore(false);
      setFactsTotal(null);
    }
  }, [token, id]);

  const handleGetNextCard = useCallback(async (keepCurrentCard?: boolean) => {
    if (!token || !id) return;
    const targetDeckId = id;
    setCardError("");
    setLoadingNextCard(true);
    try {
      const tagId = studyTagId || null;
      const res = await getNextCard<GetNextCardRes>(id, token, tagId);
      if (routeDeckIdRef.current !== targetDeckId) return;

      // Backend returns card: [] when there are no cards; avoid using .front/.fact_id on an array
      const card = res.data.card as NextCardItem | unknown[];
      const noCard = Array.isArray(card) || card == null;
      if (noCard) {
        setNextCard(null);
        setNextCardFact(null);
        setNextCardMeta(res.meta ?? null);
        return;
      }
      setNextCard(res.data);
      setNextCardMeta(res.meta ?? null);
      const cardObj = card as NextCardItem;
      const hasSegments =
        Array.isArray(cardObj.front) &&
        Array.isArray(cardObj.back) &&
        cardObj.front.length >= 0 &&
        cardObj.back.length >= 0;
      if (hasSegments) {
        setNextCardFact(null);
      } else if (cardObj.fact_id) {
        const factRes = await request<{ data: { fact: FactItem } }>(
          `/api/decks/${id}/facts/${cardObj.fact_id}`,
          { token }
        );
        if (routeDeckIdRef.current !== targetDeckId) return;
        setNextCardFact(factRes.data.fact);
      } else {
        setNextCardFact(null);
      }
    } catch (e) {
      if (routeDeckIdRef.current !== targetDeckId) return;
      setCardError(e instanceof Error ? e.message : "No card or failed to load");
      setNextCard(null);
      setNextCardFact(null);
      setNextCardMeta(null);
    } finally {
      if (routeDeckIdRef.current === targetDeckId) setLoadingNextCard(false);
    }
  }, [token, id, studyTagId]);

  // All tags: reuse GET /decks/{id} stats. Tag filter: GET /cards?tag_id=…&stats_only=true (async, does not block next card).
  // Scope stats to the active filter so All-tags numbers never linger after a tag is selected.
  const studyTagIdRef = useRef(studyTagId);
  studyTagIdRef.current = studyTagId;

  useEffect(() => {
    if (!deck) {
      setStudyCardStats(null);
      setStudyCardStatsScope(null);
      return;
    }
    if (studyTagId) return;
    setStudyCardStats({
      cardsCount: deck.stats.cards_count,
      dueCards: deck.stats.due_cards,
      reviewedCards: deck.stats.reviewed_cards,
    });
    setStudyCardStatsScope("");
  }, [deck, studyTagId]);

  useEffect(() => {
    if (!studyTagId || !token || !id) return;
    const targetDeckId = id;
    const tagId = studyTagId;
    // Drop mismatched stats immediately (do not keep showing All-tags / previous tag).
    setStudyCardStats(null);
    setStudyCardStatsScope(null);
    void getDeckCards<GetCardsRes>(id, token, tagId, true)
      .then((cardsRes) => {
        const stillCurrentTag = studyTagIdRef.current === tagId;
        const routeOk = routeDeckIdRef.current === targetDeckId;
        if (!stillCurrentTag || !routeOk) return;
        const next = {
          cardsCount: cardsRes.data.stats.cards_count,
          dueCards: cardsRes.data.stats.due_cards,
          reviewedCards: cardsRes.data.stats.reviewed_cards,
        };
        setStudyCardStats(next);
        setStudyCardStatsScope(tagId);
      })
      .catch(() => {
        if (studyTagIdRef.current === tagId && routeDeckIdRef.current === targetDeckId) {
          setStudyCardStats(null);
          setStudyCardStatsScope(null);
        }
      });
  }, [studyTagId, token, id, studyStatsRefreshKey]);

  const displayedStudyStats =
    studyTagId === ""
      ? studyCardStatsScope === ""
        ? studyCardStats
        : null
      : studyCardStatsScope === studyTagId
        ? studyCardStats
        : null;
  const studyStatsLoading = Boolean(studyTagId && studyCardStatsScope !== studyTagId);

  useEffect(() => {
    if (!token || !id || !deck) return;
    let cancelled = false;
    void listTags(token, { usedOn: "fact", deckId: id, unused: "exclude" })
      .then((res) => {
        if (cancelled) return;
        const sorted = [...(res.data.tags ?? [])].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        setStudyTags(sorted);
      })
      .catch(() => {
        if (!cancelled) setStudyTags([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, id, deck?.id, deckTagsRefreshKey]);

  const fetchFactById = useCallback(
    async (factId: string): Promise<FactItem | null> => {
      if (!token || !id) return null;
      try {
        const res = await request<{ data: { fact: FactItem } }>(
          `/api/decks/${id}/facts/${factId}`,
          { token }
        );
        return res.data.fact;
      } catch {
        return null;
      }
    },
    [token, id]
  );

  const openFactContribution = useCallback(
    async (factId: string, kind: FactContributionKind) => {
      const fact =
        nextCardFact?.id === factId ? nextCardFact : await fetchFactById(factId);
      if (!fact) {
        setError("Could not load fact for contribution.");
        return;
      }
      setFeedbackSubmitKind(kind);
      setFeedbackSubmitFact(fact);
      setFeedbackSubmitOpen(true);
    },
    [nextCardFact, fetchFactById]
  );

  const handleReportFact = useCallback(
    (factId: string) => openFactContribution(factId, "report"),
    [openFactContribution]
  );

  const handleOfferSendEditToAuthor = useCallback(
    (factId: string) => openFactContribution(factId, "edit"),
    [openFactContribution]
  );

  useEffect(() => {
    if (deck && !editing) {
      fetchFacts();
    }
  }, [deck, editing, fetchFacts]);

  useEffect(() => {
    if (deck && !editing && token && id) {
      handleGetNextCard();
    }
  }, [deck, editing, token, id, handleGetNextCard]);

  useEffect(() => {
    if (deck) {
      setFactRow(makeInitialFactRow(deck));
      setAddFactSplit(1);
    }
  }, [deck?.id]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id) return;
    const fields = fieldNames.map((s) => s.trim()).filter(Boolean);
    if (fields.length < 1) {
      setError("At least one field name is required");
      return;
    }
    if (rate < 1 || rate > 1000) {
      setError("Rate must be between 1 and 1000");
      return;
    }
    setError("");
    setSuccessMessage("");
    setSaving(true);
    try {
      const body: UpdateDeckReq = isImportedDeck(deck)
        ? { name: name.trim() || undefined, rate }
        : { name: name.trim() || undefined, fields, rate };
      await request<UpdateDeckRes>(`/api/decks/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setEditing(false);
      setSuccessMessage("Deck updated.");
      setDeckTagsRefreshKey((k) => k + 1);
      await fetchDeck();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      setSuccessMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !id) return;
    setSuccessMessage("");
    try {
      await request(`/api/decks/${id}`, { method: "DELETE", token });
      navigate("/profile", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleteConfirm(false);
    }
  }

  async function handleAddFacts(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id || !deck) return;
    const row = factRow;
    const hasContent = row.some((e) => e.text.trim() !== "" || e.media.length > 0);
    if (!hasContent) {
      setAddFactsError("At least one field or media is required.");
      return;
    }
    setAddFactsError("");
    setSuccessMessage("");
    setAddingFacts(true);
    try {
      const entries: Entry[] = [];
      for (const entry of row) {
        let audioId: string | undefined;
        let imageId: string | undefined;
        let videoId: string | undefined;
        let jsonId: string | undefined;
        for (const { file } of entry.media) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("deck_id", id);
          const res = (await uploadMultipart("/api/media", formData, token)) as UploadMediaRes;
          const id = res?.data?.id != null ? String(res.data.id).trim() : "";
          if (!id) throw new Error("upload response missing media id");
          const type = file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
              ? "video"
              : fileLooksLikeJson(file)
                ? "json"
                : "audio";
          if (type === "audio") audioId ??= id;
          else if (type === "image") imageId ??= id;
          else if (type === "video") videoId ??= id;
          else jsonId ??= id;
        }
        const out: Entry = { text: entry.text.trim() };
        if (audioId) out.audio = audioId;
        if (imageId) out.image = imageId;
        if (videoId) out.video = videoId;
        if (jsonId) out.json = jsonId;
        entries.push(out);
      }
      const err = validateAddFactBody({ hasFacts: true });
      if (err) {
        setAddFactsError(err);
        setAddingFacts(false);
        return;
      }
      const body: AddFactReq = {
        facts: [
          {
            entries,
            ...(addFactTagIds.length > 0 ? { tag_ids: addFactTagIds } : {}),
          },
        ],
        ...buildTemplateForRequest(row.length, addFactSplit, sibling),
      };
      // Snapshot *all* fact IDs before add — factsList is only the first page and
      // must not be used as the baseline (that falsely marked existing facts as new).
      let idsBefore = new Set<string>();
      if (isImportedDeck(deck)) {
        try {
          const before = await fetchAllDeckFacts(id, token);
          idsBefore = new Set(before.map((f) => f.id));
        } catch {
          idsBefore = new Set(factsList.map((f) => f.id));
        }
      }
      await request<AddFactRes>(`/api/decks/${id}/facts/${addFactOp}`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setFactRow(makeInitialFactRow(deck));
      setAddFactTagIds([]);
      setAddFactSplit(1);
      const hasMedia = row.some((e) => e.media.length > 0);
      setSuccessMessage(hasMedia ? "Facts and media added." : "Facts added.");
      setAddFactsOpen(false);
      await fetchDeck();
      await fetchFacts();
      if (isImportedDeck(deck)) {
        try {
          const after = await fetchAllDeckFacts(id, token);
          const newlyAdded = after.filter((f) => !idsBefore.has(f.id));
          for (const f of newlyAdded) {
            recordPendingContribution("add", {
              factId: f.id,
              entries: f.entries ?? entries,
            });
          }
        } catch {
          /* ignore — card/bulk edit still record pending */
        }
        refreshPendingCount();
      }
    } catch (e) {
      setAddFactsError(e instanceof Error ? e.message : "Add Facts failed");
      setSuccessMessage("");
    } finally {
      setAddingFacts(false);
    }
  }

  async function handleSaveFactFromCard(factId: string, entries: Entry[]) {
    if (!token || !id || !deck) return;
    const hasContent = (e: Entry) =>
      (e.text?.trim() ?? "") !== "" || !!e.audio || !!e.image || !!e.video || !!e.json;
    if (entries.length === 0 || !entries.every(hasContent)) {
      throw new Error("Each entry must have at least one of text, audio, image, video, or JSON.");
    }
    const normalized = entries.map((e) => ({
      ...e,
      audio: normalizeStoredMediaRef(e.audio),
      image: normalizeStoredMediaRef(e.image),
      video: normalizeStoredMediaRef(e.video),
      json: normalizeStoredMediaRef(e.json),
    }));
    const body: UpdateFactReq = { entries: normalized };
    await request<unknown>(`/api/decks/${id}/facts/${factId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    if (isImportedDeck(deck)) {
      recordPendingContribution("edit", { factId, entries: normalized });
      setPendingOutboxOpen(true);
    }
    setSuccessMessage("Fact updated.");
    await fetchFacts();
    await fetchDeck();
  }

  async function handleDeleteFact(factId: string) {
    if (!token || !id) return;
    setError("");
    setSuccessMessage("");
    try {
      await request(`/api/decks/${id}/facts/${factId}`, { method: "DELETE", token });
      setDeleteFactId(null);
      setSuccessMessage("Fact deleted.");
      await fetchFacts();
      await fetchDeck();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleteFactId(null);
    }
  }

  async function handleUpdateCard(intervalSeconds: number) {
    if (!token || !id || !nextCard) return;
    setCardError("");
    try {
      const lastReview = nowUnixSecondsUtc();
      const body: UpdateCardReq = { card_id: nextCard.card.id, last_review: lastReview, interval: intervalSeconds };
      await request<UpdateCardRes>(`/api/decks/${id}/card`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setCardSuccess("Card reviewed.");
      await handleGetNextCard(false);
      setStudyStatsRefreshKey((k) => k + 1);
      // Refresh deck-wide review counters (total_reviews / total_reviews_today).
      void fetchDeck();
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleHideCard(cardId: string) {
    if (!token || !id) return;
    setCardError("");
    try {
      await request<UpdateCardRes>(`/api/decks/${id}/card`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ card_id: cardId, hidden: true } as UpdateCardReq),
      });
      setCardSuccess("Card hidden.");
      await fetchDeck();
      setStudyStatsRefreshKey((k) => k + 1);
      await handleGetNextCard(false);
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "Hide failed");
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!token || !id) return;
    setCardError("");
    try {
      await request(`/api/decks/${id}/cards/${cardId}`, { method: "DELETE", token });
      setCardSuccess("Card deleted.");
      await handleGetNextCard(false);
      setStudyStatsRefreshKey((k) => k + 1);
      if (!studyTagId) void fetchDeck();
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleAddCardSuccess() {
    setCardSuccess("Card added.");
    await fetchFacts();
    await handleGetNextCard(false);
    setStudyStatsRefreshKey((k) => k + 1);
    if (!studyTagId) void fetchDeck();
  }

  async function handleReschedule(days: number) {
    if (!token || !id) return;
    setCardError("");
    try {
      await request<RescheduleRes>(`/api/decks/${id}/reschedule`, {
        method: "POST",
        token,
        body: JSON.stringify({ days } as RescheduleReq),
      });
      setCardSuccess(`Schedule shifted by ${days} days.`);
      setNextCardMeta(null);
      await fetchDeck();
      setStudyStatsRefreshKey((k) => k + 1);
      await handleGetNextCard(false);
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <nav className="flex items-center gap-2">
            <Link to="/decks" className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              Deck
            </Link>
            <Link to="/profile" className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              Profile
            </Link>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
          <p className="text-muted-foreground">Loading deck…</p>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <nav className="flex items-center gap-2">
            <Link to="/decks" className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              Deck
            </Link>
            <Link to="/profile" className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              Profile
            </Link>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
          <p className="text-destructive">{error || "Deck not found."}</p>
        </div>
      </div>
    );
  }

  const imported = isImportedDeck(deck);

  return (
    <div className="min-h-screen w-full p-4 md:p-6">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <DeckHeader onLogout={handleLogout} />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {successMessage && (
          <div
            role="status"
            className="rounded-lg border border-green-600/50 bg-green-600/10 px-4 py-3 text-sm text-green-900 dark:text-green-100"
          >
            {successMessage}
          </div>
        )}

        {!imported && deck && isPublishedSourceDeck(deck) && <DeckPublishedBanner deck={deck} />}

        {!imported && deck && isPublishedSourceDeck(deck) && openFeedbackCount > 0 && (
          <DeckOpenFeedbackBanner
            openCount={openFeedbackCount}
            onOpenInbox={() => setFeedbackInboxOpen(true)}
          />
        )}

        {imported && (
          <DeckProvenanceBanner
            deck={deck}
            updateAvailable={updateAvailable}
            onReviewUpdate={() => setSyncOpen(true)}
          />
        )}

        {imported && (
          <PendingContributionsBanner
            pendingCount={pendingCount}
            onOpen={() => setPendingOutboxOpen(true)}
          />
        )}

        {editing ? (
          <DeckEditForm
            name={name}
            setName={setName}
            fieldNames={fieldNames}
            setFieldNames={setFieldNames}
            rate={rate}
            setRate={setRate}
            saving={saving}
            fieldsLocked={imported}
            onSubmit={handleUpdate}
            token={token}
            deckId={id}
            tagIds={deckTagIds}
            onTagIdsChange={setDeckTagIds}
            onCancel={() => {
              setEditing(false);
              setError("");
              setSuccessMessage("");
              if (token && id) {
                void getDeckTags(id, token)
                  .then((res) => setDeckTagIds(res.data.tags.map((t) => t.id)))
                  .catch(() => setDeckTagIds([]));
                setDeckTagsRefreshKey((k) => k + 1);
              }
              if (deck) {
                setName(deck.name);
                setFieldNames([...deck.fields]);
                setRate(deck.rate);
              }
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-0 [&>*]:min-w-0">
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 min-w-[10rem] flex-1">
                  <Label htmlFor="study-tag-filter">Study by fact tag</Label>
                  <select
                    id="study-tag-filter"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={studyTagId}
                    onChange={(e) => setStudyTagId(e.target.value)}
                  >
                    <option value="">All tags</option>
                    {studyTags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <CardSection
                deck={deck}
                cardTypography={cardTypography}
                nextCard={nextCard}
                nextCardFact={nextCardFact}
                loadingNextCard={loadingNextCard}
                cardError={cardError}
                cardSuccess={cardSuccess}
                tagFilterStats={displayedStudyStats}
                tagFilterStatsLoading={studyStatsLoading}
                onUpdateCard={handleUpdateCard}
                onHideCard={handleHideCard}
                onSaveFact={handleSaveFactFromCard}
                onReportFact={imported ? handleReportFact : undefined}
                onOfferSendEditToAuthor={imported ? handleOfferSendEditToAuthor : undefined}
                onRequestFact={fetchFactById}
                authToken={token}
                rescheduleSuggested={nextCardMeta?.reschedule_suggested}
                suggestedRescheduleDays={nextCardMeta?.suggested_reschedule_days}
                onReschedule={handleReschedule}
                onAddCardSuccess={handleAddCardSuccess}
                onDeleteCard={handleDeleteCard}
              />
            </div>
            <DeckInfoCard
              deck={deck}
              token={token}
              tagsRefreshKey={deckTagsRefreshKey}
              factsEditable={true}
              onEdit={() => {
                setEditing(true);
                setSuccessMessage("");
                if (token && id) {
                  void getDeckTags(id, token)
                    .then((res) => setDeckTagIds(res.data.tags.map((t) => t.id)))
                    .catch(() => setDeckTagIds([]));
                }
              }}
              onPublish={imported ? undefined : () => setPublishOpen(true)}
              onOpenFeedbackInbox={
                !imported && isPublishedSourceDeck(deck)
                  ? () => setFeedbackInboxOpen(true)
                  : undefined
              }
              onSuggestFieldRenames={imported ? () => setFieldRenameOpen(true) : undefined}
              onSuggestDeckTags={imported ? () => setDeckTagContributeOpen(true) : undefined}
              onOpenPendingContributions={
                imported ? () => setPendingOutboxOpen(true) : undefined
              }
              pendingContributionCount={imported ? pendingCount : 0}
              onOpenCardFonts={() => setCardFontsOpen(true)}
              onOpenAddFacts={() => setAddFactsOpen(true)}
              onOpenAllCards={() => setAllCardsOpen(true)}
              onBulkEditFacts={() => setBulkEditFactsOpen(true)}
              deleteConfirm={deleteConfirm}
              onDeleteConfirm={() => setDeleteConfirm(true)}
              onDeleteCancel={() => setDeleteConfirm(false)}
              onDelete={handleDelete}
            />
            {token && !imported && (
              <DeckPublishDialog
                open={publishOpen}
                onOpenChange={setPublishOpen}
                deck={deck}
                onPublished={async (result) => {
                  const firstPublish = !isPublishedSourceDeck(deck);
                  setDeck((d) =>
                    d
                      ? {
                          ...d,
                          published_version: result.published_version,
                          visibility: result.visibility,
                        }
                      : d
                  );
                  setSuccessMessage(
                    firstPublish
                      ? `Deck published as v${result.published_version}. Others can import using your deck ID below.`
                      : `Published v${result.published_version}. Importers can review and accept this update.`
                  );
                  await fetchDeck();
                }}
              />
            )}
            {token && imported && (
              <DeckSyncUpdatesModal
                open={syncOpen}
                onClose={() => setSyncOpen(false)}
                deck={deck}
                token={token}
                onSynced={async () => {
                  setSuccessMessage("Deck updated to latest version.");
                  await fetchDeck();
                  void refreshDeckUpdates();
                  await fetchFacts();
                  await handleGetNextCard(false);
                }}
              />
            )}
            {token && imported && feedbackSubmitFact && (
              <SubmitFactContributionModal
                open={feedbackSubmitOpen}
                onClose={() => {
                  setFeedbackSubmitOpen(false);
                  setFeedbackSubmitFact(null);
                }}
                deck={deck}
                fact={feedbackSubmitFact}
                kind={feedbackSubmitKind}
                token={token}
                onSubmitted={async (kind, result) => {
                  if (feedbackSubmitFact && id) {
                    if (kind === "edit" || kind === "add") {
                      removePendingContributionByFactId(id, feedbackSubmitFact.id);
                    }
                    appendSentContribution(id, {
                      kind,
                      factId: feedbackSubmitFact.id,
                      preview: previewFromEntries(feedbackSubmitFact.entries),
                      message: result.message,
                      contributionId: result.contributionId,
                    });
                    refreshPendingCount();
                  }
                  const messages: Record<FactContributionKind, string> = {
                    report: "Report sent to the deck author.",
                    edit: "Edit contribution sent to the deck author.",
                    add: "New-fact contribution sent to the deck author.",
                  };
                  setSuccessMessage(messages[kind]);
                }}
              />
            )}
            {token && imported && (
              <PendingContributionsOutboxModal
                open={pendingOutboxOpen}
                onClose={() => setPendingOutboxOpen(false)}
                deck={deck}
                token={token}
                factsById={Object.fromEntries(factsList.map((f) => [f.id, f]))}
                onChanged={refreshPendingCount}
                onSubmittedBatch={async (sentCount) => {
                  setSuccessMessage(
                    sentCount === 1
                      ? "Contribution sent to the deck author."
                      : `${sentCount} contributions sent to the deck author.`
                  );
                }}
              />
            )}
            {token && imported && (
              <SubmitFieldRenameContributionModal
                open={fieldRenameOpen}
                onClose={() => setFieldRenameOpen(false)}
                deck={deck}
                onStage={async (payload: StagedFieldRenameContribution) => {
                  recordPendingContribution("field_rename", {
                    proposedFields: payload.proposedFields,
                    preview: payload.proposedFields.join(" · "),
                    message: payload.message,
                  });
                  setSuccessMessage("Field rename added to Contributions (pending).");
                  setPendingOutboxOpen(true);
                }}
              />
            )}
            {token && imported && (
              <SubmitTagContributionModal
                open={deckTagContributeOpen}
                onClose={() => setDeckTagContributeOpen(false)}
                deck={deck}
                scope="deck"
                onStage={async (payload: StagedTagContribution) => {
                  recordPendingContribution("deck_tags", {
                    addTags: payload.addTags,
                    removeTags: payload.removeTags,
                    message: payload.message,
                  });
                  setSuccessMessage("Deck tag changes added to Contributions (pending).");
                  setPendingOutboxOpen(true);
                }}
              />
            )}
            {token && !imported && isPublishedSourceDeck(deck) && (
              <DeckFeedbackInboxModal
                open={feedbackInboxOpen}
                onClose={() => {
                  setFeedbackInboxOpen(false);
                  void refreshFeedbackCounts();
                }}
                deck={deck}
                token={token}
                onAccepted={async (detail) => {
                  await fetchFacts();
                  await fetchDeck();
                  await refreshFeedbackCounts();
                  if (detail?.published_version != null) {
                    setSuccessMessage(
                      `Contribution accepted and published as v${detail.published_version}. Importers can review and sync.`
                    );
                  }
                }}
              />
            )}
            <DeckCardFontDialog
              open={cardFontsOpen}
              onOpenChange={setCardFontsOpen}
              value={cardTypography}
              onChange={handleCardTypographyChange}
            />
            {deck && token && (
              <DeckAllCardsModal
                open={allCardsOpen}
                onOpenChange={setAllCardsOpen}
                deckId={deck.id}
                deckName={deck.name}
                token={token}
              />
            )}
            {bulkEditFactsOpen && deck && token && (
              <BulkEditFactsModal
                open={bulkEditFactsOpen}
                onClose={() => {
                  setBulkEditFactsOpen(false);
                  setDeleteFactId(null);
                  if (factQueryParam) {
                    const next = new URLSearchParams(searchParams);
                    next.delete("fact");
                    setSearchParams(next, { replace: true });
                    openedFactQueryRef.current = null;
                  }
                }}
                deck={deck}
                token={token}
                factsList={factsList}
                factsHasMore={factsHasMore}
                factsTotal={factsTotal}
                initialFactId={factQueryParam || null}
                onRefreshFacts={async () => {
                  // Facts only — avoid fetchDeck full-page loading (unmounts this modal and clears filters).
                  await fetchFacts();
                }}
                onFactSaved={
                  imported
                    ? (fact) =>
                        recordPendingContribution("edit", {
                          factId: fact.id,
                          entries: fact.entries,
                        })
                    : undefined
                }
                onDeleteFact={handleDeleteFact}
                deleteFactId={deleteFactId}
                setDeleteFactId={setDeleteFactId}
              />
            )}
            {addFactsOpen && deck && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-facts-modal-title"
              >
                <div
                  className="fixed inset-0 bg-black/50"
                  onClick={() => setAddFactsOpen(false)}
                  aria-hidden="true"
                />
                <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
                  <h2 id="add-facts-modal-title" className="text-lg font-semibold mb-4">
                    Add Facts{imported ? " (private overlay)" : ""}
                  </h2>
                  <AddFactsForm
                    deck={deck}
                    factRow={factRow}
                    setFactRow={setFactRow}
                    addFactOp={addFactOp}
                    setAddFactOp={setAddFactOp}
                    addFactSplit={addFactSplit}
                    setAddFactSplit={setAddFactSplit}
                    sibling={sibling}
                    setSibling={setSibling}
                    addingFacts={addingFacts}
                    addFactsError={addFactsError}
                    onSubmit={handleAddFacts}
                    onCancel={() => setAddFactsOpen(false)}
                    token={token}
                    factTagIds={addFactTagIds}
                    onFactTagIdsChange={setAddFactTagIds}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
