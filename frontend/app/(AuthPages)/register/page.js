// frontend/app/(AuthPages)/register/page.js

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const IconUser = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4.5 20.25a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconMail = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="m4.5 7 7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconLock = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10.5V7.5a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconLockCheck = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10.5V7.5a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="m9.5 15 1.6 1.6L14.5 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconBadge = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="5" width="16" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M9 3.5h6M9.5 12.5h5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="9" r="1.4" fill="currentColor" />
  </svg>
);
const IconLayers = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m3.5 16 8.5 4.5 8.5-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconFactory = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 20V10.5l4.5 3V10.5l4.5 3V10.5l4.5 3V6h2.5v14H4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M4 20h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconCamera = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.1l.9-1.5h7l.9 1.5h2.1A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const ROLE_OPTIONS = [
  // Data Entry
  "Production-Data-Tracker",
  "Quality-Data-Tracker",
  "Cutting-Data-Tracker",
  "Finishing-Data-Tracker",
  "IE-Data-Tracker",
  "Maintenance-Data-Tracker",

  // Entry Level
  "MTO",

  // Executive Level
  "Jr-Executive",
  "Executive",
  "ERP-Executive",
  "Senior-Executive",

  // Mid Management
  "Assistant Manager",
  "Deputy Manager",
  "Manager",
  "Senior Manager",

  // Senior Management
  "AGM",
  "DGM",
  "GM",
  "MD",
  "COO",
  "Chairman",
  "President",

  // Generic (Optional)
  "Management",
];

