import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  PersonaNotFoundError,
  PersonaSourceError,
  PersonaValidationError,
  compilePersona,
  escapeTerminalControls,
  isPersonaIntensity,
  isPersonaLocale,
  isPersonaOutputFormat,
  listPersonas,
  validatePersonaPath,
  type PersonaIntensity,
  type PersonaLocale,
  type PersonaOutputFormat,
  type PersonaSourceOptions,
  type PersonaSummary,
} from "@ai-agent-personas/core";

import { copyToClipboard, type ClipboardResult } from "./clipboard.js";
import { EXIT_CODES, type ExitCode } from "./exit-codes.js";

const require = createRequire(import.meta.url);
const packageMetadata = require("../package.json") as { readonly version?: unknown };
if (typeof packageMetadata.version !== "string" || packageMetadata.version.length === 0) {
  throw new Error("ai-agent-personas package.json has no valid version.");
}
const VERSION = packageMetadata.version;

const HELP = `AI Agent Personas ${VERSION}

Usage:
  ai-agent-personas list [--locale en|ru] [--format text|markdown|json]
  ai-agent-personas show <id> [--locale en|ru] [--intensity subtle|balanced|immersive] [--format text|markdown|json]
  ai-agent-personas copy <id> [--locale en|ru] [--intensity subtle|balanced|immersive] [--format text|markdown|json]
  ai-agent-personas export <id> [--locale en|ru] [--intensity subtle|balanced|immersive] [--format text|markdown|json] [--output <file>]
  ai-agent-personas validate [path]

Options:
  -l, --locale      Output locale (default: en; --lang is an alias)
  -i, --intensity   Persona intensity (default: balanced)
  -f, --format      Output format (default: text; show defaults to markdown)
  -o, --output      Export destination; use - for stdout (--out is an alias)
  -h, --help        Show help
      --version     Show version

Exit codes:
  0 success, 1 validation/runtime failure, 2 invalid usage,
  3 persona not found, 4 filesystem/source error
`;

class CliUsageError extends Error {}

export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface CliContext {
  readonly cwd?: string;
  readonly io?: CliIo;
  readonly personasDirectory?: string;
  readonly copyText?: (text: string) => ClipboardResult;
}

interface ParsedCli {
  readonly command: string | undefined;
  readonly positionals: readonly string[];
  readonly locale: PersonaLocale;
  readonly intensity: PersonaIntensity;
  readonly format: PersonaOutputFormat | undefined;
  readonly output: string | undefined;
  readonly help: boolean;
  readonly version: boolean;
  readonly providedOptions: ReadonlySet<ParsedOption>;
}

type ParsedOption = "locale" | "intensity" | "format" | "output";

const defaultIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

function parseValue<T extends string>(
  raw: string | undefined,
  fallback: T,
  predicate: (value: string) => value is T,
  optionName: string,
): T {
  const value = raw ?? fallback;
  if (!predicate(value)) {
    throw new CliUsageError(`Invalid ${optionName}: ${value}`);
  }
  return value;
}

function parseRawArgs(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      locale: { type: "string", short: "l" },
      lang: { type: "string" },
      intensity: { type: "string", short: "i" },
      format: { type: "string", short: "f" },
      output: { type: "string", short: "o" },
      out: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", default: false },
    },
  });
}

