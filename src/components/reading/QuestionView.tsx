import type { ReadingQuestion, QuestionOption } from "@/lib/content/types";

const FIXED_OPTIONS: Record<string, QuestionOption[] | undefined> = {
  true_false_notgiven: [
    { value: "true", label: "True" },
    { value: "false", label: "False" },
    { value: "not given", label: "Not Given" },
  ],
  yes_no_notgiven: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "not given", label: "Not Given" },
  ],
};

export interface QuestionViewProps {
  question: ReadingQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  result?: { correct: boolean; accepted: string[] };
}

export function QuestionView({ question, value, onChange, disabled, result }: QuestionViewProps) {
  const options = question.options ?? FIXED_OPTIONS[question.type];

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <p className="mb-2 text-sm">
        <span className="font-semibold">{question.number}.</span> {question.prompt}
      </p>

      {options ? (
        <div role="radiogroup" aria-label={`Question ${question.number}`} className="flex flex-col gap-1">
          {options.map((opt, i) => (
            <label key={`${i}-${opt.value}`} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt.value}
                checked={value === opt.value}
                disabled={disabled}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Question ${question.number} answer`}
          placeholder={question.wordLimit ? `Max ${question.wordLimit} word(s)` : undefined}
          className="w-full max-w-xs rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
      )}

      {result && (
        <p className={`mt-2 text-xs font-medium ${result.correct ? "text-green-600" : "text-red-600"}`}>
          {result.correct ? "Correct" : `Incorrect — correct answer: ${result.accepted.join(" / ")}`}
        </p>
      )}
    </div>
  );
}
