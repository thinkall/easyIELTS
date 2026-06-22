"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { getStorage } from "@/lib/storage/adapter";
import type { Attempt } from "@/lib/storage/types";

export default function DashboardPage() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setAttempts(getStorage().listAttempts()), 0);
    return () => window.clearTimeout(id);
  }, []);
  if (attempts === null) {
    return <main className="mx-auto max-w-4xl px-6 py-12 text-gray-500">Loading…</main>;
  }
  return <Dashboard attempts={attempts} />;
}
