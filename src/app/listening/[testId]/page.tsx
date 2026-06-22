import { notFound } from "next/navigation";
import { getListeningTest, getListeningTests } from "@/lib/content/listening";
import { ListeningRunner } from "@/components/listening/ListeningRunner";

export function generateStaticParams() {
  return getListeningTests().map((test) => ({ testId: test.id }));
}

export default async function ListeningTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const test = getListeningTest(testId);
  if (!test) notFound();
  return <ListeningRunner test={test} />;
}
