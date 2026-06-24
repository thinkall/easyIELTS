import Link from "next/link";
import { listPastExams } from "@/server/past-exams";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Past exams — easyIELTS" };

const SKILL_LABEL: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export default function PastExamsPage() {
  const exams = listPastExams();
  return (
    <Container className="py-10">
      <PageHeader
        title="Past exams"
        subtitle="Run full past papers you've added to your private library, with instant scoring."
      />
      {exams.length === 0 ? (
        <div className="mt-6 rounded-xl border border-gray-200 p-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          <p className="font-medium">No past exams found.</p>
          <p className="mt-2">
            Add your own papers to the gitignored <code>private/past-exams/</code> folder (each in
            its own subfolder with a <code>manifest.json</code> and audio files). See
            <code> examples/past-exams/</code> for a template and the README for details.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {exams.map((exam) => (
            <li
              key={exam.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <p className="font-semibold">{exam.title}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {exam.skills.map((skill) => (
                  <Link
                    key={skill}
                    href={`/past-exams/${exam.id}/${skill}`}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
                  >
                    {SKILL_LABEL[skill]} →
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
