import { getReadingTests } from "@/lib/content/reading";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { TestList } from "@/components/ui/TestList";

export const metadata = { title: "Reading practice — easyIELTS" };

export default function ReadingIndexPage() {
  const tests = getReadingTests();
  return (
    <Container className="py-10">
      <PageHeader
        title="Reading practice"
        subtitle="Take a General Training reading test and get an instant score and band estimate."
        actions={<ButtonLink href="/reading/generate">✨ Generate a new test</ButtonLink>}
      />
      <TestList tests={tests.map((t) => ({ href: `/reading/${t.id}`, title: t.title, meta: `~${t.timeMinutes} min` }))} />
    </Container>
  );
}
