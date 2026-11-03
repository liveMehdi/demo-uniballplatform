export async function checkResponse(response: Response, fallback: string) {
  if (response.ok) return;

  const body: unknown = await response.json().catch(() => null);
  const message =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
      ? body.error
      : fallback;
  throw new Error(message);
}
