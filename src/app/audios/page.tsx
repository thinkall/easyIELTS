import { listAudioFolders } from "@/server/audios";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audios — easyIELTS" };

function audioSrc(path: string): string {
  // Encode each path segment but keep the "/" separators.
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/audios/file?name=${encoded}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function AudiosPage() {
  const folders = listAudioFolders();
  const total = folders.reduce((n, f) => n + f.tracks.length, 0);

  return (
    <Container className="py-10">
      <PageHeader
        title="Audios"
        subtitle="Play the audio files in your private library."
      />
      {total === 0 ? (
        <div className="mt-6 rounded-xl border border-gray-200 p-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          <p className="font-medium">No audio files found.</p>
          <p className="mt-2">
            Add your own audio files (mp3, m4a, wav, …) to the gitignored
            <code> private/audios/</code> folder — subfolders are supported — then refresh this
            page. Only add material you are legally entitled to use.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} {total === 1 ? "track" : "tracks"} in {folders.length}{" "}
            {folders.length === 1 ? "folder" : "folders"}.
          </p>
          {folders.map((group, i) => (
            <details
              key={group.folder || "root"}
              open={folders.length === 1 || i === 0}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <summary className="cursor-pointer select-none font-semibold">
                {group.folder || "(root)"}{" "}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  · {group.tracks.length}
                </span>
              </summary>
              <ul className="mt-3 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {group.tracks.map((track) => (
                  <li key={track.path} className="flex flex-col gap-1 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{track.name}</span>
                      <span className="shrink-0 text-xs text-gray-400">{formatSize(track.size)}</span>
                    </div>
                    <audio controls preload="none" className="w-full">
                      <source src={audioSrc(track.path)} />
                      Your browser does not support the audio element.
                    </audio>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </Container>
  );
}
