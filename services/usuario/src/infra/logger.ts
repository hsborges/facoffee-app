export type Level = 'debug' | 'info' | 'warn' | 'error';
export type Logger = Readonly<
  Record<Level, (message: string, fields?: Record<string, unknown>) => void>
>;

const serialize = (_key: string, value: unknown) =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;

// One JSON line per entry, on stdout.
export const createLogger = (
  service: string,
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): Logger => {
  const log = (level: Level) => (message: string, fields?: Record<string, unknown>) =>
    write(
      JSON.stringify(
        { time: new Date().toISOString(), level, service, message, ...fields },
        serialize,
      ),
    );
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
};
