import { AdminPanel } from "@/components/admin/AdminPanel";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Admin — easyIELTS" };

export default function AdminPage() {
  return (
    <Container className="max-w-2xl py-10">
      <PageHeader
        title="Admin"
        subtitle="Manage server-side shared credentials used by everyone (a user's own keys always take priority)."
      />
      <div className="mt-6">
        <AdminPanel />
      </div>
    </Container>
  );
}