function parseCli(argv: readonly string[]): ParsedCli {
  let parsed: ReturnType<typeof parseRawArgs>;
  try {
    parsed = parseRawArgs(argv);
  } catch (error) {
    throw new CliUsageError(error instanceof Error ? error.message : String(error));
  }

  const [command, ...positionals] = parsed.positionals;
  if (
    parsed.values.locale !== undefined &&
    parsed.values.lang !== undefined &&
    parsed.values.locale !== parsed.values.lang
  ) {
    throw new CliUsageError("--locale and --lang cannot have conflicting values.");
  }
  if (
    parsed.values.output !== undefined &&
    parsed.values.out !== undefined &&
    parsed.values.output !== parsed.values.out
  ) {
    throw new CliUsageError("--output and --out cannot have conflicting values.");
  }
  const rawFormat = parsed.values.format;
  let format: PersonaOutputFormat | undefined;
  if (rawFormat !== undefined) {
    if (!isPersonaOutputFormat(rawFormat)) {
      throw new CliUsageError(`Invalid --format: ${rawFormat}`);
    }
    format = rawFormat;
  }

  const providedOptions = new Set<ParsedOption>();
  if (parsed.values.locale !== undefined || parsed.values.lang !== undefined) {
    providedOptions.add("locale");
  }
  if (parsed.values.intensity !== undefined) providedOptions.add("intensity");
  if (rawFormat !== undefined) providedOptions.add("format");
  if (parsed.values.output !== undefined || parsed.values.out !== undefined) {
    providedOptions.add("output");
  }

  return {
    command,
    positionals,
    locale: parseValue(
      parsed.values.locale ?? parsed.values.lang,
      "en",
      isPersonaLocale,
      "--locale",
    ),
    intensity: parseValue(
      parsed.values.intensity,
      "balanced",
      isPersonaIntensity,
      "--intensity",
    ),
    format,
    output: parsed.values.output ?? parsed.values.out,
    help: parsed.values.help ?? false,
    version: parsed.values.version ?? false,
    providedOptions,
  };
}

function assertPositionals(
  command: string,
  positionals: readonly string[],
  minimum: number,
  maximum = minimum,
): void {
  if (positionals.length < minimum || positionals.length > maximum) {
    throw new CliUsageError(
      `${command} expects ${minimum === maximum ? minimum : `${minimum}-${maximum}`} argument${maximum === 1 ? "" : "s"}.`,
    );
  }
}

function renderList(
  summaries: readonly PersonaSummary[],
  locale: PersonaLocale,
  format: PersonaOutputFormat,
): string {
  if (format === "json") {
    return `${JSON.stringify(
      summaries.map((persona) => ({
        id: persona.id,
        name: persona.name[locale],
        summary: persona.summary[locale],
        category: persona.category,
        tags: persona.tags,
        version: persona.version,
      })),
      null,
      2,
    )}\n`;
  }

  if (format === "markdown") {
    const heading = locale === "ru" ? "| ID | Имя | Описание |" : "| ID | Name | Summary |";
    const rows = summaries.map(
      (persona) =>
        `| ${persona.id} | ${persona.name[locale].replaceAll("|", "\\|")} | ${persona.summary[locale].replaceAll("|", "\\|")} |`,
    );
    return `${[heading, "| --- | --- | --- |", ...rows].join("\n")}\n`;
  }

  const idWidth = Math.max(2, ...summaries.map((persona) => persona.id.length));
  return `${summaries
    .map(
      (persona) =>
        `${persona.id.padEnd(idWidth)}  ${persona.name[locale]} — ${persona.summary[locale]}`,
    )
    .join("\n")}\n`;
}

function extensionFor(format: PersonaOutputFormat): string {
  return format === "markdown" ? "md" : format === "json" ? "json" : "txt";
}

function writeAtomically(file: string, contents: string): void {
  const directory = dirname(file);
  mkdirSync(directory, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, contents, { encoding: "utf8", flag: "w" });
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function rejectIrrelevantOptions(parsed: ParsedCli): void {
  const allowedByCommand: Readonly<Record<string, readonly ParsedOption[]>> = {
    list: ["locale", "format"],
    show: ["locale", "intensity", "format"],
    copy: ["locale", "intensity", "format"],
    export: ["locale", "intensity", "format", "output"],
    validate: [],
  };
  const allowed = parsed.command ? allowedByCommand[parsed.command] : undefined;
  if (!allowed) return;

  for (const option of parsed.providedOptions) {
    if (!allowed.includes(option)) {
      throw new CliUsageError(`--${option} is not valid with ${parsed.command}.`);
    }
  }
}

function isSystemIoError(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return false;
  }
  return error.code.startsWith("E") && !error.code.startsWith("ERR_");
}

