export const EXIT_CODES = {
  success: 0,
  failure: 1,
  usage: 2,
  notFound: 3,
  io: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
