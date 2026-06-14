// Browser-equivalent headers required to fetch from cdn.nba.com (Akamai edge)
// and stats.nba.com without getting blocked or rate-limited.
export const NBA_CDN_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
};

export const NBA_STATS_HEADERS: HeadersInit = {
  ...NBA_CDN_HEADERS,
  Host: "stats.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};
