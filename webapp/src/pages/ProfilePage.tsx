import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  request,
  type CreateDeckReq,
  type CreateDeckRes,
  type DeckItem,
  type GetDecksRes,
  type ProfileRes,
} from "@/lib/api";

export default function ProfilePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRes | null>(null);
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createFields, setCreateFields] = useState("English, Chinese");
  const [createSibling, setCreateSibling] = useState(false);
  const [createRate, setCreateRate] = useState(20);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoadingProfile(true);
    try {
      const res = await request<ProfileRes>("/api/profile", { token });
      setProfile(res);
    } catch {
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [token]);

  const fetchDecks = useCallback(async () => {
    if (!token) return;
    setLoadingDecks(true);
    try {
      const res = await request<GetDecksRes>("/api/decks", { token });
      setDecks(res.data.decks);
    } catch {
      setDecks([]);
    } finally {
      setLoadingDecks(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleCreateDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const fields = createFields.split(",").map((s) => s.trim()).filter(Boolean);
    const templates: number[][] = createSibling ? [[0, 1], [1, 0]] : [[0, 1]];
    if (fields.length < 2) {
      setCreateError("At least two fields required");
      return;
    }
    if (createRate < 1 || createRate > 1000) {
      setCreateError("Rate must be between 1 and 1000");
      return;
    }
    setCreateError("");
    setCreating(true);
    try {
      const body: CreateDeckReq = { name: createName.trim(), fields, templates, rate: createRate };
      await request<CreateDeckRes>("/api/decks", { method: "POST", token, body: JSON.stringify(body) });
      setCreateOpen(false);
      setCreateName("");
      setCreateFields("English, Chinese");
      setCreateSibling(false);
      setCreateRate(20);
      setCreateSuccess("Deck created.");
      setDeleteSuccess("");
      await fetchDecks();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
      setCreateSuccess("");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteDeck(deckId: string) {
    if (!token) return;
    setDeleteError("");
    setDeleteSuccess("");
    try {
      await request(`/api/decks/${deckId}`, { method: "DELETE", token });
      setDeleteId(null);
      setDeleteSuccess("Deck deleted.");
      setCreateSuccess("");
      await fetchDecks();
    } catch (e) {
      setDeleteId(null);
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
      setDeleteSuccess("");
    }
  }

  function formatDate(s: string) {
    try {
      return new Date(s).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return s;
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Retentio</h1>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/profile">Profile</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/media">Media</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProfile ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : profile ? (
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">Username</dt>
                  <dd>{profile.data.username}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Email</dt>
                  <dd>{profile.data.email}</dd>
                </div>
                {profile.meta?.created_at && (
                  <div>
                    <dt className="font-medium text-muted-foreground">Member since</dt>
                    <dd>{formatDate(profile.meta.created_at)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-muted-foreground">Could not load profile.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Decks</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(!createOpen); setCreateError(""); setCreateSuccess(""); }}>
              {createOpen ? "Cancel" : "Create deck"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            {deleteSuccess && <p className="text-sm text-green-600">{deleteSuccess}</p>}
            {createSuccess && <p className="text-sm text-green-600">{createSuccess}</p>}
            {createOpen && (
              <form onSubmit={handleCreateDeck} className="rounded-lg border p-4 space-y-3">
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <div className="space-y-2">
                  <Label htmlFor="create-name">Name</Label>
                  <Input id="create-name" value={createName} onChange={(e) => setCreateName(e.target.value)} required placeholder="My deck" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-fields">Fields (comma-separated)</Label>
                  <Input id="create-fields" value={createFields} onChange={(e) => setCreateFields(e.target.value)} placeholder="English, Chinese" />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="create-sibling"
                    type="checkbox"
                    checked={createSibling}
                    onChange={(e) => setCreateSibling(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="create-sibling" className="font-normal cursor-pointer">Sibling</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-rate">Rate (1–1000)</Label>
                  <Input id="create-rate" type="number" min={1} max={1000} value={createRate} onChange={(e) => setCreateRate(parseInt(e.target.value, 10) || 20)} />
                </div>
                <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
              </form>
            )}
            {loadingDecks ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : decks.length === 0 ? (
              <p className="text-muted-foreground">No decks yet. Create one above.</p>
            ) : (
              <ul className="divide-y">
                {decks.map((d) => (
                  <li key={d.id} className="py-3 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          <Link to={`/decks/${d.id}`} className="text-primary hover:underline">{d.name}</Link>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {d.stats.facts_count} facts · {d.stats.cards_count} cards
                          {d.stats.due_cards > 0 && ` · ${d.stats.due_cards} due`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/decks/${d.id}`}>Edit</Link>
                        </Button>
                        {deleteId === d.id ? (
                          <>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteDeck(d.id)}>Confirm</Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setDeleteId(d.id); setDeleteError(""); setDeleteSuccess(""); }}>Delete</Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
