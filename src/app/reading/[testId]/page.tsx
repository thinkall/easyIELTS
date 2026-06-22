import { notFound } from "next/navigation";
import { getReadingTest, getReadingTests } from "@/lib/content/reading";
import { ReadingRunner } from "@/components/reading/ReadingRunner";

export function generateStaticParams() {
  return getReadingTests().map((test) => ({ testId: test.id }));
}

export default async function ReadingTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const test = getReadingTest(testId);
  if (!test) notFound();
  return <ReadingRunner test={test} />;
}
