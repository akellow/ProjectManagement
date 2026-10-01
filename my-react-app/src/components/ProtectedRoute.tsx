import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, isAuthLoading } = useAuth()

  if (isAuthLoading) {
    return null
  }

  // If no user session, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}


