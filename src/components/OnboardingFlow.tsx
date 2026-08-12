import React, { useEffect, useMemo, useState } from 'react';
import { getTeamRoster, getTeams } from '../services/mlbApi';
import { supabase } from '../services/supabaseClient';

type TeamOption = {
  id: number;
  name: string;
  abbreviation?: string;
};

type PlayerOption = {
  id: number;
  name: string;
  position: string;
};

type NotificationPreferences = {
  gameUpdates: boolean;
  playerNews: boolean;
  injuryUpdates: boolean;
  weeklyDigest: boolean;
};

interface OnboardingFlowProps {
  onComplete: () => void;
}

const FALLBACK_TEAMS: TeamOption[] = [
  { id: 108, name: 'Los Angeles Angels', abbreviation: 'LAA' },
  { id: 109, name: 'Arizona Diamondbacks', abbreviation: 'ARI' },
  { id: 110, name: 'Baltimore Orioles', abbreviation: 'BAL' },
  { id: 111, name: 'Boston Red Sox', abbreviation: 'BOS' },
  { id: 112, name: 'Chicago Cubs', abbreviation: 'CHC' },
  { id: 113, name: 'Cincinnati Reds', abbreviation: 'CIN' },
  { id: 114, name: 'Cleveland Guardians', abbreviation: 'CLE' },
  { id: 115, name: 'Colorado Rockies', abbreviation: 'COL' },
  { id: 116, name: 'Detroit Tigers', abbreviation: 'DET' },
  { id: 117, name: 'Houston Astros', abbreviation: 'HOU' },
  { id: 118, name: 'Kansas City Royals', abbreviation: 'KC' },
  { id: 119, name: 'Los Angeles Dodgers', abbreviation: 'LAD' },
  { id: 120, name: 'Washington Nationals', abbreviation: 'WSH' },
  { id: 121, name: 'New York Mets', abbreviation: 'NYM' },
  { id: 133, name: 'Athletics', abbreviation: 'ATH' },
  { id: 134, name: 'Pittsburgh Pirates', abbreviation: 'PIT' },
  { id: 135, name: 'San Diego Padres', abbreviation: 'SD' },
  { id: 136, name: 'Seattle Mariners', abbreviation: 'SEA' },
  { id: 137, name: 'San Francisco Giants', abbreviation: 'SF' },
  { id: 138, name: 'St. Louis Cardinals', abbreviation: 'STL' },
  { id: 139, name: 'Tampa Bay Rays', abbreviation: 'TB' },
  { id: 140, name: 'Texas Rangers', abbreviation: 'TEX' },
  { id: 141, name: 'Toronto Blue Jays', abbreviation: 'TOR' },
  { id: 142, name: 'Minnesota Twins', abbreviation: 'MIN' },
  { id: 143, name: 'Philadelphia Phillies', abbreviation: 'PHI' },
  { id: 144, name: 'Atlanta Braves', abbreviation: 'ATL' },
  { id: 145, name: 'Chicago White Sox', abbreviation: 'CWS' },
  { id: 146, name: 'Miami Marlins', abbreviation: 'MIA' },
  { id: 147, name: 'New York Yankees', abbreviation: 'NYY' },
  { id: 158, name: 'Milwaukee Brewers', abbreviation: 'MIL' },
].sort((a, b) => a.name.localeCompare(b.name));

const STAT_OPTIONS = [
  { key: 'AVG', label: 'Batting Average', group: 'Hitting' },
  { key: 'OBP', label: 'On-base Percentage', group: 'Hitting' },
  { key: 'SLG', label: 'Slugging', group: 'Hitting' },
  { key: 'OPS', label: 'OPS', group: 'Hitting' },
  { key: 'HR', label: 'Home Runs', group: 'Hitting' },
  { key: 'RBI', label: 'RBI', group: 'Hitting' },
  { key: 'SB', label: 'Stolen Bases', group: 'Hitting' },
  { key: 'ERA', label: 'ERA', group: 'Pitching' },
  { key: 'WHIP', label: 'WHIP', group: 'Pitching' },
  { key: 'K9', label: 'K / 9', group: 'Pitching' },
  { key: 'VELOCITY', label: 'Pitch Velocity', group: 'Pitching' },
  { key: 'MATCHUP_EDGE', label: 'Matchup Edge', group: 'Scouting' },
];

