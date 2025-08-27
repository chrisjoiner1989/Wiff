// ui.js
import {
  createTeamTemplate,
  createPlayerTemplate,
  saveTeam,
  loadTeams,
  removeTeam,
} from "./team.js";
import {
  newGameTemplate,
  saveGame,
  loadGames,
  onBall,
  onStrike,
  onOut,
  onHit,
  onSingle,
  onDouble,
  onTriple,
  onHomeRun,
  onError,
  addRun,
  saveGame as persistGame,
} from "./game.js";
import { getGames as fetchGames } from "./db.js";
import {
  createTournamentTemplate,
  generateBrackets,
  calculateTournamentStandings,
} from "./tournament.js";

// app container element
const app = document.getElementById("app");

export async function renderHome(navigate) {
  const teams = await loadTeams();
  const games = await fetchGames();

  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div>
          <h2 class="h1">Your Games</h2>
          <p class="mb-2">Create games, score live, and view recaps.</p>
        </div>
        <div class="col">
          <button id="new-game-btn">New Game</button>
        </div>
      </div>
      <div style="margin-top:12px">
        <div class="h2">Saved Games</div>
        <div id="games-list" class="col mt-2"></div>
      </div>
    </div>

    <div class="card mt-2">
      <div class="h2">Teams</div>
      <div id="teams-list" class="section-spread mt-2"></div>
      <div style="margin-top:8px">
        <button id="new-team-btn" class="ghost small">+ New Team</button>
      </div>
    </div>

    <div class="card mt-2">
      <div class="h2">Tournaments</div>
      <div id="tournaments-list" class="section-spread mt-2"></div>
      <div style="margin-top:8px">
        <button id="new-tournament-btn" class="ghost small">+ New Tournament</button>
      </div>
    </div>
  `;

  const gamesList = document.getElementById("games-list");
  if (!games || games.length === 0) {
    gamesList.innerHTML = `<div class="mb-2">No games recorded yet</div>`;
  } else {
    gamesList.innerHTML = "";
    games.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    for (const g of games) {
      const el = document.createElement("div");
      el.className = "card mb-2";
      el.innerHTML = `
        <div class="row" style="justify-content:space-between;align-items:center">
          <div>
            <div><strong>${g.away.name}</strong> @ <strong>${
        g.home.name
      }</strong></div>
            <div class="mt-2"><small>${new Date(
              g.createdAt
            ).toLocaleString()}</small></div>
          </div>
          <div class="col">
            <div class="row">
              <button class="ghost small open-game" data-id="${
                g.id
              }">Open</button>
              <button class="danger small delete-game" data-id="${
                g.id
              }">Delete</button>
            </div>
            <div style="text-align:right;margin-top:6px">
              <div><strong>${g.state.total.away}</strong> - <strong>${
        g.state.total.home
      }</strong></div>
              <div class="small">${
                g.state.status === "final" ? "Final" : "In Progress"
              }</div>
            </div>
          </div>
        </div>
      `;
      gamesList.appendChild(el);
    }
  }

  const teamsList = document.getElementById("teams-list");
  teamsList.innerHTML = "";
  for (const t of teams) {
    const node = document.createElement("div");
    node.className = "card team-card";
    node.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${t.name}</strong>
          <div class="small">${t.players?.length ?? 0} players</div>
          <div class="small text-muted">Season ${
            t.season || new Date().getFullYear()
          }</div>
        </div>
        <div class="col">
          <button class="ghost small edit-team" data-id="${t.id}">Edit</button>
          <button class="ghost small view-stats" data-id="${
            t.id
          }">Stats</button>
          <button class="danger small delete-team" data-id="${
            t.id
          }">Delete</button>
        </div>
      </div>
      
      <!-- Player List -->
      <div class="players-list mt-2">
        ${
          t.players && Array.isArray(t.players)
            ? t.players
                .map(
                  (p) => `
          <div class="player-item">
            <span class="player-number">#${p.number || "?"}</span>
            <span class="player-name">${p.name || "Unknown"}</span>
            <span class="player-positions">${
              p.positions?.join(", ") || "No positions"
            }</span>
            <span class="player-stats">
              <span class="batting-avg">${
                p.stats?.batting?.average || ".000"
              }</span>
            </span>
          </div>
        `
                )
                .join("")
            : '<div class="small text-muted">No players added</div>'
        }
      </div>
    `;
    teamsList.appendChild(node);
  }

  // handlers
  document.getElementById("new-game-btn").onclick = () => navigate("setup");
  document.getElementById("new-team-btn").onclick = async () => {
    const t = createTeamTemplate();
    t.name = prompt("Team name", "New Team") || "New Team";
    const players = prompt("Comma separated player names (optional)", "");
    if (players && players.trim()) {
      t.players = players.split(",").map((p, i) => {
        const player = createPlayerTemplate();
        player.name = p.trim();
        player.number = i + 1;
        return player;
      });
    } else {
      t.players = []; // Ensure players is an empty array if no players entered
    }
    await saveTeam(t);
    renderHome(navigate);
  };

  // open / delete game
  document.querySelectorAll(".open-game").forEach((b) => {
    b.onclick = (e) => navigate("score", b.dataset.id);
  });
  document.querySelectorAll(".delete-game").forEach((b) => {
    b.onclick = async (e) => {
      if (!confirm("Delete this game?")) return;
      await window.wiffAPI.deleteGame(b.dataset.id);
      renderHome(navigate);
    };
  });

  document.querySelectorAll(".delete-team").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Delete team?")) return;
      await removeTeam(b.dataset.id);
      renderHome(navigate);
    };
  });

  // edit team (simple inline editor)
  document.querySelectorAll(".edit-team").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id;
      const teams = await loadTeams();
      const team = teams.find((t) => t.id === id);
      if (!team) return;
      const newName = prompt("Team name", team.name) || team.name;
      const players = prompt(
        "Players (comma separated)",
        (team.players || []).map((p) => p.name).join(", ")
      );
      team.name = newName;
      team.players =
        players && players.trim()
          ? players.split(",").map((p, i) => {
              const player = createPlayerTemplate();
              player.name = p.trim();
              player.number = i + 1;
              return player;
            })
          : [];
      await saveTeam(team);
      renderHome(navigate);
    };
  });

  // view team stats
  document.querySelectorAll(".view-stats").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id;
      const teams = await loadTeams();
      const team = teams.find((t) => t.id === id);
      if (!team) return;

      // Show team stats in a modal or expand the card
      const card = b.closest(".team-card");
      const statsSection = card.querySelector(".team-stats");

      if (statsSection) {
        statsSection.remove();
      } else {
        const statsHTML = `
          <div class="team-stats mt-2">
            <div class="h3">Team Statistics</div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">Team Batting Avg</div>
                <div class="stat-value">${calculateTeamBattingAvg(team).toFixed(
                  3
                )}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total Runs</div>
                <div class="stat-value">${calculateTeamTotalRuns(team)}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total HRs</div>
                <div class="stat-value">${calculateTeamTotalHRs(team)}</div>
              </div>
            </div>
          </div>
        `;
        card.insertAdjacentHTML("beforeend", statsHTML);
      }
    };
  });

  // Tournament functionality
  document.getElementById("new-tournament-btn").onclick = async () => {
    const tournament = createTournamentTemplate();
    tournament.name =
      prompt("Tournament name", "New Tournament") || "New Tournament";

    // Select teams for tournament
    const teamIds = prompt("Team IDs (comma separated)", "");
    if (teamIds && teamIds.trim()) {
      const selectedTeams = teams.filter((t) =>
        teamIds
          .split(",")
          .map((id) => id.trim())
          .includes(t.id)
      );
      tournament.teams = selectedTeams;

      // Generate brackets
      generateBrackets(tournament);

      // For now, just show the tournament structure
      alert(
        `Tournament "${tournament.name}" created with ${selectedTeams.length} teams!`
      );
    }
  };
}

