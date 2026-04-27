export function formatTaggedTestName(name: string, tags: readonly string[] = []): string {
  if (tags.length === 0) {
    return name;
  }

  const normalizedTags = tags
    .map((tag) => tag.trim().replace(/^@+/, ''))
    .filter(Boolean)
    .map((tag) => `@${tag}`);

  return normalizedTags.length > 0
    ? `${name} ${normalizedTags.join(' ')}`
    : name;
}
