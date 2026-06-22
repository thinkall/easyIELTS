import { notFound } from "next/navigation";
import { getSpeakingTest, getSpeakingTests } from "@/lib/content/speaking";
import { SpeakingRunner } from "@/components/speaking/SpeakingRunner";

export function generateStaticParams() {
  return getSpeakingTests().map((t) => ({ testId: t.id }));
}

export default async function SpeakingTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const test = getSpeakingTest(testId);
  if (!test) notFound();
  return <SpeakingRunner test={test} />;
}