export async function renderSetup(navigate) {
  // choose teams and innings
  const teams = await loadTeams();
  let teamOptions = `<option value="">-- None / custom --</option>`;
  for (const t of teams) {
    teamOptions += `<option value="${t.id}">${t.name}</option>`;
  }

  app.innerHTML = `
    <div class="card">
      <h2 class="h1">Start New Game</h2>
      <div class="row mt-2">
        <div class="col team-card">
          <label>Home Team</label>
          <select id="home-select" class="input">${teamOptions}</select>
          <input id="home-name" class="input mt-2" placeholder="Or type home team name">
        </div>
        <div class="col team-card">
          <label>Away Team</label>
          <select id="away-select" class="input">${teamOptions}</select>
          <input id="away-name" class="input mt-2" placeholder="Or type away team name">
        </div>
      </div>

      <div class="row mt-2">
        <div class="col">
          <label>Innings</label>
          <input id="innings" type="number" min="1" max="12" value="6" class="input">
        </div>
        <div class="col">
          <label>Mercy Rule (runs after 4 innings)</label>
          <input id="mercy-rule" type="number" min="5" max="20" value="10" class="input">
        </div>
      </div>

      <!-- Weather Conditions -->
      <div class="card mt-2">
        <h3 class="h2">Weather Conditions</h3>
        <div class="row">
          <div class="col">
            <label>Temperature (°F)</label>
            <input id="temperature" type="number" min="0" max="120" class="input">
          </div>
          <div class="col">
            <label>Wind Speed (mph)</label>
            <input id="wind-speed" type="number" min="0" max="50" class="input">
          </div>
          <div class="col">
            <label>Wind Direction</label>
            <select id="wind-direction" class="input">
              <option value="">No Wind</option>
              <option value="N">North</option>
              <option value="NE">Northeast</option>
              <option value="E">East</option>
              <option value="SE">Southeast</option>
              <option value="S">South</option>
              <option value="SW">Southwest</option>
              <option value="W">West</option>
              <option value="NW">Northwest</option>
            </select>
          </div>
        </div>
        <div class="row mt-2">
          <div class="col">
            <label>Conditions</label>
            <select id="weather-conditions" class="input">
              <option value="">Select</option>
              <option value="sunny">Sunny</option>
              <option value="cloudy">Cloudy</option>
              <option value="rainy">Rainy</option>
              <option value="overcast">Overcast</option>
              <option value="windy">Windy</option>
            </select>
          </div>
          <div class="col">
            <label>Field Surface</label>
            <select id="field-surface" class="input">
              <option value="grass">Grass</option>
              <option value="turf">Turf</option>
              <option value="dirt">Dirt</option>
            </select>
          </div>
          <div class="col">
            <label>Field Conditions</label>
            <select id="field-conditions" class="input">
              <option value="good">Good</option>
              <option value="wet">Wet</option>
              <option value="dry">Dry</option>
              <option value="muddy">Muddy</option>
            </select>
          </div>
        </div>
      </div>

      <div style="margin-top:16px;text-align:right">
        <button id="start-game" class="small">Start Game</button>
        <button id="cancel-setup" class="ghost small">Cancel</button>
      </div>
    </div>
  `;

  const homeSelect = document.getElementById("home-select");
  const awaySelect = document.getElementById("away-select");
  const homeName = document.getElementById("home-name");
  const awayName = document.getElementById("away-name");

  homeSelect.onchange = () => {
    const id = homeSelect.value;
    if (!id) return;
    loadTeams().then((ts) => {
      const t = ts.find((x) => x.id === id);
      if (t) homeName.value = t.name;
    });
  };
  awaySelect.onchange = () => {
    const id = awaySelect.value;
    if (!id) return;
    loadTeams().then((ts) => {
      const t = ts.find((x) => x.id === id);
      if (t) awayName.value = t.name;
    });
  };

  document.getElementById("cancel-setup").onclick = () => navigate("home");
  document.getElementById("start-game").onclick = async () => {
    const g = newGameTemplate();
    g.settings.innings = Math.max(
      1,
      Number(document.getElementById("innings").value) || 6
    );
    g.settings.mercyRule =
      Number(document.getElementById("mercy-rule").value) || 10;

    // set team names
    g.home.name =
      homeName.value.trim() ||
      (homeSelect.value
        ? (await loadTeams()).find((t) => t.id === homeSelect.value).name
        : "Home");
    g.away.name =
      awayName.value.trim() ||
      (awaySelect.value
        ? (await loadTeams()).find((t) => t.id === awaySelect.value).name
        : "Away");

    // Set weather conditions
    const temperature = document.getElementById("temperature").value;
    const windSpeed = document.getElementById("wind-speed").value;
    const windDirection = document.getElementById("wind-direction").value;
    const conditions = document.getElementById("weather-conditions").value;

    if (temperature) g.weather.temperature = Number(temperature);
    if (windSpeed) g.weather.windSpeed = Number(windSpeed);
    if (windDirection) g.weather.windDirection = windDirection;
    if (conditions) g.weather.conditions = conditions;

    // Set field conditions
    const fieldSurface = document.getElementById("field-surface").value;
    const fieldConditions = document.getElementById("field-conditions").value;

    if (fieldSurface) g.field.surface = fieldSurface;
    if (fieldConditions) g.field.conditions = fieldConditions;

    // init scoreByInning objects
    g.state.scoreByInning = { home: {}, away: {} };
    g.state.total = { home: 0, away: 0 };

    await saveGame(g);
    navigate("score", g.id);
  };
}

