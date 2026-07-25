import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyEmail } from "@/lib/api";

type Status = "idle" | "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();
  const [status, setStatus] = useState<Status>(token ? "idle" : "error");
  const [error, setError] = useState(
    token ? "" : "Verification link is missing or invalid."
  );

  async function runVerify() {
    if (!token) {
      setStatus("error");
      setError("Verification link is missing or invalid.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      await verifyEmail(token);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "verification failed");
    }
  }

  useEffect(() => {
    if (!token) return;
    void runVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verify once on mount for token
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/80 bg-card/95 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="text-xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
        >
          Retentio
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Verify email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "loading" || status === "idle" ? (
              <p className="text-sm text-muted-foreground">Verifying your email…</p>
            ) : status === "success" ? (
              <p className="text-sm text-muted-foreground">
                Email verified successfully.
              </p>
            ) : (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {status === "error" && token ? (
              <Button type="button" className="w-full" onClick={() => void runVerify()}>
                Retry
              </Button>
            ) : null}
            <p className="text-sm text-muted-foreground text-center">
              <Link to="/login" className="text-primary underline">
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
