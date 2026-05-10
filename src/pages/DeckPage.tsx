import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  request,
  fetchDeckFactsPage,
  uploadMultipart,
  buildTemplateForRequest,
  validateAddFactBody,
  type AddFactOperation,
  type AddFactReq,
  type AddFactRes,
  type DeckItem,
  type Entry,
  type FactItem,
  type GetDeckRes,
  type GetNextCardRes,
  type NextCardItem,
  type RescheduleReq,
  type RescheduleRes,
  type UpdateDeckReq,
  type UpdateDeckRes,
  type UpdateCardReq,
  type UpdateCardRes,
  type UpdateFactReq,
  type UploadMediaRes,
  fileLooksLikeJson,
} from "@/lib/api";
import {
  DeckHeader,
  DeckEditForm,
  DeckInfoCard,
  DeckCardFontDialog,
  DeckAllCardsModal,
} from "@/components/deck";
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

export default function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  /** Ignore async results after navigating to another deck (avoids stale UI). */
  const routeDeckIdRef = useRef(id);
  routeDeckIdRef.current = id;
  const [deck, setDeck] = useState<DeckItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [sibling, setSibling] = useState(false);
  const [rate, setRate] = useState(20);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [factRow, setFactRow] = useState<AddFactEntry[]>([]);
  const [addFactOp, setAddFactOp] = useState<AddFactOperation>("append");
  const [addFactSplit, setAddFactSplit] = useState(1);
  const [addingFacts, setAddingFacts] = useState(false);
  const [addFactsError, setAddFactsError] = useState("");
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
  const [addFactsOpen, setAddFactsOpen] = useState(false);
  const [bulkEditFactsOpen, setBulkEditFactsOpen] = useState(false);
  const [cardFontsOpen, setCardFontsOpen] = useState(false);
  const [allCardsOpen, setAllCardsOpen] = useState(false);
  const [cardTypography, setCardTypography] = useState<DeckCardSidesTypography>(() =>
    id ? loadDeckCardSidesTypography(id) : DECK_CARD_TYPOGRAPHY_DEFAULTS
  );

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
    setError("");
    setEditing(false);
    setSuccessMessage("");
    setCardSuccess("");
    setBulkEditFactsOpen(false);
    setAllCardsOpen(false);
    setFactsHasMore(false);
    setFactsTotal(null);
  }, [id]);

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
    setLoading(true);
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
    } catch (e) {
      if (routeDeckIdRef.current !== targetDeckId) return;
      setError(e instanceof Error ? e.message : "Failed to load deck");
      setDeck(null);
    } finally {
      if (routeDeckIdRef.current === targetDeckId) setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

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
    if (!keepCurrentCard) {
      setNextCard(null);
      setNextCardFact(null);
    }
    try {
      const res = await request<GetNextCardRes>(`/api/decks/${id}/card`, { token });
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
  }, [token, id]);

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
      const body: UpdateDeckReq = { name: name.trim() || undefined, fields, rate };
      await request<UpdateDeckRes>(`/api/decks/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setEditing(false);
      setSuccessMessage("Deck updated.");
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
        facts: [{ entries }],
        ...buildTemplateForRequest(row.length, addFactSplit, sibling),
      };
      await request<AddFactRes>(`/api/decks/${id}/facts/${addFactOp}`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setFactRow(makeInitialFactRow(deck));
      setAddFactSplit(1);
      const hasMedia = row.some((e) => e.media.length > 0);
      setSuccessMessage(hasMedia ? "Facts and media added." : "Facts added.");
      setAddFactsOpen(false);
      await fetchDeck();
      await fetchFacts();
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
    const body: UpdateFactReq = { entries };
    await request<unknown>(`/api/decks/${id}/facts/${factId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
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
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleAddCardSuccess() {
    setCardSuccess("Card added.");
    await fetchFacts();
    await handleGetNextCard(false);
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

  return (
    <div className="min-h-screen w-full p-4 md:p-6">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <DeckHeader onLogout={handleLogout} />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

        {editing ? (
          <DeckEditForm
            name={name}
            setName={setName}
            fieldNames={fieldNames}
            setFieldNames={setFieldNames}
            rate={rate}
            setRate={setRate}
            saving={saving}
            onSubmit={handleUpdate}
            onCancel={() => {
              setEditing(false);
              setError("");
              setSuccessMessage("");
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-0 [&>*]:min-w-0">
            <CardSection
              deck={deck}
              cardTypography={cardTypography}
              nextCard={nextCard}
              nextCardFact={nextCardFact}
              loadingNextCard={loadingNextCard}
              cardError={cardError}
              cardSuccess={cardSuccess}
              onUpdateCard={handleUpdateCard}
              onHideCard={handleHideCard}
              onSaveFact={handleSaveFactFromCard}
              onRequestFact={fetchFactById}
              authToken={token}
              rescheduleSuggested={nextCardMeta?.reschedule_suggested}
              suggestedRescheduleDays={nextCardMeta?.suggested_reschedule_days}
              onReschedule={handleReschedule}
              onAddCardSuccess={handleAddCardSuccess}
              onDeleteCard={handleDeleteCard}
            />
            <DeckInfoCard
              deck={deck}
              onEdit={() => {
                setEditing(true);
                setSuccessMessage("");
              }}
              onOpenCardFonts={() => setCardFontsOpen(true)}
              onOpenAddFacts={() => setAddFactsOpen(true)}
              onOpenAllCards={() => setAllCardsOpen(true)}
              onBulkEditFacts={() => setBulkEditFactsOpen(true)}
              deleteConfirm={deleteConfirm}
              onDeleteConfirm={() => setDeleteConfirm(true)}
              onDeleteCancel={() => setDeleteConfirm(false)}
              onDelete={handleDelete}
            />
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
                }}
                deck={deck}
                token={token}
                factsList={factsList}
                factsHasMore={factsHasMore}
                factsTotal={factsTotal}
                onRefreshFacts={async () => {
                  await fetchDeck();
                  await fetchFacts();
                }}
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
                    Add Facts
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
