const BASE_URL = "https://api.football-data.org/v4";

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Shared across requests in the same server process.
const rateLimitState = {
  available: null as number | null,
  resetAt: null as number | null,
};

export function getFootballRateLimit() {
  return { ...rateLimitState };
}

export async function fdFetch(path: string): Promise<unknown> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY is not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-Auth-Token": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const available = res.headers.get("X-Requests-Available-Minute");
  const resetAt = res.headers.get("X-RequestCounter-Reset");
  if (available !== null) rateLimitState.available = Number(available);
  if (resetAt !== null) rateLimitState.resetAt = Number(resetAt) * 1000;

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const waitSec = retryAfter ? Math.ceil(Number(retryAfter)) : 60;
    const resetMsg = rateLimitState.resetAt
      ? ` (window resets at ${new Date(rateLimitState.resetAt).toISOString()})`
      : "";
    throw new RateLimitError(
      `football-data.org rate limit hit - retry in ${waitSec}s${resetMsg}`,
      waitSec,
    );
  }

  if (!res.ok) {
    throw new Error(`football-data.org returned ${res.status} for ${path}`);
  }

  return res.json();
}
