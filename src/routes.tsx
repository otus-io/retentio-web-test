import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DeckEditPage from "@/pages/DeckEditPage";
import DeckPage from "@/pages/DeckPage";
import HomePage from "@/pages/HomePage";
import ResearchPage from "@/pages/ResearchPage";
import LoginPage from "@/pages/LoginPage";
import MediaPage from "@/pages/MediaPage";
import ProfilePage from "@/pages/ProfilePage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import ManualPage from "@/pages/ManualPage";
import DecksListPage from "@/pages/DecksListPage";
import UploadDeckPage from "@/pages/UploadDeckPage";
import CatalogDeckPage from "@/pages/CatalogDeckPage";
import TagsPage from "@/pages/TagsPage";
import QualityPage from "@/pages/QualityPage";
import ConfidencePage from "@/pages/ConfidencePage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, authReady } = useAuth();
  const location = useLocation();
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Checking session…
      </div>
    );
  }
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/media",
    element: (
      <ProtectedRoute>
        <MediaPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/tags",
    element: (
      <ProtectedRoute>
        <TagsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/quality",
    element: (
      <ProtectedRoute>
        <QualityPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/confidence",
    element: (
      <ProtectedRoute>
        <ConfidencePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/decks",
    element: (
      <ProtectedRoute>
        <DecksListPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/decks/upload",
    element: (
      <ProtectedRoute>
        <UploadDeckPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/decks/:id/edit",
    element: (
      <ProtectedRoute>
        <DeckEditPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/decks/:id",
    element: (
      <ProtectedRoute>
        <DeckPage />
      </ProtectedRoute>
    ),
  },
  { path: "/", element: <HomePage /> },
  { path: "/catalog/:id", element: <CatalogDeckPage /> },
  { path: "/research", element: <ResearchPage /> },
  { path: "/manual", element: <ManualPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
];
