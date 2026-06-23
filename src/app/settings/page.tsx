import { SettingsForm } from "@/components/settings/SettingsForm";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Settings — easyIELTS" };

export default function SettingsPage() {
  return (
    <Container className="max-w-2xl py-10">
      <PageHeader title="Settings" subtitle="Bring your own keys, pick your AI model, and manage your data." />
      <div className="mt-6">
        <SettingsForm />
      </div>
    </Container>
  );
}
