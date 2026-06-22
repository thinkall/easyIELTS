import { notFound } from "next/navigation";
import { getWritingTest, getWritingTests } from "@/lib/content/writing";
import { WritingRunner } from "@/components/writing/WritingRunner";

export function generateStaticParams() {
  return getWritingTests().map((test) => ({ testId: test.id }));
}

export default async function WritingTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const test = getWritingTest(testId);
  if (!test) notFound();
  return <WritingRunner test={test} />;
}
