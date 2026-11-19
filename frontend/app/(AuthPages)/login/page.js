// frontend/app/(AuthPages)/login/page.js

"use client";

import { useAuth } from "@/app/provider/AuthProvider";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const IconUser = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4.5 20.25a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconLock = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10.5V7.5a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fieldWrapClass =
    "flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-700 focus-within:border-teal-700";
  const inputBareClass =
    "w-full bg-transparent py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed";

  async function onSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const formData = new FormData(e.currentTarget);
      await login(formData.get("user_name"), formData.get("password"));
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="h-screen overflow-hidden flex items-center justify-center bg-zinc-100 px-4 py-3">
      <div className="bg-white  rounded-md w-full max-w-4xl h-full max-h-[640px] border border-zinc-300 flex flex-col md:flex-row overflow-hidden">

        {/* LEFT: Illustration */}
        <div className="hidden md:flex w-1/2 items-center justify-center bg-zinc-50 p-8">
          <Image
            src="/Computer login-amico.svg"
            alt="Login illustration"
            width={420}
            height={420}
            className="w-full h-auto max-w-sm"
            priority
          />
        </div>

        {/* RIGHT: Form */}
        <div className="w-full md:w-1/2 flex flex-col justify-center min-h-0 px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Image
              src="/HKD_LOGO.png"
              alt="HKD Outdoor Innovations Ltd. logo"
              width={52}
              height={52}
              className="w-12 h-12 object-contain shrink-0"
              priority
            />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-zinc-800 leading-tight tracking-tight">
                HKD OUTDOOR INNOVATIONS LTD.
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">Sign in to your account</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="user_name" className="block text-xs font-medium text-zinc-700 mb-1">
                User Name
              </label>
              <div className={fieldWrapClass}>
                <IconUser className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  id="user_name"
                  name="user_name"
                  disabled={isLoading}
                  className={inputBareClass}
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-zinc-700 mb-1">
                Password
              </label>
              <div className={fieldWrapClass}>
                <IconLock className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  disabled={isLoading}
                  className={inputBareClass}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-800 hover:bg-teal-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-md py-2.5 transition-all duration-300  flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Logging in...
                </>
              ) : "Login"}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-500 mt-5">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-teal-800 hover:text-indigo-800 font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}