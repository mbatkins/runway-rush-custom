export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { playerId, displayName, mode, score } = req.body || {};
  const date = new Intl.DateTimeFormat(
  "en-CA",
  {
    timeZone: "America/Chicago"
  }
).format(new Date());

  if (!playerId || !displayName || !mode || typeof score !== "number") {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const cleanName = String(displayName).trim().slice(0, 20);
  const banned = ["hitler","nazi","kkk","whitepower","fuck","shit","bitch","asshole","admin","administrator","moderator","alpa","united airlines"];
  const normalized = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (cleanName.length < 3 || banned.some(word => normalized.includes(word.replace(/[^a-z0-9]/g, "")))) {
    return res.status(400).json({ error: "That display name is not allowed. Please choose another." });
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  async function redis(command) {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command)
    });
    return r.json();
  }

  const todayKey = `rr:today:${date}:${mode}`;
  const allTimeKey = `rr:alltime:${mode}`;
  const playerKey = `rr:player:${playerId}:${mode}`;
  const todayPlayerKey = `rr:playerday:${date}:${mode}:${playerId}`;
  const daysKey = `rr:days:${mode}:${playerId}`;

  const oldToday = await redis(["GET", todayPlayerKey]);

const alreadyPlayedToday =
  oldToday.result !== null &&
  oldToday.result !== undefined;

if (alreadyPlayedToday) {
  return res.status(200).json({
    ok: true,
    ignored: true
  });
}

await redis([
  "ZADD",
  todayKey,
  score,
  playerId
]);

await redis([
  "SET",
  todayPlayerKey,
  score
]);

await redis([
  "ZINCRBY",
  allTimeKey,
  score,
  playerId
]);

  await redis(["SADD", daysKey, date]);
  await redis(["HSET", playerKey, "name", cleanName, "lastPlayed", date]);
  await redis(["EXPIRE", todayKey, 60 * 60 * 48]);

  res.status(200).json({ ok: true });
}
