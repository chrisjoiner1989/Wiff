// team.js
import { putTeam, getTeams, deleteTeam } from "./db.js";

export function createTeamTemplate() {
  return {
    id: crypto.randomUUID(),
    name: "New Team",
    players: [], // { id, name, number, positions[], stats }
    createdAt: new Date().toISOString(),
    season: new Date().getFullYear(),
  };
}

export function createPlayerTemplate() {
  return {
    id: crypto.randomUUID(),
    name: "New Player",
    number: 0,
    positions: [], // Array of preferred positions
    stats: {
      batting: {
        atBats: 0,
        hits: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
        walks: 0,
        strikeouts: 0,
        runs: 0,
        rbis: 0,
        errors: 0,
      },
      fielding: {
        gamesPlayed: 0,
        putOuts: 0,
        assists: 0,
        errors: 0,
        fieldingPercentage: 1.0,
      },
      pitching: {
        gamesPitched: 0,
        inningsPitched: 0,
        hits: 0,
        runs: 0,
        earnedRuns: 0,
        walks: 0,
        strikeouts: 0,
        era: 0.0,
      },
    },
  };
}

export function calculatePlayerStats(player) {
  // Ensure stats object exists
  if (!player.stats) {
    player.stats = {
      batting: {
        atBats: 0,
        hits: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
        walks: 0,
        strikeouts: 0,
        runs: 0,
        rbis: 0,
        errors: 0,
      },
      fielding: {
        gamesPlayed: 0,
        putOuts: 0,
        assists: 0,
        errors: 0,
        fieldingPercentage: 1.0,
      },
      pitching: {
        gamesPitched: 0,
        inningsPitched: 0,
        hits: 0,
        runs: 0,
        earnedRuns: 0,
        walks: 0,
        strikeouts: 0,
        era: 0.0,
      },
    };
  }

  const batting = player.stats.batting;
  const fielding = player.stats.fielding;
  const pitching = player.stats.pitching;

  // Batting average
  batting.average =
    batting.atBats > 0 ? (batting.hits / batting.atBats).toFixed(3) : ".000";

  // On-base percentage
  const plateAppearances = batting.atBats + batting.walks;
  batting.obp =
    plateAppearances > 0
      ? ((batting.hits + batting.walks) / plateAppearances).toFixed(3)
      : ".000";

  // Slugging percentage
  const totalBases =
    batting.singles +
    batting.doubles * 2 +
    batting.triples * 3 +
    batting.homeRuns * 4;
  batting.slg =
    batting.atBats > 0 ? (totalBases / batting.atBats).toFixed(3) : ".000";

  // Fielding percentage
  const totalChances = fielding.putOuts + fielding.assists + fielding.errors;
  fielding.fieldingPercentage =
    totalChances > 0
      ? ((fielding.putOuts + fielding.assists) / totalChances).toFixed(3)
      : "1.000";

  // ERA (earned runs per 9 innings)
  pitching.era =
    pitching.inningsPitched > 0
      ? ((pitching.earnedRuns * 9) / pitching.inningsPitched).toFixed(2)
      : "0.00";

  return player;
}

export async function saveTeam(team) {
  if (!team.id) team.id = crypto.randomUUID();

  // Ensure all players have the required structure
  team.players = team.players.map((player) => {
    if (!player.stats) {
      player.stats = {
        batting: {
          atBats: 0,
          hits: 0,
          singles: 0,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
          walks: 0,
          strikeouts: 0,
          runs: 0,
          rbis: 0,
          errors: 0,
        },
        fielding: {
          gamesPlayed: 0,
          putOuts: 0,
          assists: 0,
          errors: 0,
          fieldingPercentage: 1.0,
        },
        pitching: {
          gamesPitched: 0,
          inningsPitched: 0,
          hits: 0,
          runs: 0,
          earnedRuns: 0,
          walks: 0,
          strikeouts: 0,
          era: 0.0,
        },
      };
    }
    return calculatePlayerStats(player);
  });

  await putTeam(team);
  return team;
}

export async function loadTeams() {
  const t = await getTeams();
  return t;
}

export async function removeTeam(id) {
  await deleteTeam(id);
}

export function getPlayerById(teams, playerId) {
  for (const team of teams) {
    if (team.players && Array.isArray(team.players)) {
      const player = team.players.find((p) => p.id === playerId);
      if (player) return { player, team };
    }
  }
  return null;
}

export function updatePlayerStats(playerId, teams, statUpdate) {
  for (const team of teams) {
    if (team.players && Array.isArray(team.players)) {
      const player = team.players.find((p) => p.id === playerId);
      if (player) {
        // Ensure stats object exists
        if (!player.stats) {
          player.stats = {
            batting: {
              atBats: 0,
              hits: 0,
              singles: 0,
              doubles: 0,
              triples: 0,
              homeRuns: 0,
              walks: 0,
              strikeouts: 0,
              runs: 0,
              rbis: 0,
              errors: 0,
            },
            fielding: {
              gamesPlayed: 0,
              putOuts: 0,
              assists: 0,
              errors: 0,
              fieldingPercentage: 1.0,
            },
            pitching: {
              gamesPitched: 0,
              inningsPitched: 0,
              hits: 0,
              runs: 0,
              earnedRuns: 0,
              walks: 0,
              strikeouts: 0,
              era: 0.0,
            },
          };
        }

        // Deep merge the stats update
        Object.keys(statUpdate).forEach((category) => {
          if (statUpdate[category]) {
            Object.keys(statUpdate[category]).forEach((stat) => {
              if (statUpdate[category][stat] !== undefined) {
                player.stats[category][stat] = statUpdate[category][stat];
              }
            });
          }
        });

        // Recalculate derived stats
        calculatePlayerStats(player);
        return { player, team };
      }
    }
  }
  return null;
}
