"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const profile = localStorage.getItem("studentProfile");
    if (profile) {
      router.push("/dashboard");
    } else {
      router.push("/onboarding");
    }
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-linen">
      <p className="text-gunmetal">Loading...</p>
    </main>
  );
}