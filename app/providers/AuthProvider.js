"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { AuthContext } from "../contexts";

const STORAGE_KEY = "authUser";

export default function AuthProvider({ children }) {
  // 1) প্রথম রেন্ডারের আগেই localStorage থেকে পড়া (Blink বন্ধ)
  const [auth, setAuth] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 2) হাইড্রেশন গেট — ক্লায়েন্ট প্রস্তুত না হওয়া পর্যন্ত UI রেন্ডার করবো না
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // auth বদলালে localStorage আপডেট
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to write auth to localStorage", e);
    }
  }, [auth]);

  // বহুউইন্ডো/ট্যাব সিঙ্ক
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        try {
          setAuth(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setAuth(null);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((user) => setAuth(user), []);
  const logout = useCallback(() => setAuth(null), []);

  const value = useMemo(
    () => ({ auth, setAuth, login, logout, loading: !ready }),
    [auth, login, logout, ready]
  );

  // হাইড্রেশন শেষ না হওয়া পর্যন্ত কিছুই রেন্ডার করবো না → blink বন্ধ
  if (!ready) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
