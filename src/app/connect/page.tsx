import { ConnectGitHub } from "@/components/auth/ConnectGitHub";

export const metadata = { title: "Connect GitHub — easyIELTS" };

export default function ConnectPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Connect your account</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Optional. Without connecting, shared AI feedback is rate-limited.
        </p>
      </header>
      <ConnectGitHub />
    </main>
  );
}
