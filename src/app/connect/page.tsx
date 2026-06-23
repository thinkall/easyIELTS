import { ConnectGitHub } from "@/components/auth/ConnectGitHub";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Connect GitHub — easyIELTS" };

export default function ConnectPage() {
  return (
    <Container className="max-w-xl py-10">
      <PageHeader title="Connect your account" subtitle="Optional. Without connecting, shared AI feedback is rate-limited." />
      <div className="mt-6">
        <ConnectGitHub />
      </div>
    </Container>
  );
}
