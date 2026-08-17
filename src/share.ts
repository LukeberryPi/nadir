import type { HistoryRow, ScoreTally } from "./types.ts";

type ShareRow = {
  from: { name: string };
  guess: { name: string } | null;
  points: number;
  tally?: Pick<ScoreTally, "city" | "country" | "continent"> | null;
  skipped: boolean;
};

export function emoji(row: ShareRow) {
  if (row.skipped || !row.tally) return "⬜";
  if (row.tally.city) return "🟩";
  if (row.tally.country) return "🟨";
  if (row.tally.continent) return "🟧";
  return "🟥";
}

export function formatResults({
  dateKey,
  score,
  maxScore,
  history,
}: {
  dateKey: string;
  score: number;
  maxScore: number;
  history: ShareRow[] | HistoryRow[];
}) {
  const lines = [
    `Nadir ${dateKey}`,
    `${Number(score).toLocaleString("en-US")}/${Number(maxScore).toLocaleString("en-US")}`,
    "",
  ];
  for (const row of history) {
    const named = row.skipped || !row.guess ? "Skipped" : row.guess.name;
    const pts = row.skipped ? "—" : String(row.points);
    lines.push(`${emoji(row)} ${row.from.name} → ${named}  ${pts}`);
  }
  return lines.join("\n");
}

export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function tweetUrl(text: string) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
