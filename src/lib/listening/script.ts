export interface ScriptTurn {
  speaker: string;
  text: string;
}

// A speaker label is a short capitalised name followed by a colon, e.g. "Caller:".
// We require it to start at the beginning or after whitespace and be reasonably
// short so sentence-internal colons aren't mistaken for labels.
const LABEL = /(^|\s)([A-Z][A-Za-z .'-]{0,24}):\s/g;

// Common words that appear with a colon mid-sentence but are NOT speakers; their
// text is kept inline rather than starting a new turn (and the word isn't dropped).
const NON_SPEAKER_LABELS = new Set([
  "remember", "note", "warning", "tip", "example", "caution", "important",
  "hint", "reminder", "ps", "nb", "ie", "eg", "for example",
]);

interface Candidate {
  speaker: string;
  labelStart: number;
  textStart: number;
}

/** Split a labelled listening script into ordered speaker turns (labels removed). */
export function parseScriptTurns(script: string): ScriptTurn[] {
  const candidates: Candidate[] = [];
  for (const m of script.matchAll(LABEL)) {
    const speaker = m[2].trim();
    if (NON_SPEAKER_LABELS.has(speaker.toLowerCase())) continue; // keep inline
    const labelStart = m.index + m[1].length;
    candidates.push({ speaker, labelStart, textStart: labelStart + m[2].length + 2 });
  }

  if (candidates.length === 0) {
    const text = script.trim();
    return text ? [{ speaker: "Narrator", text }] : [];
  }

  const turns: ScriptTurn[] = [];
  // Any narration before the first speaker label is its own (Narrator) turn.
  const lead = script.slice(0, candidates[0].labelStart).trim();
  if (lead) turns.push({ speaker: "Narrator", text: lead });

  for (let i = 0; i < candidates.length; i++) {
    const end = i + 1 < candidates.length ? candidates[i + 1].labelStart : script.length;
    const text = script.slice(candidates[i].textStart, end).trim();
    if (text) turns.push({ speaker: candidates[i].speaker, text });
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
