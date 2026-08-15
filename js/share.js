const Share = (() => {
  function emoji(row) {
    if (row.skipped || !row.tally) return "⬜";
    if (row.tally.city) return "🟩";
    if (row.tally.country) return "🟨";
    if (row.tally.continent) return "🟧";
    return "🟥";
  }

  function formatResults({ dateKey, score, maxScore, history }) {
    const lines = [
      `Nadir ${dateKey}`,
      `${Number(score).toLocaleString("en-US")}/${Number(maxScore).toLocaleString("en-US")}`,
      "",
    ];
    history.forEach((row) => {
      const named = row.skipped || !row.guess ? "Skipped" : row.guess.name;
      const pts = row.skipped ? "—" : String(row.points);
      lines.push(`${emoji(row)} ${row.from.name} → ${named}  ${pts}`);
    });
    return lines.join("\n");
  }

  async function copy(text) {
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

  function tweetUrl(text) {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }

  return { emoji, formatResults, copy, tweetUrl };
})();

if (typeof module !== "undefined") module.exports = Share;
