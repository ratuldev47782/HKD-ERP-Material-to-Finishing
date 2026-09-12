"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PerformLogin } from "@/app/actions";
import { useAuth } from "@/app/hooks/useAuth";

export default function LoginForm() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    try {
      const formData = new FormData(event.currentTarget);
      const found = await PerformLogin(formData);
      if (found) {
        setAuth(found);
        router.push("/");
      } else {
        setError("Please provide valid login credentials");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      {error && (
        <div className="my-2 text-sm text-red-600 text-center font-medium">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Username Field */}
        <div>
          <label
            htmlFor="user_name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            User Name
          </label>
          <input
            type="text"
            id="user_name"
            name="user_name"
            className="w-full border text-black border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-lg px-3 py-2"
            placeholder="Enter your username"
            required
          />
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 text-black focus:outline-none rounded-lg px-3 py-2"
            placeholder="••••••••"
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2 transition-all duration-200"
        >
          Login
        </button>
      </form>
    </>
  );
}
