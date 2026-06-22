"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "awaiting" | "connected" | "error";

export function ConnectGitHub() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [userCode, setUserCode] = useState("");
  const [verifyUri, setVerifyUri] = useState("");
  const [message, setMessage] = useState("");
  const pollingRef = useRef(true);

  useEffect(() => {
    fetch("/api/auth/github/status")
      .then((r) => r.json())
      .then((d) => { if (d.connected) setPhase("connected"); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => { pollingRef.current = false; };
  }, []);

  async function start() {
    setMessage("");
    const res = await fetch("/api/auth/github/start", { method: "POST" });
    if (!res.ok) { setPhase("error"); setMessage("Could not start sign-in."); return; }
    const data = await res.json();
    setUserCode(data.userCode);
    setVerifyUri(data.verificationUri);
    setPhase("awaiting");
    pollingRef.current = true;
    poll(data.interval ?? 5, data.expiresIn ?? 900);
  }

  function poll(intervalSec: number, expiresIn: number) {
    const deadline = Date.now() + expiresIn * 1000;
    const tick = async () => {
      if (!pollingRef.current) return;
      if (Date.now() > deadline) { setPhase("error"); setMessage("Code expired. Try again."); return; }
      let nextDelay = intervalSec * 1000;
      try {
        const res = await fetch("/api/auth/github/poll", { method: "POST" });
        const data = await res.json();
        if (data.status === "connected") { setPhase("connected"); return; }
        if (data.status === "error") { setPhase("error"); setMessage("Sign-in failed. Try again."); return; }
        if (data.status === "slow_down") nextDelay += 5000;
      } catch {
        // transient network error — keep polling
      }
      if (pollingRef.current) setTimeout(tick, nextDelay);
    };
    setTimeout(tick, intervalSec * 1000);
  }

  async function logout() {
    await fetch("/api/auth/github/logout", { method: "POST" });
    setPhase("idle");
  }

  if (phase === "connected") {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
        <p className="font-medium text-green-800 dark:text-green-200">✓ GitHub Copilot connected</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Writing &amp; speaking feedback will use your GitHub account.</p>
        <button onClick={logout} className="mt-3 text-sm text-red-600 underline">Disconnect</button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h2 className="text-lg font-semibold">Connect GitHub Copilot</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Sign in with a device code to use your GitHub account for AI writing &amp; speaking feedback.
      </p>
      {phase === "idle" || phase === "error" ? (
        <>
          <button onClick={start} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Connect with device code
          </button>
          {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
        </>
      ) : (
        <div className="mt-3 text-sm">
          <p>1. Open <a className="text-indigo-600 underline" href={verifyUri} target="_blank" rel="noreferrer">{verifyUri}</a></p>
          <p className="mt-1">2. Enter this code:</p>
          <p className="mt-1 font-mono text-2xl tracking-widest">{userCode}</p>
          <p className="mt-2 text-gray-500">Waiting for authorization…</p>
        </div>
      )}
    </div>
  );
}
