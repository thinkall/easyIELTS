"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Status {
  adminConfigured: boolean;
  authenticated: boolean;
  copilot?: { connected: boolean };
  gemini?: { set: boolean; hint: string };
  model?: string;
}

export function AdminPanel() {
  const [status, setStatus] = useState<Status | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/status");
      setStatus(await res.json());
    } catch {
      setStatus({ adminConfigured: true, authenticated: false });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  if (status === null) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }
  if (!status.adminConfigured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm dark:border-amber-800 dark:bg-amber-950">
        <p className="font-medium text-amber-800 dark:text-amber-200">Admin is not configured.</p>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Set <code>ADMIN_PASSWORD</code> in your <code>.env</code> and restart the server to enable this page.
        </p>
      </div>
    );
  }
  if (!status.authenticated) {
    return <AdminLogin onSuccess={refresh} />;
  }
  return <AdminControls status={status} onChange={refresh} />;
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword("");
        onSuccess();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Incorrect password.");
      }
    } catch {
      setError("Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3 rounded-xl border border-gray-200 p-5 dark:border-gray-700">
      <h2 className="text-lg font-semibold">Admin sign-in</h2>
      <label className="text-sm font-medium" htmlFor="admin-pw">Admin password</label>
      <input
        id="admin-pw"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        placeholder="••••••••"
      />
      <button type="submit" disabled={busy} className="self-start rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function AdminControls({ status, onChange }: { status: Status; onChange: () => void }) {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    onChange();
  }
  return (
    <div className="flex flex-col gap-8">
      <SharedCopilotSection
        connected={status.copilot?.connected ?? false}
        model={status.model ?? ""}
        onChange={onChange}
      />
      <SharedGeminiSection
        set={status.gemini?.set ?? false}
        hint={status.gemini?.hint ?? ""}
        onChange={onChange}
      />
      <div>
        <button onClick={logout} className="text-sm text-gray-600 underline dark:text-gray-300">
          Sign out of admin
        </button>
      </div>
    </div>
  );
}

type Phase = "idle" | "awaiting" | "error";

function SharedCopilotSection({ connected, model, onChange }: { connected: boolean; model: string; onChange: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [userCode, setUserCode] = useState("");
  const [verifyUri, setVerifyUri] = useState("");
  const [message, setMessage] = useState("");
  const polling = useRef(true);

  useEffect(() => () => { polling.current = false; }, []);

  async function start() {
    setMessage("");
    const res = await fetch("/api/admin/copilot/start", { method: "POST" });
    if (!res.ok) { setPhase("error"); setMessage("Could not start sign-in."); return; }
    const data = await res.json();
    setUserCode(data.userCode);
    setVerifyUri(data.verificationUri);
    setPhase("awaiting");
    polling.current = true;
    poll(data.interval ?? 5, data.expiresIn ?? 900);
  }

  function poll(intervalSec: number, expiresIn: number) {
    const deadline = Date.now() + expiresIn * 1000;
    const tick = async () => {
      if (!polling.current) return;
      if (Date.now() > deadline) { setPhase("error"); setMessage("Code expired. Try again."); return; }
      let nextDelay = intervalSec * 1000;
      try {
        const res = await fetch("/api/admin/copilot/poll", { method: "POST" });
        const data = await res.json();
        if (data.status === "connected") { setPhase("idle"); onChange(); return; }
        if (data.status === "error") { setPhase("error"); setMessage("Sign-in failed. Try again."); return; }
        if (data.status === "slow_down") nextDelay += 5000;
      } catch {
        /* transient — keep polling */
      }
      if (polling.current) setTimeout(tick, nextDelay);
    };
    setTimeout(tick, intervalSec * 1000);
  }

  async function disconnect() {
    await fetch("/api/admin/copilot/disconnect", { method: "POST" });
    onChange();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-200 p-5 dark:border-gray-700">
      <h2 className="text-lg font-semibold">Shared GitHub Copilot</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Connect a GitHub Copilot account here and <strong>every visitor</strong> can use it for AI scoring and
        test generation — unless they connect their own (which takes priority).
      </p>
      {connected ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
            <p className="font-medium text-green-800 dark:text-green-200">✓ Shared Copilot connected</p>
            <button onClick={disconnect} className="mt-2 text-sm text-red-600 underline">Disconnect</button>
          </div>
          <SharedModelPicker key={model} model={model} onChange={onChange} />
        </div>
      ) : phase === "awaiting" ? (
        <div className="text-sm">
          <p>1. Open <a className="text-indigo-600 underline" href={verifyUri} target="_blank" rel="noreferrer">{verifyUri}</a></p>
          <p className="mt-1">2. Enter this code:</p>
          <p className="mt-1 font-mono text-2xl tracking-widest">{userCode}</p>
          <p className="mt-2 text-gray-500">Waiting for authorization…</p>
        </div>
      ) : (
        <>
          <button onClick={start} className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Connect with device code
          </button>
          {message && <p className="text-sm text-red-600">{message}</p>}
        </>
      )}
    </section>
  );
}

interface ModelOption { id: string; name: string; category: string }

function SharedModelPicker({ model, onChange }: { model: string; onChange: () => void }) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState(model);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/models");
        const data = await res.json();
        if (Array.isArray(data?.models)) setModels(data.models);
      } catch {
        /* offline / not connected */
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      if (selected) {
        await fetch("/api/admin/model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selected }),
        });
      } else {
        await fetch("/api/admin/model", { method: "DELETE" });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor="admin-model">Shared model</label>
      <select
        id="admin-model"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
      >
        <option value="">Default (auto-pick from the account)</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>{m.name}{m.category ? ` · ${m.category}` : ""}</option>
        ))}
        {selected && !models.some((m) => m.id === selected) && (
          <option value={selected}>{selected}</option>
        )}
      </select>
      <p className="text-xs text-gray-500">
        Model used for visitors on the shared account (those who haven&apos;t picked their own).
      </p>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy}
          className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          Save model
        </button>
        {saved && <span className="text-sm text-green-600">Saved ✓</span>}
      </div>
    </div>
  );
}

function SharedGeminiSection({ set, hint, onChange }: { set: boolean; hint: string; onChange: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (key.trim().length === 0) return;
    setBusy(true);
    try {
      await fetch("/api/admin/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      setKey("");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function unset() {
    setBusy(true);
    try {
      await fetch("/api/admin/gemini", { method: "DELETE" });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-200 p-5 dark:border-gray-700">
      <h2 className="text-lg font-semibold">Shared Gemini key</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Used for live speaking, speaking evaluation and listening audio for <strong>all users</strong> who
        haven&apos;t entered their own Gemini key.
      </p>
      {set ? (
        <p className="text-sm text-green-700 dark:text-green-400">✓ A shared Gemini key is set ({hint}).</p>
      ) : (
        <p className="text-sm text-gray-500">No shared Gemini key set.</p>
      )}
      <label className="text-sm font-medium" htmlFor="admin-gemini">{set ? "Replace" : "Set"} Gemini key</label>
      <input
        id="admin-gemini"
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        placeholder="AIza…"
      />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy || key.trim().length === 0}
          className="self-start rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          Save key
        </button>
        {set && (
          <button onClick={unset} disabled={busy} className="text-sm text-red-600 underline">
            Unset key
          </button>
        )}
      </div>
    </section>
  );
}
