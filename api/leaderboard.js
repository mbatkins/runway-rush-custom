export default async function handler(req, res) {
  const mode = req.query.mode || "mixed";
  const playerId = req.query.playerId || "";
  function chicagoDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;

  return `${y}-${m}-${d}`;
}

const date = chicagoDate();

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

  function parseHash(result) {
    if (!result) return {};
    if (!Array.isArray(result)) return result;
    const obj = {};
    for (let i = 0; i < result.length; i += 2) obj[result[i]] = result[i + 1];
    return obj;
  }

  async function hydrate(entries) {
    const rows = [];
    for (let i = 0; i < entries.length; i += 2) {
      const id = entries[i];
      const score = Number(entries[i + 1]);
      const p = await redis(["HGETALL", `rr:player:${id}:${mode}`]);
      const player = parseHash(p.result);
      rows.push({ id, name: player.name || "Anonymous Pilot", score });
    }
    return rows;
  }

  const todayKey = `rr:today:${date}:${mode}`;
  const allTimeKey = `rr:alltime:${mode}`;

  const todayRaw = await redis(["ZREVRANGE", todayKey, 0, 9, "WITHSCORES"]);
  const allTimeRaw = await redis(["ZREVRANGE", allTimeKey, 0, 9, "WITHSCORES"]);

  const today = await hydrate(todayRaw.result || []);
  const allTime = await hydrate(allTimeRaw.result || []);
const flightsToday = today.length;

const highestScore =
  today.length > 0
    ? today[0].score
    : 0;

const averageScore =
  today.length > 0
    ? (
        today.reduce((sum, p) => sum + p.score, 0) /
        today.length
      ).toFixed(1)
    : "0.0";

const todaysLeader =
  today.length > 0
    ? today[0].name
    : "--";
  let todayRank = null, allTimeRank = null, todayScore = null, allTimePoints = null, daysPlayed = 0;

  if (playerId) {
    const tr = await redis(["ZREVRANK", todayKey, playerId]);
    const ar = await redis(["ZREVRANK", allTimeKey, playerId]);
    const ts = await redis(["ZSCORE", todayKey, playerId]);
    const ap = await redis(["ZSCORE", allTimeKey, playerId]);
    const dp = await redis(["SCARD", `rr:days:${mode}:${playerId}`]);

    todayRank = tr.result !== null ? tr.result + 1 : null;
    allTimeRank = ar.result !== null ? ar.result + 1 : null;
    todayScore = ts.result !== null ? Number(ts.result) : null;
    allTimePoints = ap.result !== null ? Number(ap.result) : 0;
    daysPlayed = dp.result || 0;
  }

  res.status(200).json({ today, allTime, todayRank, allTimeRank, todayScore, allTimePoints, daysPlayed });
}
