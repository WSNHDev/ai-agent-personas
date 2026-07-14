export interface PersonaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword?: string;
}

const TERMINAL_CONTROL_PATTERN =
  /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/gu;

export function escapeTerminalControls(value: unknown): string {
  let text: string;
  try {
    text = String(value);
  } catch {
    text = "[unprintable value]";
  }

  return text.replace(TERMINAL_CONTROL_PATTERN, (character) => {
    if (character === "\n") return "\\n";
    if (character === "\r") return "\\r";
    if (character === "\t") return "\\t";
    const codePoint = character.codePointAt(0) ?? 0xfffd;
    return `\\u${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  });
}

export class PersonaError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(escapeTerminalControls(message), options);
    this.name = new.target.name;
  }
}

export class PersonaNotFoundError extends PersonaError {
  public readonly personaId: string;

  public constructor(personaId: string) {
    super(`Persona \"${personaId}\" was not found.`);
    this.personaId = personaId;
  }
}

export class PersonaValidationError extends PersonaError {
  public readonly source: string;
  public readonly issues: readonly PersonaValidationIssue[];

  public constructor(source: string, issues: readonly PersonaValidationIssue[]) {
    const safeSource = escapeTerminalControls(source);
    const safeIssues = issues.map((issue) => ({
      ...issue,
      path: escapeTerminalControls(issue.path),
      message: escapeTerminalControls(issue.message),
    }));
    const details = safeIssues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    super(`Invalid persona manifest at ${safeSource}${details ? ` — ${details}` : ""}`);
    this.source = safeSource;
    this.issues = safeIssues;
  }
}

export class PersonaSourceError extends PersonaError {}
