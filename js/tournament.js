// tournament.js
import { putGame, getGames } from "./db.js";

export function createTournamentTemplate() {
  return {
    id: crypto.randomUUID(),
    name: "New Tournament",
    season: new Date().getFullYear(),
    startDate: new Date().toISOString(),
    endDate: null,
    status: "upcoming", // upcoming, active, completed
    teams: [],
    games: [],
    brackets: {
      type: "single_elimination", // single_elimination, double_elimination, round_robin, swiss
      rounds: [],
      currentRound: 0,
    },
    settings: {
      maxTeams: 16,
      consolationGames: true,
      thirdPlaceGame: true,
      seedingMethod: "random", // random, record, ranking
    },
  };
}

export function createBracketRound(
  roundNumber,
  teams,
  type = "single_elimination"
) {
  const round = {
    roundNumber,
    name: getRoundName(roundNumber, type),
    games: [],
    status: "pending", // pending, active, completed
  };

  if (type === "single_elimination") {
    // Create bracket games
    const numGames = Math.ceil(teams.length / 2);
    for (let i = 0; i < numGames; i++) {
      const game = {
        id: crypto.randomUUID(),
        round: roundNumber,
        gameNumber: i + 1,
        team1: teams[i * 2] || null,
        team2: teams[i * 2 + 1] || null,
        winner: null,
        loser: null,
        status: "scheduled", // scheduled, in_progress, completed
        gameId: null, // links to actual game data
      };
      round.games.push(game);
    }
  }

  return round;
}

function getRoundName(roundNumber, type) {
  if (type === "single_elimination") {
    const names = [
      "Championship",
      "Semifinals",
      "Quarterfinals",
      "Round of 16",
      "Round of 32",
    ];
    return names[roundNumber - 1] || `Round ${roundNumber}`;
  }
  return `Round ${roundNumber}`;
}

export function advanceTeamInBracket(tournament, gameId, winner, loser) {
  const game = findGameInBracket(tournament, gameId);
  if (!game) return tournament;

  game.winner = winner;
  game.loser = loser;
  game.status = "completed";

  // Find next game in bracket
  const nextGame = findNextGame(tournament, game);
  if (nextGame) {
    if (!nextGame.team1) {
      nextGame.team1 = winner;
    } else if (!nextGame.team2) {
      nextGame.team2 = winner;
    }
  }

  return tournament;
}

function findGameInBracket(tournament, gameId) {
  for (const round of tournament.brackets.rounds) {
    for (const game of round.games) {
      if (game.id === gameId) return game;
    }
  }
  return null;
}

function findNextGame(tournament, currentGame) {
  const nextRound = tournament.brackets.rounds.find(
    (r) => r.roundNumber === currentGame.round - 1
  );
  if (!nextRound) return null;

  const gameIndex = Math.floor((currentGame.gameNumber - 1) / 2);
  return nextRound.games[gameIndex] || null;
}

export function generateBrackets(tournament) {
  const { teams, brackets } = tournament;
  const numRounds = Math.ceil(Math.log2(teams.length));

  brackets.rounds = [];

  // Create championship round first
  const championshipRound = createBracketRound(1, [], "single_elimination");
  brackets.rounds.push(championshipRound);

  // Work backwards to create all rounds
  for (let round = 2; round <= numRounds; round++) {
    const numGames = Math.pow(2, round - 1);
    const roundTeams = new Array(numGames).fill(null);
    const bracketRound = createBracketRound(
      round,
      roundTeams,
      "single_elimination"
    );
    brackets.rounds.push(bracketRound);
  }

  // Reverse to get correct order (earliest rounds first)
  brackets.rounds.reverse();

  // Populate first round with teams
  if (brackets.rounds.length > 0) {
    const firstRound = brackets.rounds[0];
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);

    for (let i = 0; i < firstRound.games.length; i++) {
      if (shuffledTeams[i * 2]) {
        firstRound.games[i].team1 = shuffledTeams[i * 2];
      }
      if (shuffledTeams[i * 2 + 1]) {
        firstRound.games[i].team2 = shuffledTeams[i * 2 + 1];
      }
    }
  }

  return tournament;
}

export function calculateTournamentStandings(tournament) {
  const standings = [];

  for (const team of tournament.teams) {
    const teamGames = tournament.games.filter(
      (g) => g.home?.id === team.id || g.away?.id === team.id
    );

    const wins = teamGames.filter((g) => {
      if (g.state?.status !== "final") return false;
      if (g.home?.id === team.id)
        return g.state.total.home > g.state.total.away;
      return g.state.total.away > g.state.total.home;
    }).length;

    const losses = teamGames.filter((g) => {
      if (g.state?.status !== "final") return false;
      if (g.home?.id === team.id)
        return g.state.total.home < g.state.total.away;
      return g.state.total.away < g.state.total.home;
    }).length;

    const runsFor = teamGames.reduce((total, g) => {
      if (g.home?.id === team.id) return total + (g.state?.total?.home || 0);
      return total + (g.state?.total?.away || 0);
    }, 0);

    const runsAgainst = teamGames.reduce((total, g) => {
      if (g.home?.id === team.id) return total + (g.state?.total?.away || 0);
      return total + (g.state?.total?.home || 0);
    }, 0);

    standings.push({
      team,
      wins,
      losses,
      winPercentage:
        wins + losses > 0 ? (wins / (wins + losses)).toFixed(3) : ".000",
      runsFor,
      runsAgainst,
      runDifferential: runsFor - runsAgainst,
      gamesPlayed: wins + losses,
    });
  }

  // Sort by win percentage, then run differential
  return standings.sort((a, b) => {
    if (a.winPercentage !== b.winPercentage) {
      return parseFloat(b.winPercentage) - parseFloat(a.winPercentage);
    }
    return b.runDifferential - a.runDifferential;
  });
}

export function getTournamentProgress(tournament) {
  const totalGames = tournament.brackets.rounds.reduce(
    (total, round) => total + round.games.length,
    0
  );

  const completedGames = tournament.brackets.rounds.reduce(
    (total, round) =>
      total + round.games.filter((g) => g.status === "completed").length,
    0
  );

  return {
    totalGames,
    completedGames,
    percentage:
      totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0,
  };
}
