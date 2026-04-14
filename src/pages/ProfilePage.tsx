import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { request, type ProfileRes } from "@/lib/api";

export default function ProfilePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRes | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

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

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
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
            <Link to="/decks" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Deck
            </Link>
            <Link to="/profile" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Profile
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
      </div>
    </div>
  );
}
