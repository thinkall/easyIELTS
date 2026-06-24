# Past exams — your private library

easyIELTS can run **full past papers** that you provide yourself. Your files stay on your
machine: put them in the gitignored **`private/past-exams/`** folder, which is never committed
to git and never uploaded anywhere.

> Only add material you are legally entitled to use (e.g. books you own), and keep this site
> private. The app never bundles or distributes any exam content — it only reads what you place
> in `private/past-exams/`.

## How to add an exam

1. Create a folder per test under `private/past-exams/`, e.g.
   `private/past-exams/my-exam-1/`. The folder name becomes the exam id (letters, digits,
   `.`, `_`, `-` only).
2. Put your **audio files** (`.mp3`, `.m4a`, `.wav`, …) in that folder.
3. Add a **`manifest.json`** describing the test. Copy
   [`sample-exam-1/manifest.json`](sample-exam-1/manifest.json) as a starting point and fill in
   your own content + answer keys.
4. Open **/past-exams** in the app and run it — Listening/Reading are auto-scored; Writing and
   Speaking use the LLM/live examiner.

```bash
mkdir -p private/past-exams/my-exam-1
cp examples/past-exams/sample-exam-1/manifest.json private/past-exams/my-exam-1/
# then add your audio file(s) and edit the manifest
```

You can point the loader at a different folder with `EASYIELTS_PAST_EXAMS_DIR`.

## manifest.json format

All four skills are optional — include only what you have. At least one is required.

| Field | Meaning |
|-------|---------|
| `title` | Display name of the exam. |
| `listening.timeMinutes` | Countdown minutes (default 30). |
| `listening.sections[]` | `name`, optional `audio` (file name in the folder), optional `script`, and `questions[]`. |
| `reading.sections[]` | `name`, `passageTitle`, `passageParagraphs[]`, and `questions[]`. |
| `writing.tasks[]` | `taskNumber` (1 or 2), optional `minWords`, `instructions`. |
| `speaking.parts[]` | `part` ("1"/"2"/"3"), optional `title`, optional `topic` (cue card / examiner focus). |

### Question object (listening & reading)

```json
{
  "type": "form_completion",
  "prompt": "Customer name: ___",
  "accepted": ["John Smith", "J Smith"],
  "wordLimit": 3,
  "options": ["A red", "B blue"]
}
```

- `type` — one of: `single_choice`, `multiple_choice`, `true_false_notgiven`,
  `yes_no_notgiven`, `matching_headings`, `matching_info`, `matching_features`,
  `matching_sentence_endings`, `sentence_completion`, `summary_completion`, `note_completion`,
  `table_completion`, `flowchart_completion`, `form_completion`, `diagram_label`, `map_label`,
  `short_answer`.
- `accepted` — one or more correct answers (any match counts; whitespace/case are normalized).
  For `single_choice` use the option letter, e.g. `["B"]`. For TFNG/YNNG use
  `["true"]`/`["false"]`/`["not given"]` (or yes/no).
- `options` — only for choice questions; each like `"A apples"` (letter + space + label).
- `wordLimit` — optional max words for completion/short-answer items.

Questions are numbered automatically across the test in the order they appear.
