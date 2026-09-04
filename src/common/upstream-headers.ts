const GOOGLE_UPLOAD_RESPONSE_HEADERS = new Set([
  'content-type',
  'etag',
  'location',
]);

export function filterGoogleUploadHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, string | string[]> {
  if (!headers) return {};

  const filtered: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalizedName = name.toLowerCase();
    if (
      !GOOGLE_UPLOAD_RESPONSE_HEADERS.has(normalizedName) &&
      !normalizedName.startsWith('x-goog-upload-')
    ) {
      continue;
    }

    if (typeof value === 'string') {
      filtered[normalizedName] = value;
    } else if (typeof value === 'number') {
      filtered[normalizedName] = String(value);
    } else if (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    ) {
      filtered[normalizedName] = value;
    }
  }
  return filtered;
}
