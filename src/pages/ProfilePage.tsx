import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { request, resendVerification, type ProfileRes } from "@/lib/api";

export default function ProfilePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRes | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendError, setResendError] = useState("");

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

  async function handleResend() {
    const email = profile?.data.email?.trim();
    if (!email) return;
    setResendMsg("");
    setResendError("");
    setResending(true);
    try {
      await resendVerification(email);
      setResendMsg(
        "If the email is unverified, a verification link has been sent."
      );
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "request failed");
    } finally {
      setResending(false);
    }
  }

  function formatDate(s: string) {
    try {
      return new Date(s).toLocaleDateString(undefined, {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return s;
    }
  }

  const emailUnverified =
    !!profile && profile.data.email_verified === false && !!profile.data.email;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Retentio</h1>
          <nav className="flex items-center gap-2">
            <Link to="/decks" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Deck
            </Link>
            <Link to="/tags" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Tags
            </Link>
            <Link to="/media" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Media
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
              <div className="space-y-4">
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
                {emailUnverified && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <p className="text-sm text-muted-foreground">
                      Your email is not verified yet. You can still use the app.
                    </p>
                    {resendError && (
                      <p className="text-sm text-destructive">{resendError}</p>
                    )}
                    {resendMsg && (
                      <p className="text-sm text-muted-foreground">{resendMsg}</p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resending}
                      onClick={() => void handleResend()}
                    >
                      {resending ? "Sending…" : "Resend verification email"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Could not load profile.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
