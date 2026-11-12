const STATS =
    "https://cpzhsztczixiidxypvmb.supabase.co/rest/v1/rpc/visit_stats",
  KEY = "sb_publishable_M8UMcKf1BrHMbCuCVJ1P3g_-Bwnwd2W";
const $ = (id) => document.getElementById(id),
  number = (n) => Number(n).toLocaleString("en-US");

function row(label, visits, most) {
  const li = document.createElement("li"),
    name = document.createElement("b"),
    track = document.createElement("i"),
    bar = document.createElement("u"),
    n = document.createElement("span");
  name.textContent = label;
  bar.style.width = Math.max(2, (visits / most) * 100) + "%";
  n.textContent = number(visits);
  track.append(bar);
  li.append(name, track, n);
  return li;
}
async function load() {
  try {
    const r = await fetch(STATS, {
        method: "POST",
        headers: { apikey: KEY, "Content-Type": "application/json" },
        body: "{}",
      }),
      d = await r.json();
    if (!r.ok) throw new Error(d.message || r.status);
    $("now").textContent = number(d.last_30_min);
    $("today").textContent = number(d.today);
    $("all").textContent = number(d.all_time);
    const NAMES = {
        x: "X",
        reddit: "Reddit",
        hn: "Hacker News",
        google: "Google",
        search: "Other search engines",
        ai: "AI assistants",
        facebook: "Facebook",
        instagram: "Instagram",
        threads: "Threads",
        tiktok: "TikTok",
        youtube: "YouTube",
        linkedin: "LinkedIn",
        bluesky: "Bluesky",
        discord: "Discord",
        github: "GitHub",
        text: "Text message",
        email: "Email",
        other: "Other sites",
        direct: "Direct",
      },
      top = Math.max(1, ...(d.sources || []).map((x) => x.visits));
    $("from").replaceChildren(
      ...(d.sources || []).map((x) =>
        row(NAMES[x.src] || x.src, x.visits, top),
      ),
    );
    const most = Math.max(1, ...d.days.map((x) => x.visits));
    $("days").replaceChildren(
      ...d.days.map((x) =>
        row(
          new Date(x.day + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          x.visits,
          most,
        ),
      ),
    );
    $("when").textContent =
      "Updated " +
      new Date().toLocaleTimeString("en-US") +
      ". Refreshes every minute.";
  } catch (e) {
    $("when").textContent = "Could not load the numbers. " + e.message;
  }
}
async function notes() {
  try {
    const r = await fetch(STATS.replace(/visit_stats$/, "feedback_count"), {
        method: "POST",
        headers: { apikey: KEY, "Content-Type": "application/json" },
        body: "{}",
      }),
      d = await r.json();
    if (r.ok) $("notes").textContent = number(d.all_time);
  } catch (e) {}
}
load();
notes();
setInterval(() => {
  load();
  notes();
}, 60000);
