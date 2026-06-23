import { getWritingTests } from "@/lib/content/writing";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { TestList } from "@/components/ui/TestList";

export const metadata = { title: "Writing practice — easyIELTS" };

export default function WritingIndexPage() {
  const tests = getWritingTests();
  return (
    <Container className="py-10">
      <PageHeader
        title="Writing practice"
        subtitle="Write Task 1 and Task 2, then get AI band feedback on all four criteria."
        actions={<ButtonLink href="/writing/generate">✨ Generate a new test</ButtonLink>}
      />
      <TestList tests={tests.map((t) => ({ href: `/writing/${t.id}`, title: t.title }))} />
    </Container>
  );
}