export async function renderScore(gameId, navigate) {
  // load games and find
  const games = await loadGames();
  const game = games.find((g) => g.id === gameId);
  if (!game) {
    app.innerHTML = `<div class="card"><p>Game not found.</p><button id="back-home">Back</button></div>`;
    document.getElementById("back-home").onclick = () => navigate("home");
    return;
  }

  function render() {
    app.innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div>
            <div class="h1">${game.away.name} @ ${game.home.name}</div>
            <div class="small">${new Date(
              game.createdAt
            ).toLocaleString()}</div>
          </div>
          <div class="col">
            <div class="scoreboard">
              <div>
                <div class="small">Away</div>
                <div class="score-big">${game.state.total.away}</div>
              </div>
              <div>
                <div class="small">Inning</div>
                <div class="score-mini">${game.state.inning} ${
      game.state.half === "top" ? "▲" : "▼"
    }</div>
              </div>
              <div>
                <div class="small">Home</div>
                <div class="score-big">${game.state.total.home}</div>
              </div>
            </div>
            <div class="mt-2 small">Outs: ${game.state.outs} • Count: ${
      game.state.balls
    }-${game.state.strikes}</div>
          </div>
        </div>

        <div class="mt-2">
          <!-- Primary Game Controls -->
          <div class="controls primary-controls">
            <button id="strike-btn">Strike</button>
            <button id="ball-btn">Ball</button>
            <button id="out-btn">Out</button>
            <button id="hit-btn">Hit</button>
            <button id="run-btn">+ Run</button>
            <button id="undo-btn" class="ghost">Undo</button>
          </div>
          
          <!-- Advanced Hit Options -->
          <div class="controls secondary-controls mt-2">
            <button id="single-btn" class="ghost">Single</button>
            <button id="double-btn" class="ghost">Double</button>
            <button id="triple-btn" class="ghost">Triple</button>
            <button id="homerun-btn" class="ghost">Home Run</button>
            <button id="error-btn" class="ghost">Error</button>
          </div>
          
          <!-- Base Running Display -->
          <div class="bases-display mt-2">
            <div class="small">Bases:</div>
            <div class="bases-grid">
              <div class="base base-3rd ${
                game.state.bases.third ? "occupied" : ""
              }">3rd</div>
              <div class="base base-2nd ${
                game.state.bases.second ? "occupied" : ""
              }">2nd</div>
              <div class="base base-1st ${
                game.state.bases.first ? "occupied" : ""
              }">1st</div>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="action-buttons mt-2">
            <button id="end-game" class="danger small">End Game</button>
            <button id="save-game" class="small ghost">Save</button>
            <button id="back-home" class="ghost small">Back</button>
          </div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="h2">Play-by-play</div>
        <div id="log" class="log mt-2"></div>
      </div>

      <div class="card mt-2">
        <div class="h2">Box Score</div>
        <div id="boxscore" class="mt-2"></div>
      </div>
    `;

    // wire events
    document.getElementById("strike-btn").onclick = async () => {
      onStrike(game);
      await persistGame(game);
      render();
    };
    document.getElementById("ball-btn").onclick = async () => {
      onBall(game);
      await persistGame(game);
      render();
    };
    document.getElementById("out-btn").onclick = async () => {
      onOut(game);
      await persistGame(game);
      render();
    };
    document.getElementById("hit-btn").onclick = async () => {
      onHit(game);
      await persistGame(game);
      render();
    };

    // Advanced hit buttons
    document.getElementById("single-btn").onclick = async () => {
      onSingle(game);
      await persistGame(game);
      render();
    };
    document.getElementById("double-btn").onclick = async () => {
      onDouble(game);
      await persistGame(game);
      render();
    };
    document.getElementById("triple-btn").onclick = async () => {
      onTriple(game);
      await persistGame(game);
      render();
    };
    document.getElementById("homerun-btn").onclick = async () => {
      onHomeRun(game);
      await persistGame(game);
      render();
    };
    document.getElementById("error-btn").onclick = async () => {
      onError(game);
      await persistGame(game);
      render();
    };

    document.getElementById("run-btn").onclick = async () => {
      const n = Number(prompt("Runs to add", "1")) || 1;
      addRun(game, n);
      await persistGame(game);
      render();
    };
    document.getElementById("end-game").onclick = async () => {
      game.state.status = "final";
      await persistGame(game);
      render();
    };
    document.getElementById("save-game").onclick = async () => {
      await persistGame(game);
      alert("Saved");
    };
    document.getElementById("back-home").onclick = () => navigate("home");

    // log render
    const logEl = document.getElementById("log");
    logEl.innerHTML = game.state.events
      .map((e) => {
        const time = new Date(e.ts).toLocaleTimeString();
        if (e.type === "run")
          return `<div>${time} — ${e.team.toUpperCase()} +${
            e.runs
          } run(s) (inning ${e.inning})</div>`;
        return `<div>${time} — ${e.type}</div>`;
      })
      .join("");

    // boxscore
    const box = document.getElementById("boxscore");
    const innings = Math.max(game.settings.innings, game.state.inning);
    let html =
      '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Team</th>';
    for (let i = 1; i <= innings; i++) html += `<th>${i}</th>`;
    html += "<th>R</th></tr></thead><tbody>";
    const row = (team) => {
      let r = `<tr><td style="padding:6px"><strong>${
        team === "home" ? game.home.name : game.away.name
      }</strong></td>`;
      for (let i = 1; i <= innings; i++) {
        r += `<td style="padding:6px;text-align:center">${
          game.state.scoreByInning[team][i] || 0
        }</td>`;
      }
      r += `<td style="padding:6px;text-align:center"><strong>${game.state.total[team]}</strong></td></tr>`;
      return r;
    };
    html += row("away");
    html += row("home");
    html += "</tbody></table></div>";
    box.innerHTML = html;
  } // render()

  render();
}

// Team statistics helper functions
function calculateTeamBattingAvg(team) {
  if (!team.players || team.players.length === 0) return 0;

  const totalHits = team.players.reduce(
    (sum, p) => sum + (p.stats?.batting?.hits || 0),
    0
  );
  const totalAtBats = team.players.reduce(
    (sum, p) => sum + (p.stats?.batting?.atBats || 0),
    0
  );

  return totalAtBats > 0 ? totalHits / totalAtBats : 0;
}

function calculateTeamTotalRuns(team) {
  if (!team.players) return 0;
  return team.players.reduce(
    (sum, p) => sum + (p.stats?.batting?.runs || 0),
    0
  );
}

function calculateTeamTotalHRs(team) {
  if (!team.players) return 0;
  return team.players.reduce(
    (sum, p) => sum + (p.stats?.batting?.homeRuns || 0),
    0
  );
}
