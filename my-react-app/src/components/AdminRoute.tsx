import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const role = user?.app_metadata?.role;

  return role === "admin" || role === "superadmin"
    ? children
    : <Navigate to="/dashboard" replace />;
}
