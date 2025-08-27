// stats.js
// derive simple batting stats from games
export function computePlayerStats(games, playerName) {
  // naive: look through events for hits/walks/out assigned to player (if events include player info)
  // Our current game.events don't include player info by default. This function scaffolds future use.
  return {
    atBats: 0,
    hits: 0,
    walks: 0,
    battingAverage: 0,
  };
}

export function teamSeasonTotals(games, teamIdOrName) {
  // sum totals
  const totals = { runs: 0, games: 0 };
  for (const g of games) {
    totals.runs +=
      (g.home.name === teamIdOrName ? g.state.total.home : 0) +
      (g.away.name === teamIdOrName ? g.state.total.away : 0);
    totals.games += 1;
  }
  return totals;
}
