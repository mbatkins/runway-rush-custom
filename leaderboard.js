export default async function handler(req, res) {
  const mode = req.query.mode || "classic";
  const playerId = req.query.playerId || "";
  const date = new Date().toISOString().slice(0, 10);

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  async function redis(command) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });
    return r.json();
  }

  async function hydrate(entries, keyPrefix) {
    const rows = [];
    for (let i = 0; i < entries.length; i += 2) {
      const id = entries[i];
      const score = Number(entries[i + 1]);
      const p = await redis(["HGETALL", `rr:player:${id}:${mode}`]);
      rows.push({
        id,
        name: p.result?.name || "Anonymous Pilot",
        score
      });
    }
    return rows;
  }

  const todayKey = `rr:today:${date}:${mode}`;
  const allTimeKey = `rr:alltime:${mode}`;

  const todayRaw = await redis(["ZREVRANGE", todayKey, 0, 9, "WITHSCORES"]);
  const allTimeRaw = await redis(["ZREVRANGE", allTimeKey, 0, 9, "WITHSCORES"]);

  const today = await hydrate(todayRaw.result || [], todayKey);
  const allTime = await hydrate(allTimeRaw.result || [], allTimeKey);

  let todayRank = null;
  let allTimeRank = null;

  if (playerId) {
    const tr = await redis(["ZREVRANK", todayKey, playerId]);
    const ar = await redis(["ZREVRANK", allTimeKey, playerId]);

    todayRank = tr.result !== null ? tr.result + 1 : null;
    allTimeRank = ar.result !== null ? ar.result + 1 : null;
  }

  res.status(200).json({ today, allTime, todayRank, allTimeRank });
}
