"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from the URL
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (error) throw error;

        // Successfully authenticated, redirect to dashboard
        router.push("/dashboard");
      } catch (error) {
        console.error("Error during auth callback:", error);
        setError(error.message);
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-neutral-200 overflow-hidden">
            <div className="p-8 text-center">
              <div className="mb-6">
                <svg
                  className="w-20 h-20 mx-auto text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-neutral-900 mb-4">
                Authentication Error
              </h2>
              <p className="text-neutral-600 mb-6">{error}</p>
              <button
                onClick={() => router.push("/login")}
                className="inline-block px-6 py-3 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl hover:from-neutral-800 hover:to-neutral-700 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-neutral-200 overflow-hidden">
          <div className="p-8 text-center">
            {/* Loading Animation */}
            <div className="mb-6">
              <div className="relative w-20 h-20 mx-auto">
                <svg
                  className="w-20 h-20 text-neutral-900 animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-light text-neutral-900 mb-4">
              Verifying Your Account
            </h2>
            <p className="text-neutral-600 mb-6">
              Please wait while we complete your authentication...
            </p>

            {/* Loading Spinner */}
            <div className="flex justify-center">
              <svg
                className="animate-spin h-8 w-8 text-neutral-900"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}