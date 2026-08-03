/** Format a captured note as a Markdown task line for the inbox file. */
export function inboxLine(text: string): string {
  return `- [ ] ${text}\n`
}