const DEPARTMENT_OPTIONS = [
  "SALES",
  "CAD",
  "MC",
  "PLANNING",
  "COMMERCIAL-IMPORT",
  "COMMERCIAL-EXPORT",
  "STORE",
  "CUTTING",
  "PRODUCTION",
  "QUALITY",
  "FINISHING",
  "IE",
  "MAINTENANCE",
  "INSPECTION",
  "ACCOUNTS",
  "COMPLIANCE",
  "MIS",
  "HR",
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [filePreview, setFilePreview] = useState(null);

  const fe = fieldErrors;
  const fieldWrapClass = (name) =>
    `flex items-center gap-2 rounded-md border bg-white px-3 transition-all focus-within:bg-white ${
      fe[name]
        ? "border-red-300 focus-within:ring-2 focus-within:ring-red-700 focus-within:border-red-300"
        : "border-zinc-300 focus-within:ring-2 focus-within:ring-teal-700 focus-within:border-teal-700"
    }`;
  const inputBareClass =
    "w-full bg-transparent py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none";

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setFilePreview(null); return; }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!validTypes.includes(file.type)) {
      alert("শুধু JPG, PNG, বা WEBP image দিন।");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setFilePreview(reader.result);
    reader.readAsDataURL(file);
  };

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirm_password");

    if (password !== confirmPassword) {
      setFieldErrors({ confirm_password: true });
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        user_name: formData.get("user_name"),
        email: formData.get("email"),
        password,
        role: formData.get("role"),
        department: formData.get("department"),
        assigned_building: formData.get("assigned_building"),
        factory: formData.get("factory"),
        profile_picture: filePreview || null,
      };

      await register(payload);
      router.push("/dashboard");
    } catch (err) {
      if (err.message === "Username already taken") {
        setFieldErrors({ user_name: true });
      } else if (err.message === "Email already registered") {
        setFieldErrors({ email: true });
      }
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="min-h-screen flex items-center justify-center bg-zinc-100 px-4 py-4">
      <div className="bg-white  rounded-md w-full max-w-4xl border border-zinc-300 flex flex-col md:flex-row overflow-hidden">

        {/* LEFT: Illustration */}
        <div className="hidden md:flex w-1/2 items-center justify-center bg-zinc-50 p-6">
          <Image
            src="/Sign up-rafiki.svg"
            alt="Sign up illustration"
            width={380}
            height={380}
            className="w-full h-auto max-w-xs"
            priority
          />
        </div>

        {/* RIGHT: Form */}
        <div className="w-full md:w-1/2 flex flex-col">
          <div className="px-8 pt-6 pb-2 flex items-center gap-3">
            <Image
              src="/HKD_LOGO.png"
              alt="HKD Outdoor Innovations Ltd. logo"
              width={48}
              height={48}
              className="w-11 h-11 object-contain shrink-0"
              priority
            />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-zinc-800 leading-tight">
                Create Your Account
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                Join HKD Outdoor Innovations Ltd.
              </p>
            </div>
          </div>

          {error && (
            <div className="mx-8 mb-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="px-8 pb-6 space-y-2.5">
            {/* User Name + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="user_name" className="block text-xs font-medium text-zinc-700 mb-1">
                  User Name
                </label>
                <div className={fieldWrapClass("user_name")}>
                  <IconUser className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    id="user_name"
                    name="user_name"
                    disabled={isLoading}
                    className={inputBareClass}
                    placeholder="Your name"
                    minLength={3}
                    required
                  />
                </div>
                {fe.user_name && (
                  <p className="mt-1 text-[11px] text-red-700">User Name আগে থেকেই আছে।</p>
                )}
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-zinc-700 mb-1">
                  Email
                </label>
                <div className={fieldWrapClass("email")}>
                  <IconMail className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    disabled={isLoading}
                    className={inputBareClass}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                {fe.email && (
                  <p className="mt-1 text-[11px] text-red-700">Email আগে থেকেই ব্যবহৃত।</p>
                )}
              </div>
            </div>

            {/* Password + Confirm Password */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-zinc-700 mb-1">
                  Password
                </label>
                <div className={fieldWrapClass("password")}>
                  <IconLock className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    disabled={isLoading}
                    className={inputBareClass}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="confirm_password" className="block text-xs font-medium text-zinc-700 mb-1">
                  Confirm Password
                </label>
                <div className={fieldWrapClass("confirm_password")}>
                  <IconLockCheck className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    disabled={isLoading}
                    className={inputBareClass}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                {fe.confirm_password && (
                  <p className="mt-1 text-[11px] text-red-700">Password মিলছে না।</p>
                )}
              </div>
            </div>

            {/* Role + Department */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="role" className="block text-xs font-medium text-zinc-700 mb-1">
                  Role
                </label>
                <div className={fieldWrapClass("role")}>
                  <IconBadge className="w-4 h-4 text-zinc-400 shrink-0" />
                  <select
                    id="role"
                    name="role"
                    disabled={isLoading}
                    className={`${inputBareClass} appearance-none`}
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>Select role</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="department" className="block text-xs font-medium text-zinc-700 mb-1">
                  Department
                </label>
                <div className={fieldWrapClass("department")}>
                  <IconLayers className="w-4 h-4 text-zinc-400 shrink-0" />
                  <select
                    id="department"
                    name="department"
                    disabled={isLoading}
                    className={`${inputBareClass} appearance-none`}
                    defaultValue=""
                  >
                    <option value="">Select department</option>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Assigned Building + Factory */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="assigned_building" className="block text-xs font-medium text-zinc-700 mb-1">
                  Assigned Floor
                </label>
                <div className={fieldWrapClass("assigned_building")}>
                  <IconLayers className="w-4 h-4 text-zinc-400 shrink-0" />
                  <select
                    id="assigned_building"
                    name="assigned_building"
                    disabled={isLoading}
                    className={`${inputBareClass} appearance-none`}
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>Select</option>
                    <option value="A-2">A-2</option>
                    <option value="B-2">B-2</option>
                    <option value="A-3">A-3</option>
                    <option value="B-3">B-3</option>
                    <option value="A-4">A-4</option>
                    <option value="B-4">B-4</option>
                    <option value="A-5">A-5</option>
                    <option value="B-5">B-5</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="factory" className="block text-xs font-medium text-zinc-700 mb-1">
                  Factory
                </label>
                <div className={fieldWrapClass("factory")}>
                  <IconFactory className="w-4 h-4 text-zinc-400 shrink-0" />
                  <select
                    id="factory"
                    name="factory"
                    disabled={isLoading}
                    className={`${inputBareClass} appearance-none`}
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>Select</option>
                    <option value="K-1">K-1</option>
                    <option value="K-2">K-2</option>
                    <option value="K-3">K-3</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Profile Picture */}
            <div>
              <label htmlFor="profile_picture" className="block text-xs font-medium text-zinc-700 mb-1">
                Profile Picture (Optional)
              </label>
              <div className="flex items-center gap-3">
                <label
                  htmlFor="profile_picture"
                  className={`flex-1 flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 cursor-pointer transition-all ${
                    isLoading
                      ? "border-zinc-300 bg-zinc-50 cursor-not-allowed"
                      : "border-zinc-300 bg-white hover:bg-zinc-50 hover:border-indigo-300"
                  }`}
                >
                  <IconCamera className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-sm text-zinc-500 truncate">
                    {filePreview ? "Change photo" : "Upload a photo"}
                  </span>
                </label>
                <input
                  type="file"
                  id="profile_picture"
                  name="profile_picture"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  className="hidden"
                />
                {filePreview && (
                  <div className="relative w-9 h-9 rounded-md overflow-hidden border-2 border-zinc-300 shrink-0">
                    <Image src={filePreview} alt="Preview" fill className="object-cover" />
                  </div>
                )}
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
                  Creating Account...
                </>
              ) : "Create Account"}
            </button>

            <div className="text-center text-xs text-zinc-600 pb-1">
              Already have an account?{" "}
              <Link href="/login" className="text-teal-800 font-medium hover:underline">
                Login here
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}