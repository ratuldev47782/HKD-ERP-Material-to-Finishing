"use client";

import Link from "next/link";
import { useAuth } from "@/app/hooks/useAuth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, LogIn } from "lucide-react";

export default function SignInOut() {
  const { auth, setAuth } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    setAuth(null);
    router.push("/login");
  };
console.log("Auth",auth)
  return (
    <div className="flex items-center justify-center">
      {auth ? (
        <motion.div
          initial={{ opacity: -1, scale: 0.95 }}
          animate={{ opacity: 2, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3 bg-linear-to-br from-green-50 via-white to-green-50 border border-green-300 rounded-full shadow-md px-5 py-2 hover:shadow-lg transition-all mt-3"

        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-700 text-sm">
              Active as{" "}
              <strong className="font-semibold text-green-700">
                {auth.user_name}
              </strong>
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href="/login"
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 mt-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
          >
            <LogIn size={18} />
            Login
          </Link>
        </motion.div>
      )}
    </div>
  );
}