export function runCli(argv: readonly string[], context: CliContext = {}): ExitCode {
  const io = context.io ?? defaultIo;
  const cwd = resolve(context.cwd ?? process.cwd());
  const writeStderrLine = (message: unknown): void => {
    io.stderr(`${escapeTerminalControls(message)}\n`);
  };

  try {
    const parsed = parseCli(argv);
    if (parsed.version) {
      io.stdout(`${VERSION}\n`);
      return EXIT_CODES.success;
    }
    if (parsed.help || !parsed.command) {
      io.stdout(HELP);
      return EXIT_CODES.success;
    }

    rejectIrrelevantOptions(parsed);
    const sourceOptions: PersonaSourceOptions = context.personasDirectory
      ? { personasDirectory: context.personasDirectory }
      : {};

    switch (parsed.command) {
      case "list": {
        assertPositionals("list", parsed.positionals, 0);
        const summaries = listPersonas(sourceOptions);
        io.stdout(renderList(summaries, parsed.locale, parsed.format ?? "text"));
        return EXIT_CODES.success;
      }
      case "show": {
        assertPositionals("show", parsed.positionals, 1);
        const id = parsed.positionals[0];
        if (!id) throw new CliUsageError("show requires a persona id.");
        io.stdout(
          compilePersona(id, {
            ...sourceOptions,
            locale: parsed.locale,
            intensity: parsed.intensity,
            format: parsed.format ?? "markdown",
          }),
        );
        return EXIT_CODES.success;
      }
      case "copy": {
        assertPositionals("copy", parsed.positionals, 1);
        const id = parsed.positionals[0];
        if (!id) throw new CliUsageError("copy requires a persona id.");
        const contents = compilePersona(id, {
          ...sourceOptions,
          locale: parsed.locale,
          intensity: parsed.intensity,
          format: parsed.format ?? "text",
        });
        const result = (context.copyText ?? copyToClipboard)(contents);
        if (result.copied) {
          writeStderrLine(
            `Copied ${id} to the clipboard${result.method ? ` via ${result.method}` : ""}.`,
          );
        } else {
          io.stderr("Clipboard is unavailable; writing the compiled prompt to stdout.\n");
          io.stdout(contents);
        }
        return EXIT_CODES.success;
      }
      case "export": {
        assertPositionals("export", parsed.positionals, 1);
        const id = parsed.positionals[0];
        if (!id) throw new CliUsageError("export requires a persona id.");
        const format = parsed.format ?? "text";
        const contents = compilePersona(id, {
          ...sourceOptions,
          locale: parsed.locale,
          intensity: parsed.intensity,
          format,
        });
        if (parsed.output === "-") {
          io.stdout(contents);
          return EXIT_CODES.success;
        }
        const defaultName = `${id}.${parsed.locale}.${parsed.intensity}.${extensionFor(format)}`;
        let outputFile = resolve(cwd, parsed.output ?? defaultName);
        if (!extname(outputFile) && parsed.output) {
          outputFile = `${outputFile}.${extensionFor(format)}`;
        }
        writeAtomically(outputFile, contents);
        writeStderrLine(`Exported ${id} to ${outputFile}.`);
        return EXIT_CODES.success;
      }
      case "validate": {
        assertPositionals("validate", parsed.positionals, 0, 1);
        const inputPath = parsed.positionals[0]
          ? resolve(cwd, parsed.positionals[0])
          : context.personasDirectory;
        const report = validatePersonaPath(inputPath);
        if (!report.valid) {
          for (const failure of report.failures) {
            writeStderrLine(failure.message);
          }
          return EXIT_CODES.failure;
        }
        io.stdout(
          `Validated ${report.checked} persona manifest${report.checked === 1 ? "" : "s"}: ${report.personaIds.join(", ")}\n`,
        );
        return EXIT_CODES.success;
      }
      default:
        throw new CliUsageError(`Unknown command: ${parsed.command}`);
    }
  } catch (error) {
    if (error instanceof CliUsageError) {
      writeStderrLine(error.message);
      io.stderr("Run ai-agent-personas --help for usage.\n");
      return EXIT_CODES.usage;
    }
    if (error instanceof PersonaNotFoundError) {
      writeStderrLine(error.message);
      return EXIT_CODES.notFound;
    }
    if (error instanceof PersonaValidationError) {
      writeStderrLine(error.message);
      return EXIT_CODES.failure;
    }
    if (error instanceof PersonaSourceError) {
      writeStderrLine(error.message);
      return EXIT_CODES.io;
    }
    writeStderrLine(error instanceof Error ? error.message : error);
    return isSystemIoError(error) ? EXIT_CODES.io : EXIT_CODES.failure;
  }
}

export { HELP, VERSION };
