import { notFound } from "next/navigation";
import { getPastExam } from "@/server/past-exams";
import {
  toListeningTest,
  toReadingTest,
  toWritingTest,
  toSpeakingTests,
} from "@/lib/past-exams/manifest";
import Link from "next/link";
import { ListeningRunner } from "@/components/listening/ListeningRunner";
import { ReadingRunner } from "@/components/reading/ReadingRunner";
import { WritingRunner } from "@/components/writing/WritingRunner";
import { SpeakingRunner } from "@/components/speaking/SpeakingRunner";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function PastExamSkillPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string; skill: string }>;
  searchParams: Promise<{ part?: string }>;
}) {
  const { examId, skill } = await params;
  const { part } = await searchParams;
  const loaded = getPastExam(examId);
  if (!loaded) notFound();
  const { manifest } = loaded;

  if (skill === "listening") {
    const test = toListeningTest(examId, manifest);
    if (!test) notFound();
    return <ListeningRunner test={test} />;
  }
  if (skill === "reading") {
    const test = toReadingTest(examId, manifest);
    if (!test) notFound();
    return <ReadingRunner test={test} />;
  }
  if (skill === "writing") {
    const test = toWritingTest(examId, manifest);
    if (!test) notFound();
    return <WritingRunner test={test} />;
  }
  if (skill === "speaking") {
    const tests = toSpeakingTests(examId, manifest);
    if (tests.length === 0) notFound();
    const chosen = part ? tests.find((t) => t.part === part) : undefined;
    if (chosen) return <SpeakingRunner test={chosen} />;
    // No part chosen yet → let the user pick which part to practise.
    return (
      <Container className="py-10">
        <PageHeader title={`${manifest.title} — Speaking`} subtitle="Choose a part to practise with the live AI examiner." />
        <div className="mt-6 flex flex-wrap gap-2">
          {tests.map((t) => (
            <Link
              key={t.id}
              href={`/past-exams/${examId}/speaking?part=${t.part}`}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
            >
              {t.title} →
            </Link>
          ))}
        </div>
      </Container>
    );
  }

  notFound();
}
