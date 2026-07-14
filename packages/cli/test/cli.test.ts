import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

import { runCli, VERSION, type CliIo } from "../src/cli.js";
import { EXIT_CODES } from "../src/exit-codes.js";

const personasDirectory = fileURLToPath(new URL("../../../personas", import.meta.url));
const require = createRequire(import.meta.url);
const packageMetadata = require("../package.json") as { readonly version: string };
const temporaryDirectories: string[] = [];

function captureIo(): { io: CliIo; stdout: () => string; stderr: () => string } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    io: {
      stdout: (text) => output.push(text),
      stderr: (text) => errors.push(text),
    },
    stdout: () => output.join(""),
    stderr: () => errors.join(""),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("CLI", () => {
  it("reports the package version from package metadata", () => {
    const output = captureIo();
    expect(runCli(["--version"], { io: output.io, personasDirectory })).toBe(
      EXIT_CODES.success,
    );
    expect(VERSION).toBe(packageMetadata.version);
    expect(output.stdout()).toBe(`${packageMetadata.version}\n`);
  });

  it("lists the seven personas in text and JSON", () => {
    const text = captureIo();
    expect(runCli(["list"], { io: text.io, personasDirectory })).toBe(EXIT_CODES.success);
    expect(text.stdout()).toContain("teacher");
    expect(text.stdout()).toContain("yandere");

    const json = captureIo();
    expect(
      runCli(["list", "--format", "json", "--locale", "ru"], {
        io: json.io,
        personasDirectory,
      }),
    ).toBe(EXIT_CODES.success);
    expect(JSON.parse(json.stdout())).toHaveLength(7);
  });

  it("supports --locale and the compatible --lang alias", () => {
    const canonical = captureIo();
    const alias = captureIo();
    expect(
      runCli(["show", "wizard", "--locale", "ru", "--format", "text"], {
        io: canonical.io,
        personasDirectory,
      }),
    ).toBe(EXIT_CODES.success);
    expect(
      runCli(["show", "wizard", "--lang", "ru", "--format", "text"], {
        io: alias.io,
        personasDirectory,
      }),
    ).toBe(EXIT_CODES.success);
    expect(alias.stdout()).toBe(canonical.stdout());

    const conflict = captureIo();
    expect(
      runCli(["list", "--locale", "en", "--lang", "ru"], {
        io: conflict.io,
        personasDirectory,
      }),
    ).toBe(EXIT_CODES.usage);
    expect(conflict.stderr()).toContain("conflicting values");
  });

  it("shows markdown and falls back to stdout when clipboard access is unavailable", () => {
    const shown = captureIo();
    expect(
      runCli(["show", "teacher"], { io: shown.io, personasDirectory }),
    ).toBe(EXIT_CODES.success);
    expect(shown.stdout()).toMatch(/^# PERSONA: Teacher/u);

    const copied = captureIo();
    expect(
      runCli(["copy", "teacher"], {
        io: copied.io,
        personasDirectory,
        copyText: () => ({ copied: false }),
      }),
    ).toBe(EXIT_CODES.success);
    expect(copied.stderr()).toContain("Clipboard is unavailable");
    expect(copied.stdout()).toMatch(/^PERSONA: Teacher/u);
  });

  it("exports atomically with canonical and alias output flags", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-cli-"));
    temporaryDirectories.push(root);
    const canonical = captureIo();
    expect(
      runCli(
        ["export", "detective", "--format", "json", "--output", "nested/detective.json"],
        { io: canonical.io, cwd: root, personasDirectory },
      ),
    ).toBe(EXIT_CODES.success);
    const canonicalFile = join(root, "nested", "detective.json");
    expect(existsSync(canonicalFile)).toBe(true);
    expect(JSON.parse(readFileSync(canonicalFile, "utf8"))).toMatchObject({
      id: "detective",
      locale: "en",
      intensity: "balanced",
    });

    const alias = captureIo();
    expect(
      runCli(["export", "knight", "--out", "knight", "--format", "text"], {
        io: alias.io,
        cwd: root,
        personasDirectory,
      }),
    ).toBe(EXIT_CODES.success);
    expect(existsSync(join(root, "knight.txt"))).toBe(true);

    const defaultFormat = captureIo();
    expect(
      runCli(["export", "wizard", "--output", "wizard.txt"], {
        io: defaultFormat.io,
        cwd: root,
        personasDirectory,
      }),
    ).toBe(EXIT_CODES.success);
    expect(readFileSync(join(root, "wizard.txt"), "utf8")).toMatch(/^PERSONA: Wizard/u);

    const conflict = captureIo();
    expect(
      runCli(
        ["export", "knight", "--output", "one.txt", "--out", "two.txt"],
        { io: conflict.io, cwd: root, personasDirectory },
      ),
    ).toBe(EXIT_CODES.usage);
  });

  it("validates manifests and returns stable error codes", () => {
    const valid = captureIo();
    expect(
      runCli(["validate", personasDirectory], { io: valid.io, personasDirectory }),
    ).toBe(EXIT_CODES.success);
    expect(valid.stdout()).toContain("Validated 7 persona manifests");

    const missing = captureIo();
    expect(
      runCli(["show", "does-not-exist"], { io: missing.io, personasDirectory }),
    ).toBe(EXIT_CODES.notFound);

    const usage = captureIo();
    expect(runCli(["unknown"], { io: usage.io, personasDirectory })).toBe(EXIT_CODES.usage);
    expect(usage.stderr()).toContain("Unknown command");
  });

  it("rejects manifest text that could inject terminal controls", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-cli-unsafe-"));
    temporaryDirectories.push(root);
    const manifest = JSON.parse(
      readFileSync(join(personasDirectory, "teacher", "persona.json"), "utf8"),
    ) as { locales: { en: { name: string } } } & Record<string, unknown>;
    manifest.locales.en.name = "Teacher\u001b]52;c;Zm9yZ2Vk\u0007";
    manifest["field-\u001b]52;c;Zm9yZ2Vk\u0007"] = true;
    const directory = join(root, "teacher");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "persona.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const output = captureIo();
    expect(runCli(["list"], { io: output.io, personasDirectory: root })).toBe(
      EXIT_CODES.failure,
    );
    expect(output.stdout()).toBe("");
    expect(output.stderr()).toContain("/locales/en/name");
    expect(output.stderr()).not.toMatch(/[\u001b\u0007]/u);
    expect(output.stderr()).toContain("\\u001B]52;c;Zm9yZ2Vk\\u0007");
  });

  it("escapes terminal controls from filesystem paths and usage errors", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-cli-path-"));
    temporaryDirectories.push(root);
    mkdirSync(join(root, "spoof\u202ename"));

    const pathOutput = captureIo();
    expect(runCli(["validate", root], { io: pathOutput.io })).toBe(EXIT_CODES.failure);
    expect(pathOutput.stdout()).toBe("");
    expect(pathOutput.stderr()).not.toContain("\u202e");
    expect(pathOutput.stderr()).toContain("\\u202E");

    const usageOutput = captureIo();
    expect(runCli(["bad\u001b[2J\ncommand\u202e"], { io: usageOutput.io })).toBe(
      EXIT_CODES.usage,
    );
    expect(usageOutput.stderr()).not.toMatch(/[\u001b\u202e]/u);
    expect(usageOutput.stderr()).toContain("bad\\u001B[2J\\ncommand\\u202E");
  });

  it("rejects command-specific options that would otherwise be ignored", () => {
    const cases: readonly (readonly [readonly string[], string])[] = [
      [["list", "--intensity", "subtle"], "--intensity is not valid with list"],
      [["validate", "--lang", "ru"], "--locale is not valid with validate"],
      [["validate", "--intensity", "immersive"], "--intensity is not valid with validate"],
      [["validate", "--format", "json"], "--format is not valid with validate"],
      [["show", "teacher", "--out", "ignored.txt"], "--output is not valid with show"],
    ];

    for (const [argv, message] of cases) {
      const output = captureIo();
      expect(runCli(argv, { io: output.io, personasDirectory })).toBe(EXIT_CODES.usage);
      expect(output.stdout()).toBe("");
      expect(output.stderr()).toContain(message);
    }

    const help = captureIo();
    expect(
      runCli(["validate", "--intensity", "immersive", "--help"], {
        io: help.io,
        personasDirectory,
      }),
    ).toBe(EXIT_CODES.success);
    expect(help.stdout()).toContain("Usage:");
  });

  it("distinguishes Node runtime errors from system IO errors", () => {
    for (const [code, expected] of [
      ["ERR_ASSERTION", EXIT_CODES.failure],
      ["ENOENT", EXIT_CODES.io],
    ] as const) {
      const output = captureIo();
      expect(
        runCli(["copy", "teacher"], {
          io: output.io,
          personasDirectory,
          copyText: () => {
            throw Object.assign(new Error(code), { code });
          },
        }),
      ).toBe(expected);
    }
  });
});
