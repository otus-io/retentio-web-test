import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  request,
  uploadMultipart,
  buildTemplateForRequest,
  type AddFactOperation,
  type AddFactReq,
  type AddFactRes,
  type DeckItem,
  type FactItem,
  type GetDeckRes,
  type GetFactsRes,
  type GetNextCardRes,
  type GetCardsRes,
  type RescheduleReq,
  type RescheduleRes,
  type UpdateDeckReq,
  type UpdateDeckRes,
  type UpdateCardReq,
  type UpdateCardRes,
  type UpdateFactReq,
  type UploadMediaRes,
} from "@/lib/api";
import {
  DeckHeader,
  DeckEditForm,
  DeckInfoCard,
} from "@/components/deck";
import { CardSection } from "@/components/card";
import { AddFactsForm, FactsList, type FactMediaEntry } from "@/components/facts";

export default function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const { token, logout } = useAuth();
  const navigate = useNavigate();
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
  const [factsRows, setFactsRows] = useState<string[][]>([]);
  const [addFactOp, setAddFactOp] = useState<AddFactOperation>("append");
  const [addFactSplit, setAddFactSplit] = useState(1);
  const [addingFacts, setAddingFacts] = useState(false);
  const [addFactsError, setAddFactsError] = useState("");
  const [mediaFiles, setMediaFiles] = useState<FactMediaEntry[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [factsList, setFactsList] = useState<FactItem[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editingFactValues, setEditingFactValues] = useState<string[]>([]);
  const [editingFactSplit, setEditingFactSplit] = useState(1);
  const [editingFactSibling, setEditingFactSibling] = useState(false);
  const [factError, setFactError] = useState("");
  const [factSuccess, setFactSuccess] = useState("");
  const [deleteFactId, setDeleteFactId] = useState<string | null>(null);
  const [cardStats, setCardStats] = useState<GetCardsRes["data"] | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [nextCard, setNextCard] = useState<GetNextCardRes["data"] | null>(null);
  const [nextCardMeta, setNextCardMeta] = useState<GetNextCardRes["meta"] | null>(null);
  const [nextCardFact, setNextCardFact] = useState<FactItem | null>(null);
  const [loadingNextCard, setLoadingNextCard] = useState(false);
  const [cardError, setCardError] = useState("");
  const [cardSuccess, setCardSuccess] = useState("");

  const fetchDeck = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError("");
    try {
      const res = await request<GetDeckRes>(`/api/decks/${id}`, { token });
      const data = res.data;
      setDeck(data);
      setName(data.name);
      setFieldNames([...data.field]);
      setRate(data.rate);
      setFactsRows([(data.field ?? []).map(() => "")]);
      setAddFactSplit(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deck");
      setDeck(null);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  const fetchFacts = useCallback(async () => {
    if (!token || !id) return;
    setLoadingFacts(true);
    try {
      const res = await request<GetFactsRes>(`/api/decks/${id}/facts`, { token });
      setFactsList(res.data.facts);
    } catch {
      setFactsList([]);
    } finally {
      setLoadingFacts(false);
    }
  }, [token, id]);

  const fetchCards = useCallback(async () => {
    if (!token || !id) return;
    setLoadingCards(true);
    try {
      const res = await request<GetCardsRes>(`/api/decks/${id}/cards`, { token });
      setCardStats(res.data);
    } catch {
      setCardStats(null);
    } finally {
      setLoadingCards(false);
    }
  }, [token, id]);

  const handleGetNextCard = useCallback(async (keepCurrentCard?: boolean) => {
    if (!token || !id) return;
    setCardError("");
    setLoadingNextCard(true);
    if (!keepCurrentCard) {
      setNextCard(null);
      setNextCardFact(null);
    }
    try {
      const res = await request<GetNextCardRes>(`/api/decks/${id}/card`, { token });
      setNextCard(res.data);
      setNextCardMeta(res.meta ?? null);
      const factRes = await request<{ data: { fact: FactItem } }>(
        `/api/decks/${id}/facts/${res.data.card.fact_id}`,
        { token }
      );
      setNextCardFact(factRes.data.fact);
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "No card or failed to load");
      setNextCard(null);
      setNextCardFact(null);
      setNextCardMeta(null);
    } finally {
      setLoadingNextCard(false);
    }
  }, [token, id]);

  useEffect(() => {
    if (deck && !editing) {
      fetchFacts();
      fetchCards();
    }
  }, [deck, editing, fetchFacts, fetchCards]);

  useEffect(() => {
    if (deck && !editing && token && id) {
      handleGetNextCard();
    }
  }, [deck, editing, token, id, handleGetNextCard]);

  useEffect(() => {
    if (deck) {
      setFactsRows([(deck.field ?? []).map(() => "")]);
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
    if (fields.length < 2) {
      setError("At least two fields required");
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
    const rows = factsRows.filter((row) => row.some((s) => s.trim() !== ""));
    if (rows.length === 0) {
      setAddFactsError("Add at least one fact.");
      return;
    }
    const normalized: string[][] = [];
    for (const r of rows) {
      let fields = r.map((s) => s.trim());
      while (fields.length && !fields[fields.length - 1]) fields = fields.slice(0, -1);
      if (fields.length === 0) continue;
      normalized.push(fields);
    }
    if (normalized.length === 0) {
      setAddFactsError("At least one field is required.");
      return;
    }
    setAddFactsError("");
    setSuccessMessage("");
    setAddingFacts(true);
    try {
      const uploadedMarkers: { id: string; type: "image" | "audio" }[] = [];
      if (mediaFiles.length > 0 && token) {
        for (const entry of mediaFiles) {
          const formData = new FormData();
          formData.append("file", entry.file);
          const res = await uploadMultipart("/api/media", formData, token) as UploadMediaRes;
          const id = res?.data?.id != null ? String(res.data.id).trim() : "";
          if (!id) throw new Error("Upload response missing media id");
          uploadedMarkers.push({ id, type: entry.type });
        }
      }
      const facts = normalized.map((fields) => [...fields]);
      if (uploadedMarkers.length > 0 && facts.length > 0) {
        const mediaEntries = uploadedMarkers.map((m) => `[${m.type}:${m.id}]`);
        for (const fact of facts) {
          fact.splice(1, 0, ...mediaEntries);
        }
      }
      const body: AddFactReq = {
        facts: facts.map((entries) => ({ entries })),
        ...(buildTemplateForRequest(facts[0]?.length ?? 0, addFactSplit, sibling)),
      };
      await request<AddFactRes>(`/api/decks/${id}/facts/${addFactOp}`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setFactsRows(deck ? [deck.field.map(() => "")] : []);
      setAddFactSplit(1);
      setMediaFiles([]);
      setSuccessMessage(mediaFiles.length > 0 ? "Facts and media added." : "Facts added.");
      await fetchDeck();
      await fetchFacts();
    } catch (e) {
      setAddFactsError(e instanceof Error ? e.message : "Add facts failed");
      setSuccessMessage("");
    } finally {
      setAddingFacts(false);
    }
  }

  async function handleUpdateFact(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id || !editingFactId || !deck) return;
    const values = editingFactValues.map((s) => s.trim());
    if (values.length === 0 || values.some((v) => !v)) {
      setFactError("Each field is required.");
      return;
    }
    setFactError("");
    setFactSuccess("");
    try {
      const body: UpdateFactReq = { entries: values };
      await request<unknown>(`/api/decks/${id}/facts/${editingFactId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setEditingFactId(null);
      setEditingFactValues([]);
      setFactSuccess("Fact updated.");
      await fetchFacts();
      await fetchDeck();
    } catch (e) {
      setFactError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleSaveFactFromCard(factId: string, values: string[]) {
    if (!token || !id || !deck) return;
    if (values.length === 0 || values.some((v) => !v)) {
      throw new Error("All fields required");
    }
    const body: UpdateFactReq = { entries: values };
    await request<unknown>(`/api/decks/${id}/facts/${factId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    setFactSuccess("Fact updated.");
    await fetchFacts();
    await fetchDeck();
  }

  async function handleDeleteFact(factId: string) {
    if (!token || !id) return;
    setFactError("");
    setFactSuccess("");
    try {
      await request(`/api/decks/${id}/facts/${factId}`, { method: "DELETE", token });
      setDeleteFactId(null);
      setFactSuccess("Fact deleted.");
      await fetchFacts();
      await fetchDeck();
    } catch (e) {
      setFactError(e instanceof Error ? e.message : "Delete failed");
      setDeleteFactId(null);
    }
  }

  async function handleUpdateCard(intervalSeconds: number) {
    if (!token || !id || !nextCard) return;
    setCardError("");
    try {
      const lastReview = Math.floor(Date.now() / 1000);
      const body: UpdateCardReq = { card_id: nextCard.card.id, last_review: lastReview, interval: intervalSeconds };
      await request<UpdateCardRes>(`/api/decks/${id}/card`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setCardSuccess("Card reviewed.");
      await fetchCards();
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
      await fetchCards();
      await handleGetNextCard(false);
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "Hide failed");
    }
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
      await fetchCards();
      await handleGetNextCard(false);
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
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
              cardStats={cardStats}
              loadingCards={loadingCards}
              nextCard={nextCard}
              nextCardFact={nextCardFact}
              loadingNextCard={loadingNextCard}
              cardError={cardError}
              cardSuccess={cardSuccess}
              onUpdateCard={handleUpdateCard}
              onHideCard={handleHideCard}
              onSaveFact={handleSaveFactFromCard}
              authToken={token}
              rescheduleSuggested={nextCardMeta?.reschedule_suggested}
              suggestedRescheduleDays={nextCardMeta?.suggested_reschedule_days}
              onReschedule={handleReschedule}
            />
            <DeckInfoCard
              deck={deck}
              onEdit={() => {
                setEditing(true);
                setSuccessMessage("");
              }}
              deleteConfirm={deleteConfirm}
              onDeleteConfirm={() => setDeleteConfirm(true)}
              onDeleteCancel={() => setDeleteConfirm(false)}
              onDelete={handleDelete}
            />
            <AddFactsForm
              deck={deck}
              factsRows={factsRows}
              setFactsRows={setFactsRows}
              addFactOp={addFactOp}
              setAddFactOp={setAddFactOp}
              addFactSplit={addFactSplit}
              setAddFactSplit={setAddFactSplit}
              sibling={sibling}
              setSibling={setSibling}
              addingFacts={addingFacts}
              addFactsError={addFactsError}
              onSubmit={handleAddFacts}
              mediaFiles={mediaFiles}
              setMediaFiles={setMediaFiles}
            />
            <FactsList
              deck={deck}
              factsList={factsList}
              loadingFacts={loadingFacts}
              factError={factError}
              factSuccess={factSuccess}
              editingFactId={editingFactId}
              editingFactValues={editingFactValues}
              editingFactSplit={editingFactSplit}
              editingFactSibling={editingFactSibling}
              setEditingFactId={setEditingFactId}
              setEditingFactValues={setEditingFactValues}
              setEditingFactSplit={setEditingFactSplit}
              setEditingFactSibling={setEditingFactSibling}
              setFactError={setFactError}
              onUpdateFact={handleUpdateFact}
              onDeleteFact={handleDeleteFact}
              deleteFactId={deleteFactId}
              setDeleteFactId={setDeleteFactId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
