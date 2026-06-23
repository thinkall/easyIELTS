import { getListeningTests } from "@/lib/content/listening";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { TestList } from "@/components/ui/TestList";

export const metadata = { title: "Listening practice — easyIELTS" };

export default function ListeningIndexPage() {
  const tests = getListeningTests();
  return (
    <Container className="py-10">
      <PageHeader
        title="Listening practice"
        subtitle="The recording plays once. Answer, submit, and get your band instantly."
        actions={<ButtonLink href="/listening/generate">✨ Generate a new test</ButtonLink>}
      />
      <TestList tests={tests.map((t) => ({ href: `/listening/${t.id}`, title: t.title, meta: `~${t.timeMinutes} min` }))} />
    </Container>
  );
}
