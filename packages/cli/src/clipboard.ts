import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";

export interface ClipboardResult {
  readonly copied: boolean;
  readonly method?: string;
}

interface ClipboardCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly method: string;
}

function commandsForPlatform(platform: NodeJS.Platform): readonly ClipboardCommand[] {
  if (platform === "win32") {
    return [{ command: "clip.exe", args: [], method: "clip.exe" }];
  }
  if (platform === "darwin") {
    return [{ command: "pbcopy", args: [], method: "pbcopy" }];
  }
  return [
    { command: "wl-copy", args: [], method: "wl-copy" },
    { command: "xclip", args: ["-selection", "clipboard"], method: "xclip" },
    { command: "xsel", args: ["--clipboard", "--input"], method: "xsel" },
  ];
}

export function copyToClipboard(
  text: string,
  platform: NodeJS.Platform = process.platform,
): ClipboardResult {
  const options: SpawnSyncOptionsWithStringEncoding = {
    input: text,
    encoding: "utf8",
    stdio: ["pipe", "ignore", "ignore"],
    timeout: 5_000,
    windowsHide: true,
  };

  for (const candidate of commandsForPlatform(platform)) {
    const result = spawnSync(candidate.command, [...candidate.args], options);
    if (!result.error && result.status === 0) {
      return { copied: true, method: candidate.method };
    }
  }

  return { copied: false };
}
