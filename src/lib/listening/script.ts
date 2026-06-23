export interface ScriptTurn {
  speaker: string;
  text: string;
}

// A speaker label is a short capitalised name followed by a colon, e.g. "Caller:".
// We require it to start at the beginning or after whitespace and be reasonably
// short so sentence-internal colons aren't mistaken for labels.
const LABEL = /(^|\s)([A-Z][A-Za-z .'-]{0,24}):\s/g;

/** Split a labelled listening script into ordered speaker turns (labels removed). */
export function parseScriptTurns(script: string): ScriptTurn[] {
  const matches: { speaker: string; labelStart: number; textStart: number }[] = [];
  for (const m of script.matchAll(LABEL)) {
    const labelStart = m.index + m[1].length;
    matches.push({ speaker: m[2].trim(), labelStart, textStart: labelStart + m[2].length + 2 });
  }

  if (matches.length === 0) {
    const text = script.trim();
    return text ? [{ speaker: "Narrator", text }] : [];
  }

  const turns: ScriptTurn[] = [];
  for (let i = 0; i < matches.length; i++) {
    const end = i + 1 < matches.length ? matches[i + 1].labelStart : script.length;
    const text = script.slice(matches[i].textStart, end).trim();
    if (text) turns.push({ speaker: matches[i].speaker, text });
  }
  return turns;
}

/** Distinct speakers in order of first appearance. */
export function uniqueSpeakers(turns: ScriptTurn[]): string[] {
  const seen: string[] = [];
  for (const t of turns) if (!seen.includes(t.speaker)) seen.push(t.speaker);
  return seen;
}

/** The script with speaker labels removed, joined into plain narration. */
export function stripLabels(script: string): string {
  return parseScriptTurns(script)
    .map((t) => t.text)
    .join(" ");
}
