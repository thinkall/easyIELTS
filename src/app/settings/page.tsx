import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings — easyIELTS" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">Bring your own keys and manage your data.</p>
      </header>
      <SettingsForm />
    </main>
  );
}
