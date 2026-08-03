/** Quote a value for safe inclusion in a POSIX shell command line. */
export function shellQuote(value: string): string {
  // Wrap in single quotes; escape embedded single quotes the usual way.
  return `'${value.replaceAll("'", `'\\''`)}'`
}
