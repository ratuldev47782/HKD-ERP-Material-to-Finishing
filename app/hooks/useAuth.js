// app/hooks/useAuth.js
"use client";

import { useContext } from "react";
import { AuthContext } from "../contexts";

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");

  const { auth, setAuth, login, logout, loading } = ctx;
  return { auth, setAuth, login, logout, loading };
};
