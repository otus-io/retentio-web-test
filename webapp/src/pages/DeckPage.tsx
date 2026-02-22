import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  request,
  type AddFactOperation,
  type AddFactReq,
  type AddFactRes,
  type DeckItem,
  type FactItem,
  type GetDeckRes,
  type GetFactsRes,
  type GetNextCardRes,
  type GetCardsRes,
  type UpdateDeckReq,
  type UpdateDeckRes,
  type UpdateCardReq,
  type UpdateCardRes,
  type UpdateFactReq,
} from "@/lib/api";
import {
  DeckHeader,
  DeckEditForm,
  DeckInfoCard,
} from "@/components/deck";
import { CardSection } from "@/components/card";
import { AddFactsForm, FactsList } from "@/components/facts";

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
  const [addingFacts, setAddingFacts] = useState(false);
  const [addFactsError, setAddFactsError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [factsList, setFactsList] = useState<FactItem[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editingFactValues, setEditingFactValues] = useState<string[]>([]);
  const [factError, setFactError] = useState("");
  const [factSuccess, setFactSuccess] = useState("");
  const [deleteFactId, setDeleteFactId] = useState<string | null>(null);
  const [cardStats, setCardStats] = useState<GetCardsRes["data"] | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [nextCard, setNextCard] = useState<GetNextCardRes["data"] | null>(null);
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
      setDeck(res.data);
      setName(res.data.name);
      setFieldNames([...res.data.field]);
      setSibling(res.data.templates.length === 2);
      setRate(res.data.rate);
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
    if (!keepCurrentCard) setCardSuccess("");
    setLoadingNextCard(true);
    if (!keepCurrentCard) {
      setNextCard(null);
      setNextCardFact(null);
    }
    try {
      const res = await request<GetNextCardRes>(`/api/decks/${id}/card`, { token });
      setNextCard(res.data);
      const factRes = await request<{ data: { fact: FactItem } }>(
        `/api/decks/${id}/facts/${res.data.card.fact_id}`,
        { token }
      );
      setNextCardFact(factRes.data.fact);
    } catch (e) {
      setCardError(e instanceof Error ? e.message : "No card or failed to load");
      setNextCard(null);
      setNextCardFact(null);
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
    if (deck) setFactsRows([deck.field.map(() => "")]);
  }, [deck?.id]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id) return;
    const fields = fieldNames.map((s) => s.trim()).filter(Boolean);
    const templates: number[][] = sibling ? [[0, 1], [1, 0]] : [[0, 1]];
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
      const body: UpdateDeckReq = { name: name.trim() || undefined, fields, templates, rate };
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
    const bad = rows.find((r) => r.length !== deck!.field.length || r.some((s) => !s.trim()));
    if (bad) {
      setAddFactsError(
        `Each row must have ${deck.field.length} non-empty values (${deck.field.join(", ")}).`
      );
      return;
    }
    setAddFactsError("");
    setSuccessMessage("");
    setAddingFacts(true);
    try {
      const facts = rows.map((row) => row.map((s) => s.trim()));
      const body: AddFactReq = { facts };
      await request<AddFactRes>(`/api/decks/${id}/facts/${addFactOp}`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setFactsRows(deck ? [deck.field.map(() => "")] : []);
      setSuccessMessage("Facts added.");
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
    if (values.length !== deck.field.length || values.some((v) => !v)) {
      setFactError(`Each field is required. Expected ${deck.field.length} values.`);
      return;
    }
    setFactError("");
    setFactSuccess("");
    try {
      const body: UpdateFactReq = values;
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
    if (values.length !== deck.field.length) {
      throw new Error(`Must have ${deck.field.length} values`);
    }
    const body: UpdateFactReq = values;
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
      await handleGetNextCard(true);
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
            sibling={sibling}
            setSibling={setSibling}
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
              addingFacts={addingFacts}
              addFactsError={addFactsError}
              onSubmit={handleAddFacts}
            />
            <FactsList
              deck={deck}
              factsList={factsList}
              loadingFacts={loadingFacts}
              factError={factError}
              factSuccess={factSuccess}
              editingFactId={editingFactId}
              editingFactValues={editingFactValues}
              setEditingFactId={setEditingFactId}
              setEditingFactValues={setEditingFactValues}
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
