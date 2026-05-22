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
import ManualPage from "@/pages/ManualPage";
import DecksListPage from "@/pages/DecksListPage";
import UploadDeckPage from "@/pages/UploadDeckPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
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
  { path: "/research", element: <ResearchPage /> },
  { path: "/manual", element: <ManualPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
];
