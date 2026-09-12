// app/registration/page.jsx
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { registerUser } from "@/app/actions";

const initialState = { success: false, message: "", fieldErrors: {} };

export default function RegistrationForm() {
  const [state, formAction] = React.useActionState(registerUser, initialState);

  const fe = state?.fieldErrors || {};
  const inputClass = (name) =>
    `w-full border px-3 py-2 rounded-lg transition-all focus:outline-none ${
      fe[name]
        ? "border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-400"
        : "border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    } text-gray-800`;

  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-100 px-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-4xl border border-gray-100 flex flex-col md:flex-row overflow-hidden">
        <div className="hidden md:flex w-1/2 items-center justify-center bg-indigo-50 p-8">
          <Image
            src="/Sign up-rafiki.svg"
            alt="Sign up illustration"
            width={420}
            height={420}
            className="w-full h-auto max-w-sm"
            priority
          />
        </div>

        <div className="w-full md:w-1/2 p-8 flex flex-col justify-center">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold text-gray-800">
              Create Your Account
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              Join HKD Outdoor Innovations Ltd.
            </p>
          </div>

          {/* ✅ show server-action message (duplicate / validation) */}
          {state?.message ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.message}
            </div>
          ) : null}

          <form action={formAction} className="space-y-5">
            <div>
              <label htmlFor="user_name" className="block text-sm font-medium text-gray-700 mb-1">
                User Name
              </label>
              <input
                type="text"
                id="user_name"
                name="user_name"
                className={inputClass("user_name")}
                placeholder="Enter your name"
                required
              />
              {fe.user_name && (
                <p className="mt-1 text-xs text-red-600">
                  এই User Name আগে থেকেই আছে।
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className={inputClass("password")}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                id="role"
                name="role"
                className={inputClass("role")}
                placeholder="Enter your role"
                required
              />
            </div>

            <div>
              <label htmlFor="assigned_building" className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Floor
              </label>
              <select
                id="assigned_building"
                name="assigned_building"
                className={inputClass("assigned_building")}
                required
              >
                <option value="">Select a building</option>
                <option value="A-2">A-2</option>
                <option value="B-2">B-2</option>
                <option value="A-3">A-3</option>
                <option value="B-3">B-3</option>
                <option value="A-4">A-4</option>
                <option value="B-4">B-4</option>
                <option value="A-5">A-5</option>
                <option value="B-5">B-5</option>
                
              </select>
              {(fe.factory || fe.assigned_building) && (
                <p className="mt-1 text-xs text-red-600">
                  একই Factory + Building আগে থেকেই registered.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="factory" className="block text-sm font-medium text-gray-700 mb-1">
                Factory
              </label>
              <select
                id="factory"
                name="factory"
                className={inputClass("factory")}
                required
              >
                <option value="">Select a factory</option>
                <option value="K-1">K-1</option>
                <option value="K-2">K-2</option>
                <option value="K-3">K-3</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-lg py-2 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Create Account
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-600 font-medium hover:underline">
              Login here
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
