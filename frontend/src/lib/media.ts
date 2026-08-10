/** Resolve Django media paths for browser use (rewritten via Next `/media/*`). */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.includes("/media/")) {
    return `/media/${path.split("/media/").pop()}`;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("media/")) return `/${path}`;
  return path.startsWith("/") ? path : `/media/${path}`;
}
