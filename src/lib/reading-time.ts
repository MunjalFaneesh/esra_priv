/**
 * Reading estimate from a word count.
 *
 * 220 wpm is a reasonable average for technical prose — slower than the
 * ~250 often quoted for fiction, since these posts carry code and specs.
 */
export function readingTime(wordCount?: number): string | null {
  if (!wordCount || wordCount < 1) return null;
  const minutes = Math.max(1, Math.round(wordCount / 220));
  return `${minutes} min`;
}
