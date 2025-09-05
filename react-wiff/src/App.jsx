import { useEffect, useMemo, useState } from 'react'
import { newGameTemplate, saveGame, loadGames, addRun, onStrike, onBall, onOut, onHit, onSingle, onDouble, onTriple, onHomeRun, onError } from './js/game.js'
import { createTeamTemplate, createPlayerTemplate, saveTeam, loadTeams, removeTeam } from './js/team.js'

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.replace('#', ''))
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.replace('#', ''))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const route = useMemo(() => {
    if (!hash) return { name: 'home', id: null }
    const [name, id] = hash.split('/')
    return { name: name || 'home', id: id || null }
  }, [hash])
  const navigate = (name, id) => {
    if (name === 'home') window.location.hash = ''
    else if (name === 'setup') window.location.hash = 'setup'
    else if (name === 'score') window.location.hash = `score/${id}`
  }
  return { route, navigate }
}

function App() {
  const { route, navigate } = useHashRoute()

  return (
    <main id="app" className="container">
      {route.name === 'home' && <HomePage navigate={navigate} />}
      {route.name === 'setup' && <SetupPage navigate={navigate} />}
      {route.name === 'score' && <ScorePage id={route.id} navigate={navigate} />}
    </main>
  )
}

function HomePage({ navigate }) {
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])

  useEffect(() => {
    ;(async () => {
      setTeams(await loadTeams())
      setGames(await loadGames())
    })()
  }, [])

  const onNewTeam = async () => {
    const t = createTeamTemplate()
    t.name = prompt('Team name', 'New Team') || 'New Team'
    const players = prompt('Comma separated player names (optional)', '')
    if (players && players.trim()) {
      t.players = players.split(',').map((p, i) => {
        const player = createPlayerTemplate()
        player.name = p.trim()
        player.number = i + 1
        return player
      })
    } else {
      t.players = []
    }
    await saveTeam(t)
    setTeams(await loadTeams())
  }

  const onDeleteTeam = async (id) => {
    if (!confirm('Delete team?')) return
    await removeTeam(id)
    setTeams(await loadTeams())
  }

  const onDeleteGame = async (id) => {
    if (!confirm('Delete this game?')) return
    const { deleteGame } = await import('./js/db.js')
    await deleteGame(id)
    setGames(await loadGames())
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="h1">Your Games</h2>
            <p className="mb-2">Create games, score live, and view recaps.</p>
          </div>
          <div className="col">
            <button id="new-game-btn" onClick={() => navigate('setup')}>New Game</button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="h2">Saved Games</div>
          <div id="games-list" className="col mt-2">
            {!games || games.length === 0 ? (
              <div className="mb-2">No games recorded yet</div>
            ) : (
              games
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((g) => (
                  <div key={g.id} className="card mb-2">
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div>
                          <strong>{g.away.name}</strong> @ <strong>{g.home.name}</strong>
                        </div>
                        <div className="mt-2"><small>{new Date(g.createdAt).toLocaleString()}</small></div>
                      </div>
                      <div className="col">
                        <div className="row">
                          <button className="ghost small" onClick={() => navigate('score', g.id)}>Open</button>
                          <button className="danger small" onClick={() => onDeleteGame(g.id)}>Delete</button>
                        </div>
                        <div style={{ textAlign: 'right', marginTop: 6 }}>
                          <div>
                            <strong>{g.state.total.away}</strong> - <strong>{g.state.total.home}</strong>
                          </div>
                          <div className="small">{g.state.status === 'final' ? 'Final' : 'In Progress'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      <div className="card mt-2">
        <div className="h2">Teams</div>
        <div id="teams-list" className="section-spread mt-2">
          {teams.map((t) => (
            <div key={t.id} className="card team-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{t.name}</strong>
                  <div className="small">{t.players?.length ?? 0} players</div>
                  <div className="small text-muted">Season {t.season || new Date().getFullYear()}</div>
                </div>
                <div className="col">
                  {/* Edit/Stats omitted for brevity in first pass */}
                  <button className="danger small" onClick={() => onDeleteTeam(t.id)}>Delete</button>
                </div>
              </div>
              <div className="players-list mt-2">
                {t.players?.length ? (
                  t.players.map((p) => (
                    <div key={p.id} className="player-item">
                      <span className="player-number">#{p.number || '?'}</span>
                      <span className="player-name">{p.name || 'Unknown'}</span>
                      <span className="player-positions">{p.positions?.join(', ') || 'No positions'}</span>
                      <span className="player-stats">
                        <span className="batting-avg">{p.stats?.batting?.average || '.000'}</span>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="small text-muted">No players added</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <button id="new-team-btn" className="ghost small" onClick={onNewTeam}>+ New Team</button>
        </div>
      </div>
    </>
  )
}

function SetupPage({ navigate }) {
  const [teams, setTeams] = useState([])
  const [homeId, setHomeId] = useState('')
  const [awayId, setAwayId] = useState('')
  const [homeName, setHomeName] = useState('')
  const [awayName, setAwayName] = useState('')
  const [innings, setInnings] = useState(6)
  const [mercyRule, setMercyRule] = useState(10)
  const [temperature, setTemperature] = useState('')
  const [windSpeed, setWindSpeed] = useState('')
  const [windDirection, setWindDirection] = useState('')
  const [conditions, setConditions] = useState('')
  const [fieldSurface, setFieldSurface] = useState('grass')
  const [fieldConditions, setFieldConditions] = useState('good')

  useEffect(() => { loadTeams().then(setTeams) }, [])

  useEffect(() => {
    if (homeId) {
      const t = teams.find((x) => x.id === homeId)
      if (t) setHomeName(t.name)
    }
  }, [homeId, teams])
  useEffect(() => {
    if (awayId) {
      const t = teams.find((x) => x.id === awayId)
      if (t) setAwayName(t.name)
    }
  }, [awayId, teams])

  const startGame = async () => {
    const g = newGameTemplate()
    g.settings.innings = Math.max(1, Number(innings) || 6)
    g.settings.mercyRule = Number(mercyRule) || 10
    g.home.name = homeName.trim() || (homeId ? (teams.find((t) => t.id === homeId)?.name || 'Home') : 'Home')
    g.away.name = awayName.trim() || (awayId ? (teams.find((t) => t.id === awayId)?.name || 'Away') : 'Away')

    if (temperature) g.weather.temperature = Number(temperature)
    if (windSpeed) g.weather.windSpeed = Number(windSpeed)
    if (windDirection) g.weather.windDirection = windDirection
    if (conditions) g.weather.conditions = conditions

    if (fieldSurface) g.field.surface = fieldSurface
    if (fieldConditions) g.field.conditions = fieldConditions

    g.state.scoreByInning = { home: {}, away: {} }
    g.state.total = { home: 0, away: 0 }

    await saveGame(g)
    navigate('score', g.id)
  }

  return (
    <div className="card">
      <h2 className="h1">Start New Game</h2>
      <div className="row mt-2">
        <div className="col team-card">
          <label>Home Team</label>
          <select className="input" value={homeId} onChange={(e) => setHomeId(e.target.value)}>
            <option value="">-- None / custom --</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input className="input mt-2" placeholder="Or type home team name" value={homeName} onChange={(e) => setHomeName(e.target.value)} />
        </div>
        <div className="col team-card">
          <label>Away Team</label>
          <select className="input" value={awayId} onChange={(e) => setAwayId(e.target.value)}>
            <option value="">-- None / custom --</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input className="input mt-2" placeholder="Or type away team name" value={awayName} onChange={(e) => setAwayName(e.target.value)} />
        </div>
      </div>

      <div className="row mt-2">
        <div className="col">
          <label>Innings</label>
          <input type="number" min="1" max="12" className="input" value={innings} onChange={(e) => setInnings(e.target.value)} />
        </div>
        <div className="col">
          <label>Mercy Rule (runs after 4 innings)</label>
          <input type="number" min="5" max="20" className="input" value={mercyRule} onChange={(e) => setMercyRule(e.target.value)} />
        </div>
      </div>

      <div className="card mt-2">
        <h3 className="h2">Weather Conditions</h3>
        <div className="row">
          <div className="col">
            <label>Temperature (°F)</label>
            <input type="number" min="0" max="120" className="input" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </div>
          <div className="col">
            <label>Wind Speed (mph)</label>
            <input type="number" min="0" max="50" className="input" value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} />
          </div>
          <div className="col">
            <label>Wind Direction</label>
            <select className="input" value={windDirection} onChange={(e) => setWindDirection(e.target.value)}>
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
        <div className="row mt-2">
          <div className="col">
            <label>Conditions</label>
            <select className="input" value={conditions} onChange={(e) => setConditions(e.target.value)}>
              <option value="">Select</option>
              <option value="sunny">Sunny</option>
              <option value="cloudy">Cloudy</option>
              <option value="rainy">Rainy</option>
              <option value="overcast">Overcast</option>
              <option value="windy">Windy</option>
            </select>
          </div>
          <div className="col">
            <label>Field Surface</label>
            <select className="input" value={fieldSurface} onChange={(e) => setFieldSurface(e.target.value)}>
              <option value="grass">Grass</option>
              <option value="turf">Turf</option>
              <option value="dirt">Dirt</option>
            </select>
          </div>
          <div className="col">
            <label>Field Conditions</label>
            <select className="input" value={fieldConditions} onChange={(e) => setFieldConditions(e.target.value)}>
              <option value="good">Good</option>
              <option value="wet">Wet</option>
              <option value="dry">Dry</option>
              <option value="muddy">Muddy</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <button id="start-game" className="small" onClick={startGame}>Start Game</button>
        <button id="cancel-setup" className="ghost small" onClick={() => navigate('home')}>Cancel</button>
      </div>
    </div>
  )
}

function ScorePage({ id, navigate }) {
  const [game, setGame] = useState(null)

  useEffect(() => {
    ;(async () => {
      const all = await loadGames()
      const g = all.find((x) => x.id === id)
      setGame(g || null)
    })()
  }, [id])

  const update = async (mutator) => {
    if (!game) return
    mutator(game)
    await saveGame(game)
    setGame({ ...game })
  }

  if (!game) {
    return (
      <div className="card"><p>Game not found.</p><button onClick={() => navigate('home')}>Back</button></div>
    )
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="h1">{game.away.name} @ {game.home.name}</div>
            <div className="small">{new Date(game.createdAt).toLocaleString()}</div>
          </div>
          <div className="col">
            <div className="scoreboard">
              <div>
                <div className="small">Away</div>
                <div className="score-big">{game.state.total.away}</div>
              </div>
              <div>
                <div className="small">Inning</div>
                <div className="score-mini">{game.state.inning} {game.state.half === 'top' ? '▲' : '▼'}</div>
              </div>
              <div>
                <div className="small">Home</div>
                <div className="score-big">{game.state.total.home}</div>
              </div>
            </div>
            <div className="mt-2 small">Outs: {game.state.outs} • Count: {game.state.balls}-{game.state.strikes}</div>
          </div>
        </div>

        <div className="mt-2">
          <div className="controls primary-controls">
            <button onClick={() => update(onStrike)}>Strike</button>
            <button onClick={() => update(onBall)}>Ball</button>
            <button onClick={() => update(onOut)}>Out</button>
            <button onClick={() => update(onHit)}>Hit</button>
            <button onClick={() => update((g) => addRun(g, 1))}>+ Run</button>
          </div>

          <div className="controls secondary-controls mt-2">
            <button className="ghost" onClick={() => update(onSingle)}>Single</button>
            <button className="ghost" onClick={() => update(onDouble)}>Double</button>
            <button className="ghost" onClick={() => update(onTriple)}>Triple</button>
            <button className="ghost" onClick={() => update(onHomeRun)}>Home Run</button>
            <button className="ghost" onClick={() => update(onError)}>Error</button>
          </div>

          <div className="bases-display mt-2">
            <div className="small">Bases:</div>
            <div className="bases-grid">
              <div className={`base base-3rd ${game.state.bases.third ? 'occupied' : ''}`}>3rd</div>
              <div className={`base base-2nd ${game.state.bases.second ? 'occupied' : ''}`}>2nd</div>
              <div className={`base base-1st ${game.state.bases.first ? 'occupied' : ''}`}>1st</div>
            </div>
          </div>

          <div className="action-buttons mt-2">
            <button className="danger small" onClick={() => update((g) => { g.state.status = 'final' })}>End Game</button>
            <button className="small ghost" onClick={async () => { await saveGame(game); alert('Saved') }}>Save</button>
            <button className="ghost small" onClick={() => navigate('home')}>Back</button>
          </div>
        </div>
      </div>

      <div className="card mt-2">
        <div className="h2">Play-by-play</div>
        <div id="log" className="log mt-2">
          {game.state.events.map((e) => {
            const time = new Date(e.ts).toLocaleTimeString()
            if (e.type === 'run') return <div key={e.ts}>{time} — {e.team.toUpperCase()} +{e.runs} run(s) (inning {e.inning})</div>
            return <div key={e.ts}>{time} — {e.type}</div>
          })}
        </div>
      </div>

      <div className="card mt-2">
        <div className="h2">Box Score</div>
        <div id="boxscore" className="mt-2">
          <BoxScore game={game} />
        </div>
      </div>
    </>
  )
}

function BoxScore({ game }) {
  const innings = Math.max(game.settings.innings, game.state.inning)
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Team</th>
            {Array.from({ length: innings }, (_, i) => (
              <th key={i + 1}>{i + 1}</th>
            ))}
            <th>R</th>
          </tr>
        </thead>
        <tbody>
          {['away', 'home'].map((team) => (
            <tr key={team}>
              <td style={{ padding: 6 }}><strong>{team === 'home' ? game.home.name : game.away.name}</strong></td>
              {Array.from({ length: innings }, (_, i) => (
                <td key={i + 1} style={{ padding: 6, textAlign: 'center' }}>{game.state.scoreByInning[team][i + 1] || 0}</td>
              ))}
              <td style={{ padding: 6, textAlign: 'center' }}><strong>{game.state.total[team]}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