const STEP_LABELS = ['Favorite Team', 'Favorite Players', 'Preferred Stats', 'Notifications'];

const teamLogo = (teamId: number) => `https://www.mlbstatic.com/team-logos/${teamId}.svg`;

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [teams, setTeams] = useState<TeamOption[]>(FALLBACK_TEAMS);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamSearch, setTeamSearch] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState<TeamOption | null>(null);
  const [roster, setRoster] = useState<PlayerOption[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [favoritePlayers, setFavoritePlayers] = useState<PlayerOption[]>([]);
  const [preferredStats, setPreferredStats] = useState<string[]>(['OPS', 'ERA', 'WHIP', 'MATCHUP_EDGE']);
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    gameUpdates: true,
    playerNews: true,
    injuryUpdates: true,
    weeklyDigest: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTeams()
      .then((data) => {
        if (!active || !Array.isArray(data) || data.length === 0) return;
        setTeams(data);
      })
      .catch(() => {
        // The fallback list keeps onboarding usable if MLB's public API is briefly unavailable.
      })
      .finally(() => {
        if (active) setTeamsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!favoriteTeam) {
      setRoster([]);
      setFavoritePlayers([]);
      return;
    }

    let active = true;
    setRosterLoading(true);
    setRoster([]);
    setFavoritePlayers((players) => players.filter((player) => player.id));

    getTeamRoster(favoriteTeam.id)
      .then((data: any) => {
        if (!active) return;
        const players = (data?.roster ?? [])
          .map((entry: any): PlayerOption | null => {
            const id = Number(entry?.person?.id);
            if (!id) return null;
            return {
              id,
              name: entry?.person?.fullName ?? 'MLB Player',
              position: entry?.position?.abbreviation ?? '',
            };
          })
          .filter(Boolean) as PlayerOption[];
        setRoster(players.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setRoster([]))
      .finally(() => {
        if (active) setRosterLoading(false);
      });

    return () => {
      active = false;
    };
  }, [favoriteTeam?.id]);

  const filteredTeams = useMemo(() => {
    const needle = teamSearch.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((team) => `${team.name} ${team.abbreviation ?? ''}`.toLowerCase().includes(needle));
  }, [teams, teamSearch]);

  const filteredRoster = useMemo(() => {
    const needle = playerSearch.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter((player) => `${player.name} ${player.position}`.toLowerCase().includes(needle));
  }, [roster, playerSearch]);

  const togglePlayer = (player: PlayerOption) => {
    setFavoritePlayers((current) => {
      if (current.some((item) => item.id === player.id)) {
        return current.filter((item) => item.id !== player.id);
      }
      if (current.length >= 10) return current;
      return [...current, player];
    });
  };

  const toggleStat = (key: string) => {
    setPreferredStats((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const savePreferences = async () => {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const existing = data.user?.user_metadata ?? {};
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...existing,
          onboarding_complete: true,
          favorite_team: favoriteTeam
            ? { id: favoriteTeam.id, name: favoriteTeam.name, abbreviation: favoriteTeam.abbreviation ?? null }
            : null,
          favorite_players: favoritePlayers.map((player) => ({
            id: player.id,
            name: player.name,
            position: player.position,
          })),
          preferred_stats: preferredStats,
          notification_preferences: notifications,
        },
      });
      if (updateError) throw updateError;
    } catch (err: any) {
      setError(err?.message || 'We could not save your preferences. Please try again.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const continueFlow = async () => {
    setError(null);
    if (step < 3) {
      setStep((current) => current + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      await savePreferences();
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Error is already shown in the UI.
    }
  };

  const skipThisStep = async () => {
    if (step < 3) {
      setStep((current) => current + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    await continueFlow();
  };

  const skipAll = async () => {
    try {
      await savePreferences();
      onComplete();
    } catch {
      // Keep the onboarding screen open so the user can retry.
    }
  };

  if (step === 4) {
    return (
      <div className="min-h-screen w-full bg-[#07101f] text-[#dae2fd] px-4 py-8 sm:px-6 lg:px-10 overflow-x-hidden">
        <div className="mx-auto max-w-7xl">
          <div className="flex justify-center">
            <div className="flex items-center gap-3">
              <img src="/scoutcore-logo-email.png" alt="ScoutCoreMLB" className="h-12 w-12 rounded-xl" />
              <div>
                <div className="text-sm font-bold tracking-[.18em] text-[#00f0ff]">SCOUTCOREMLB</div>
                <div className="text-[10px] uppercase tracking-[.2em] text-[#718090]">Baseball Intelligence</div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <svg className="sc-welcome-check h-16 w-16 text-[#00f0ff]" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <circle className="sc-welcome-circle" cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="3" />
              <path className="sc-welcome-tick" d="M19 33.5 28.5 43 46 23.5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="mx-auto mt-5 max-w-3xl text-center">
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Welcome to ScoutCoreMLB!</h1>
            <p className="mt-3 text-base text-[#aebbd0] sm:text-lg">Your account is ready. Your preferences are saved and your ScoutCore experience can now be more personal.</p>
          </div>

          <div className="mx-auto mt-8 h-px w-28 bg-[#00f0ff]" />
          <h2 className="mt-7 text-center text-lg font-bold text-white">Here’s what your free account adds:</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['analytics', 'Scouting Reports', 'Use account-only report actions and keep your scouting workflow connected.'],
              ['bookmark', 'Saved Preferences', 'Keep your favorite team, players, and preferred stats attached to your account.'],
              ['tune', 'Personalized Setup', 'ScoutCore can use the baseball preferences you selected during setup.'],
              ['notifications', 'Alert Preferences', 'Save the game, player, injury, and digest updates you care about most.'],
              ['groups', 'Community Access', 'Post, comment, and take part in the ScoutCoreMLB baseball community.'],
            ].map(([icon, title, copy]) => (
              <div key={title} className="rounded-2xl border border-[#34425a] bg-[#10192b] p-5 text-center">
                <span className="material-symbols-outlined text-3xl text-[#00f0ff]">{icon}</span>
                <h3 className="mt-4 font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#91a0b5]">{copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-2xl border border-[#00f0ff]/25 bg-[#00f0ff]/5 p-5 sm:flex sm:items-center sm:justify-center sm:gap-4">
            <span className="material-symbols-outlined block text-center text-3xl text-[#00f0ff]">star</span>
            <div className="mt-2 text-center sm:mt-0 sm:text-left">
              <div className="font-bold text-[#7df4ff]">You’re all set!</div>
              <div className="mt-1 text-sm text-[#aebbd0]">You can update these preferences later as ScoutCoreMLB adds more personalization controls.</div>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-lg">
            <button
              type="button"
              onClick={onComplete}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#00f0ff] px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-[#00363a] hover:bg-[#7df4ff]"
            >
              Go to Dashboard
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const teamStep = (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
      <section className="rounded-2xl border border-[#34425a] bg-[#0f182b] p-5 sm:p-6">
        <div className="text-xs font-bold uppercase tracking-[.18em] text-[#00f0ff]">Step 1 of 4</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Choose your favorite MLB team</h2>
        <p className="mt-2 text-sm text-[#aebbd0]">We’ll save this to your ScoutCoreMLB account for personalization.</p>

        <label className="mt-5 block text-xs uppercase tracking-wider text-[#849495]" htmlFor="team-search">Search teams</label>
        <div className="relative mt-2">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718090]">search</span>
          <input
            id="team-search"
            value={teamSearch}
            onChange={(event) => setTeamSearch(event.target.value)}
            className="w-full rounded-xl border border-[#34425a] bg-[#0b1326] py-3 pl-11 pr-3 text-sm text-white outline-none focus:border-[#00f0ff]"
            placeholder="Search teams..."
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredTeams.map((team) => {
            const selected = favoriteTeam?.id === team.id;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setFavoriteTeam(team)}
                className={`relative min-h-28 rounded-xl border p-3 transition ${selected ? 'border-[#00f0ff] bg-[#00f0ff]/10' : 'border-[#2d3b52] bg-[#101a2d] hover:border-[#58708d]'}`}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#00f0ff] text-[#00363a]">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </span>
                )}
                <img src={teamLogo(team.id)} alt="" className="mx-auto h-12 w-12 object-contain" />
                <div className="mt-2 text-xs font-semibold leading-4 text-[#dae2fd]">{team.name.replace(/^(Los Angeles|New York|San Francisco|San Diego|St\. Louis|Kansas City|Tampa Bay|Toronto|Washington|Philadelphia|Pittsburgh|Baltimore|Boston|Chicago|Cincinnati|Cleveland|Colorado|Detroit|Houston|Minnesota|Milwaukee|Miami|Seattle|Texas|Atlanta|Arizona)\s/, '')}</div>
              </button>
            );
          })}
        </div>
        {teamsLoading && <p className="mt-3 text-xs text-[#718090]">Refreshing the MLB team list…</p>}
      </section>

      <aside className="rounded-2xl border border-[#34425a] bg-[#0f182b] p-5 sm:p-6">
        <h3 className="text-lg font-bold text-white">Why choose a favorite team?</h3>
        <div className="mt-6 space-y-5">
          {[
            ['home', 'Personalized home base', 'Keep your main team attached to your ScoutCoreMLB account.'],
            ['calendar_month', 'Games & schedules', 'Make it easier to focus on the games and matchups you care about.'],
            ['group', 'Roster preferences', 'Choose favorite players from your team in the next step.'],
            ['star', 'Better recommendations', 'Your team preference can guide future ScoutCore personalization.'],
          ].map(([icon, title, copy]) => (
            <div key={title} className="flex gap-4">
              <span className="material-symbols-outlined mt-0.5 text-2xl text-[#00f0ff]">{icon}</span>
              <div>
                <div className="font-semibold text-white">{title}</div>
                <div className="mt-1 text-sm leading-6 text-[#91a0b5]">{copy}</div>
              </div>
            </div>
          ))}
        </div>
        {favoriteTeam && (
          <div className="mt-7 flex items-center gap-4 rounded-xl border border-[#00f0ff]/25 bg-[#00f0ff]/5 p-4">
            <img src={teamLogo(favoriteTeam.id)} alt="" className="h-14 w-14 object-contain" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#00f0ff]">Your team</div>
              <div className="mt-1 font-bold text-white">{favoriteTeam.name}</div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );

  const playerStep = (
    <section className="rounded-2xl border border-[#34425a] bg-[#0f182b] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[.18em] text-[#00f0ff]">Step 2 of 4</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Choose your favorite players</h2>
          <p className="mt-2 text-sm text-[#aebbd0]">Pick up to 10 players. You can skip this step if you want.</p>
        </div>
        {favoriteTeam && (
          <div className="flex items-center gap-3 rounded-xl border border-[#34425a] bg-[#101a2d] px-4 py-3">
            <img src={teamLogo(favoriteTeam.id)} alt="" className="h-9 w-9 object-contain" />
            <span className="text-sm font-semibold text-white">{favoriteTeam.name}</span>
          </div>
        )}
      </div>

      {!favoriteTeam ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#40516b] bg-[#0b1326] p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-[#00f0ff]">groups</span>
          <h3 className="mt-3 font-bold text-white">No favorite team selected</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[#91a0b5]">Go back and choose a team to load its active roster, or skip this step and continue.</p>
        </div>
      ) : (
        <>
          <div className="relative mt-6 max-w-xl">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718090]">search</span>
            <input
              value={playerSearch}
              onChange={(event) => setPlayerSearch(event.target.value)}
              className="w-full rounded-xl border border-[#34425a] bg-[#0b1326] py-3 pl-11 pr-3 text-sm text-white outline-none focus:border-[#00f0ff]"
              placeholder="Search this roster..."
            />
          </div>
          <div className="mt-3 text-xs text-[#718090]">Selected {favoritePlayers.length} / 10</div>

          {rosterLoading ? (
            <div className="mt-8 text-sm text-[#91a0b5]">Loading the active roster…</div>
          ) : filteredRoster.length === 0 ? (
            <div className="mt-8 text-sm text-[#91a0b5]">No roster players matched your search.</div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRoster.map((player) => {
                const selected = favoritePlayers.some((item) => item.id === player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(player)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left ${selected ? 'border-[#00f0ff] bg-[#00f0ff]/10' : 'border-[#2d3b52] bg-[#101a2d] hover:border-[#58708d]'}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{player.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-wider text-[#718090]">{player.position || 'MLB'}</div>
                    </div>
                    <span className={`material-symbols-outlined ${selected ? 'text-[#00f0ff]' : 'text-[#526275]'}`}>{selected ? 'check_circle' : 'add_circle'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );

  const statsStep = (
    <section className="rounded-2xl border border-[#34425a] bg-[#0f182b] p-5 sm:p-6">
      <div className="text-xs font-bold uppercase tracking-[.18em] text-[#00f0ff]">Step 3 of 4</div>
      <h2 className="mt-2 text-2xl font-bold text-white">Choose the stats you care about most</h2>
      <p className="mt-2 text-sm text-[#aebbd0]">These preferences are saved to your account. Select as many as you like.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {STAT_OPTIONS.map((stat) => {
          const selected = preferredStats.includes(stat.key);
          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => toggleStat(stat.key)}
              className={`rounded-xl border p-4 text-left transition ${selected ? 'border-[#00f0ff] bg-[#00f0ff]/10' : 'border-[#2d3b52] bg-[#101a2d] hover:border-[#58708d]'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[.16em] text-[#718090]">{stat.group}</div>
                  <div className="mt-1 font-bold text-white">{stat.key}</div>
                  <div className="mt-1 text-sm text-[#91a0b5]">{stat.label}</div>
                </div>
                <span className={`material-symbols-outlined ${selected ? 'text-[#00f0ff]' : 'text-[#526275]'}`}>{selected ? 'check_circle' : 'circle'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

  const notificationStep = (
    <section className="rounded-2xl border border-[#34425a] bg-[#0f182b] p-5 sm:p-6">
      <div className="text-xs font-bold uppercase tracking-[.18em] text-[#00f0ff]">Step 4 of 4</div>
      <h2 className="mt-2 text-2xl font-bold text-white">Set your notification preferences</h2>
      <p className="mt-2 text-sm text-[#aebbd0]">Choose what you want ScoutCoreMLB to prioritize as account alerts and delivery features are expanded.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          ['gameUpdates', 'sports_baseball', 'Game updates', 'Scores, starts, and important game moments.'],
          ['playerNews', 'person', 'Player news', 'Updates related to the players you follow.'],
          ['injuryUpdates', 'medical_information', 'Injury updates', 'Roster and injury-related updates for players you care about.'],
          ['weeklyDigest', 'mark_email_read', 'Weekly digest', 'A compact recap of your saved baseball interests.'],
        ].map(([key, icon, title, copy]) => {
          const typedKey = key as keyof NotificationPreferences;
          return (
            <label key={key} className="flex cursor-pointer items-start gap-4 rounded-xl border border-[#2d3b52] bg-[#101a2d] p-5">
              <span className="material-symbols-outlined mt-0.5 text-2xl text-[#00f0ff]">{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-white">{title}</span>
                <span className="mt-1 block text-sm leading-6 text-[#91a0b5]">{copy}</span>
              </span>
              <input
                type="checkbox"
                checked={notifications[typedKey]}
                onChange={(event) => setNotifications((current) => ({ ...current, [typedKey]: event.target.checked }))}
                className="mt-1 h-5 w-5 accent-[#00f0ff]"
              />
            </label>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen w-full bg-[#07101f] text-[#dae2fd] px-4 py-6 sm:px-6 lg:px-10 overflow-x-hidden">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/scoutcore-logo-email.png" alt="ScoutCoreMLB" className="h-11 w-11 rounded-xl" />
            <div>
              <div className="text-sm font-bold tracking-[.18em] text-[#00f0ff]">SCOUTCOREMLB</div>
              <div className="text-[10px] uppercase tracking-[.2em] text-[#718090]">Baseball Intelligence</div>
            </div>
          </div>
          <button
            type="button"
            onClick={skipAll}
            disabled={saving}
            className="rounded-xl border border-[#34425a] bg-[#0f182b] px-4 py-2 text-sm text-[#dae2fd] hover:border-[#00f0ff] hover:text-white disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>

        <div className="mx-auto mt-7 max-w-4xl text-center">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Let’s personalize your ScoutCoreMLB experience</h1>
          <p className="mt-2 text-sm text-[#91a0b5]">You can change these preferences later as account personalization grows.</p>
        </div>

        <div className="mx-auto mt-7 grid max-w-5xl grid-cols-4 gap-2 sm:gap-4">
          {STEP_LABELS.map((label, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <div key={label} className="text-center">
                <div className="flex items-center">
                  {index > 0 && <div className={`h-px flex-1 ${done || active ? 'bg-[#00f0ff]' : 'bg-[#34425a]'}`} />}
                  <div className={`mx-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${active ? 'border-[#00f0ff] bg-[#00f0ff] text-[#00363a]' : done ? 'border-[#00f0ff] bg-[#00f0ff]/10 text-[#00f0ff]' : 'border-[#40516b] text-[#91a0b5]'}`}>
                    {done ? <span className="material-symbols-outlined text-[18px]">check</span> : index + 1}
                  </div>
                  {index < STEP_LABELS.length - 1 && <div className={`h-px flex-1 ${done ? 'bg-[#00f0ff]' : 'bg-[#34425a]'}`} />}
                </div>
                <div className={`mt-2 hidden text-xs sm:block ${active ? 'font-bold text-[#00f0ff]' : 'text-[#91a0b5]'}`}>{label}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-7">
          {step === 0 && teamStep}
          {step === 1 && playerStep}
          {step === 2 && statsStep}
          {step === 3 && notificationStep}
        </div>

        {error && (
          <div className="mx-auto mt-5 max-w-2xl rounded-xl border border-[#fb7185]/30 bg-[#301a24] p-3 text-center text-sm text-[#fecdd3]">{error}</div>
        )}

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={saving}
              className="w-full rounded-xl border border-[#34425a] px-6 py-3 text-sm font-semibold text-[#dae2fd] hover:border-[#58708d] sm:w-auto"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={continueFlow}
            disabled={saving || (step === 0 && !favoriteTeam)}
            className="flex w-full max-w-sm items-center justify-center gap-3 rounded-xl bg-[#00f0ff] px-8 py-3 text-sm font-extrabold text-[#00363a] hover:bg-[#7df4ff] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? 'Saving…' : step === 3 ? 'Finish setup' : 'Continue'}
            {!saving && <span className="material-symbols-outlined">arrow_forward</span>}
          </button>
          <button
            type="button"
            onClick={skipThisStep}
            disabled={saving}
            className="w-full px-5 py-3 text-sm text-[#91a0b5] hover:text-[#00f0ff] sm:w-auto"
          >
            Skip this step
          </button>
        </div>
      </div>
    </div>
  );
};
