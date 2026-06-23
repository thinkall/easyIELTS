"use client";

import { useEffect, useState } from "react";

/**
 * Shows the persisted site visit count. Calls `/api/visits` once on mount, which
 * increments the counter for first-time browsers and returns the current total.
 * Renders nothing until/unless a count is available.
 */
export function VisitorCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/visits");
        const data = await res.json();
        if (active && typeof data?.count === "number") setCount(data.count);
      } catch {
        /* offline — leave it hidden */
      }
    })();
    return () => { active = false; };
  }, []);

  if (count === null) return null;

  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      👁 {count.toLocaleString()} visits
    </p>
  );
}
