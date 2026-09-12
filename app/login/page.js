"use client";

import Image from "next/image";
import Link from "next/link";
import LoginForm from "../AuthComponents/LoginForm";

export default function LoginPage() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-indigo-100 px-4">
      {/* Outer Container */}
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
        {/* LEFT: Illustration */}
        <div className="w-full md:w-1/2 bg-indigo-50 flex items-center justify-center p-8">
          <Image
            src="/Computer login-amico.svg"
            alt="Login illustration"
            width={420}
            height={420}
            className="w-full h-auto max-w-sm"
            priority
          />
        </div>

        {/* RIGHT: Logo + Form */}
        <div className="w-full md:w-1/2 p-8 flex flex-col justify-center">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/HKD_LOGO.png"
              alt="HKD Outdoor Innovations Ltd. Logo"
              width={80}
              height={80}
              className="rounded-3xl mb-3 shadow-md"
              priority
            />
            <h1 className="text-xl text-indigo-600 font-extrabold text-center">
              HKD Outdoor Innovations Ltd.
            </h1>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
            Sign In
          </h2>

          {/* Login Form */}
          <LoginForm />

          {/* Register Link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Don’t have an account?{" "}
            <Link
              href="/register"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
