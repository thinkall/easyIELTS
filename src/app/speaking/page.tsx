import { getSpeakingTests } from "@/lib/content/speaking";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { TestList } from "@/components/ui/TestList";

export const metadata = { title: "Speaking practice — easyIELTS" };

export default function SpeakingIndexPage() {
  const tests = getSpeakingTests();
  return (
    <Container className="py-10">
      <PageHeader
        title="Speaking practice"
        subtitle="Talk live with an AI examiner, then get your band and feedback. Requires a microphone."
        actions={<ButtonLink href="/speaking/generate">✨ Generate a new topic</ButtonLink>}
      />
      <TestList tests={tests.map((t) => ({ href: `/speaking/${t.id}`, title: t.title }))} />
    </Container>
  );
}
