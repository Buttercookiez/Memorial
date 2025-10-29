"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    checkUser();
  }, []);

  const features = [
    {
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      title: "Create Memorials",
      description: "Build beautiful tribute pages with photos, videos, and stories"
    },
    {
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      ),
      title: "Generate QR Codes",
      description: "Share memorials easily with scannable QR codes for headstones"
    },
    {
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
      title: "Share Memories",
      description: "Let family and friends connect and share their tributes"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center max-w-6xl mx-auto z-10">
        <div className="flex items-center gap-2">
          <svg className="w-8 h-8 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-xl font-light text-neutral-900">Memorial</span>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all text-sm font-medium"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-6 py-2 text-neutral-700 hover:text-neutral-900 transition-all text-sm font-medium hidden sm:block"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 sm:px-6 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all text-sm font-medium"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 pt-24 sm:pt-0">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-light text-neutral-900 mb-6 leading-tight">
            Preserve Memories
            <br />
            <span className="text-neutral-600">Forever</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg lg:text-xl text-neutral-600 mb-12 max-w-2xl mx-auto leading-relaxed px-4">
            Create beautiful digital memorials with photos, videos, and stories. 
            Share them through QR codes that last a lifetime.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 sm:mb-20 px-4">
            <Link
              href={user ? "/dashboard" : "/register"}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl hover:from-neutral-800 hover:to-neutral-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 text-base font-medium"
            >
              Create Your First Memorial
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto px-8 py-4 border-2 border-neutral-300 text-neutral-700 rounded-xl hover:border-neutral-400 hover:shadow-lg transition-all transform hover:scale-105 text-base font-medium"
            >
              Learn More
            </Link>
          </div>

          {/* Features Grid */}
          <div id="features" className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 border border-neutral-200 hover:shadow-xl transition-all duration-300 group"
              >
                <div className="flex justify-center mb-6 text-neutral-700 group-hover:text-neutral-900 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-medium text-neutral-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-neutral-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="border-t border-neutral-200 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            {/* Left Side */}
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-sm text-neutral-600">
                © 2025 Memorial. Honoring loved ones.
              </span>
            </div>

            {/* Right Side - Links */}
            <div className="flex items-center gap-6 text-sm text-neutral-600">
              <a href="#" className="hover:text-neutral-900 transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-neutral-900 transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-neutral-900 transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button (Mobile) */}
      <Link
        href={user ? "/dashboard" : "/register"}
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 bg-neutral-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-neutral-800 transition-all"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </Link>
    </div>
  );
}