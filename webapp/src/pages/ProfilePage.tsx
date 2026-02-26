import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
  const [createFieldNames, setCreateFieldNames] = useState<string[]>(["English", "Chinese"]);
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
    const fields = createFieldNames.map((s) => s.trim()).filter(Boolean);
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
      const body: CreateDeckReq = { name: createName.trim(), fields, rate: createRate };
      await request<CreateDeckRes>("/api/decks", { method: "POST", token, body: JSON.stringify(body) });
      setCreateOpen(false);
      setCreateName("");
      setCreateFieldNames(["English", "Chinese"]);
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
            <Link to="/profile" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Profile
            </Link>
            <Link to="/media" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Media
            </Link>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProfile ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : profile ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Username</dt>
                  <dd className="mt-0.5">{profile.data.username}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</dt>
                  <dd className="mt-0.5">{profile.data.email}</dd>
                </div>
                {profile.meta?.created_at && (
                  <div>
                    <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Member since</dt>
                    <dd className="mt-0.5">{formatDate(profile.meta.created_at)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-muted-foreground">Could not load profile.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex-1" />
            <CardTitle className="text-center flex-1">List of Decks</CardTitle>
            <div className="flex-1 flex justify-end">
              <DropdownMenu align="end">
                {createOpen ? (
                  <DropdownMenuItem onClick={() => { setCreateOpen(false); setCreateError(""); setCreateSuccess(""); }}>Cancel</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => { setCreateOpen(true); setCreateError(""); setCreateSuccess(""); }}>Create deck</DropdownMenuItem>
                )}
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            {deleteSuccess && <p className="text-sm text-green-600">{deleteSuccess}</p>}
            {createSuccess && <p className="text-sm text-green-600">{createSuccess}</p>}
            {createOpen && (
              <form onSubmit={handleCreateDeck} className="rounded-lg border p-4 space-y-4">
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <div className="space-y-2">
                  <Label htmlFor="create-name">Name</Label>
                  <Input id="create-name" value={createName} onChange={(e) => setCreateName(e.target.value)} required placeholder="My deck" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Fields</p>
                  <p className="text-xs text-muted-foreground">One box per field (at least 2).</p>
                  {createFieldNames.map((value, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Label htmlFor={`create-field-${i}`} className="sr-only">Field {i + 1}</Label>
                      <Input
                        id={`create-field-${i}`}
                        value={value}
                        onChange={(e) => {
                          const next = [...createFieldNames];
                          next[i] = e.target.value;
                          setCreateFieldNames(next);
                        }}
                        placeholder={`Field ${i + 1}`}
                      />
                      {createFieldNames.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive shrink-0"
                          onClick={() => setCreateFieldNames(createFieldNames.filter((_, j) => j !== i))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setCreateFieldNames([...createFieldNames, ""])}>
                    Add field
                  </Button>
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
              <ul className="divide-y rounded-md border">
                {decks.map((d) => (
                  <li key={d.id} className="px-3 py-3 first:pt-3 hover:bg-muted/50">
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
                      <DropdownMenu align="end">
                        <DropdownMenuItem onClick={() => navigate(`/decks/${d.id}/edit`)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => { setDeleteId(d.id); setDeleteError(""); setDeleteSuccess(""); }}>Delete</DropdownMenuItem>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={deleteId !== null}
          onOpenChange={(open) => !open && setDeleteId(null)}
          title="Delete deck?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={() => deleteId && handleDeleteDeck(deleteId)}
        >
          {deleteId && (
            <>Are you sure you want to delete &quot;{decks.find((d) => d.id === deleteId)?.name ?? "this deck"}&quot;? This cannot be undone.</>
          )}
        </Dialog>
      </div>
    </div>
  );
}
