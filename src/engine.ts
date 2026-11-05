import type { Challenge, Game, PublicStage, PublicView, RoundResult, Team } from './types';

export const TEAM_COLORS = [
  '#3b82f6', '#f4726d', '#27bd91', '#e9ae45',
  '#9a7cf3', '#28aec8', '#ee77b2', '#a2ba53',
  '#f28c51', '#648da9', '#bd7d5f', '#777bd7',
];

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
}
export function cloned<T>(value: T): T {
  return structuredClone(value);
}
export function makeChallenge(title = '', order = 0): Challenge {
  return { id: newId(), title, description: '', timeLimitSeconds: null, order, status: 'unused', customMoves: null };
}
export function makeGame(sample = false): Game {
  const id = newId();
  const teams: Team[] = [0, 1, 2].map((i) => ({
    id: newId(), name: ['青チーム', '赤チーム', '緑チーム'][i],
    color: TEAM_COLORS[i], position: 0, finishedAtRound: null,
  }));
  const challenges = sample
    ? ['じゃんけん勝負', '片足立ちチャレンジ', '的当て', '歩数ぴったり対決', '反復横跳び'].map((x, i) => makeChallenge(x, i))
    : [];
  const game: Game = {
    id, title: sample ? 'サンプル体育すごろく' : '新しい体育すごろく',
    createdAt: Date.now(), updatedAt: Date.now(),
    settings: { goalPosition: 20, defaultMoves: [5, 3, -1], selectionMode: 'ordered', finishPolicy: 'first-goal' },
    teams, challenges, rounds: [], status: 'setup', phase: 'ready', selectedChallengeId: null,
    publicView: { gameId: id, title: '', goalPosition: 20, stage: 'standby', roundNumber: 0, teams: cloned(teams) },
  };
  game.publicView = makePublicView(game, 'standby');
  return game;
}
export function makePublicView(game: Game, stage: PublicStage, challenge?: Challenge, results?: RoundResult[]): PublicView {
  return {
    gameId: game.id, title: game.title, goalPosition: game.settings.goalPosition,
    stage, roundNumber: game.rounds.length + (stage === 'challenge' ? 1 : 0),
    teams: cloned(game.teams),
    ...(challenge ? {
      challengeTitle: challenge.title, challengeDescription: challenge.description,
      timeLimitSeconds: challenge.timeLimitSeconds,
    } : {}),
    ...(results ? { results: cloned(results) } : {}),
  };
}
export function activeTeams(game: Game): Team[] {
  return game.teams.filter((t) => t.finishedAtRound === null);
}
export function unusedChallenges(game: Game): Challenge[] {
  return [...game.challenges].filter((c) => c.status === 'unused').sort((a, b) => a.order - b.order);
}
export function nextChallengeId(game: Game): string | null {
  const unused = unusedChallenges(game);
  if (!unused.length) return null;
  if (game.settings.selectionMode === 'random') return unused[Math.floor(Math.random() * unused.length)].id;
  return unused[0].id;
}
export function startGame(original: Game): Game {
  if (original.teams.length < 2) throw new Error('チームを2つ以上登録してください。');
  if (!original.challenges.length) throw new Error('お題を1つ以上登録してください。');
  if (original.teams.some((t) => !t.name.trim())) throw new Error('チーム名を入力してください。');
  if (original.challenges.some((c) => !c.title.trim())) throw new Error('すべてのお題にタイトルを入力してください。');
  const game = cloned(original);
  game.status = 'playing';
  game.phase = 'ready';
  game.selectedChallengeId = nextChallengeId(game);
  game.publicView = makePublicView(game, 'standby');
  return game;
}
export function selectChallenge(original: Game, id: string): Game {
  if (original.status !== 'playing' || original.phase !== 'ready') throw new Error('今はお題を選択できません。');
  if (!unusedChallenges(original).some((c) => c.id === id)) throw new Error('未実施のお題を選択してください。');
  return { ...original, selectedChallengeId: id };
}
export function revealChallenge(original: Game): Game {
  if (original.status !== 'playing' || original.phase !== 'ready') throw new Error('お題を公開できません。');
  const challenge = original.challenges.find((c) => c.id === original.selectedChallengeId && c.status === 'unused');
  if (!challenge) throw new Error('公開するお題を選択してください。');
  const game = cloned(original);
  game.phase = 'revealed';
  game.publicView = makePublicView(game, 'challenge', challenge);
  return game;
}
export function commitResults(original: Game, orderedTeamIds: string[]): Game {
  if (original.status !== 'playing' || original.phase !== 'revealed') throw new Error('先にお題を公開してください。');
  const eligible = activeTeams(original);
  if (orderedTeamIds.length !== eligible.length || new Set(orderedTeamIds).size !== eligible.length ||
      orderedTeamIds.some((id) => !eligible.some((t) => t.id === id))) {
    throw new Error('すべての参加チームに、重複しない順位を設定してください。');
  }
  const challenge = original.challenges.find((c) => c.id === original.selectedChallengeId);
  if (!challenge) throw new Error('お題が見つかりません。');
  const game = cloned(original);
  const roundNo = game.rounds.length + 1;
  const moves = challenge.customMoves ?? game.settings.defaultMoves;
  if (moves.length < eligible.length || moves.some((x) => !Number.isInteger(x))) {
    throw new Error('順位に対応する移動量が正しく設定されていません。');
  }
  const results: RoundResult[] = orderedTeamIds.map((id, i) => {
    const team = game.teams.find((t) => t.id === id)!;
    const before = team.position;
    const movement = moves[i];
    const after = Math.max(0, Math.min(game.settings.goalPosition, before + movement));
    team.position = after;
    if (after >= game.settings.goalPosition && team.finishedAtRound === null) team.finishedAtRound = roundNo;
    return { teamId: id, rank: i + 1, movement, before, after };
  });
  const updated = game.challenges.find((c) => c.id === challenge.id)!;
  updated.status = 'completed';
  game.rounds.push({
    id: newId(), roundNumber: roundNo, challengeId: challenge.id,
    challengeTitle: challenge.title, results, timestamp: Date.now(),
  });
  game.selectedChallengeId = null;
  game.phase = 'result';
  const anyGoal = results.some((r) => r.after === game.settings.goalPosition && r.before < game.settings.goalPosition);
  const allGoal = game.teams.every((t) => t.finishedAtRound !== null);
  const policy = game.settings.finishPolicy;
  if ((policy === 'first-goal' && anyGoal) || (policy === 'all-goal' && allGoal)) {
    game.status = 'finished';
    game.publicView = makePublicView(game, 'finished');
  } else {
    game.publicView = makePublicView(game, 'result', challenge, results);
    game.publicView.roundNumber = roundNo;
  }
  return game;
}
export function nextRound(original: Game): Game {
  if (original.status !== 'playing' || original.phase !== 'result') throw new Error('次のラウンドには進めません。');
  const game = cloned(original);
  game.phase = 'ready';
  game.selectedChallengeId = nextChallengeId(game);
  return game;
}
export function finishGame(original: Game): Game {
  if (original.status !== 'playing') return original;
  const game = cloned(original);
  game.status = 'finished';
  game.selectedChallengeId = null;
  game.publicView = makePublicView(game, 'finished');
  game.publicView.roundNumber = game.rounds.length;
  return game;
}
export function adjustPosition(original: Game, id: string, position: number): Game {
  if (original.status !== 'playing' || !Number.isInteger(position)) throw new Error('位置を修正できません。');
  const game = cloned(original);
  const team = game.teams.find((t) => t.id === id);
  if (!team) throw new Error('チームが見つかりません。');
  team.position = Math.max(0, Math.min(game.settings.goalPosition, position));
  team.finishedAtRound = team.position >= game.settings.goalPosition ? game.rounds.length + 1 : null;
  // Do not leak privately prepared challenges.
  const stage = game.publicView.stage;
  const publicView = cloned(game.publicView);
  publicView.teams = cloned(game.teams);
  game.publicView = publicView;
  if (stage === 'finished') game.publicView = makePublicView(game, 'finished');
  return game;
}
export function sortedStandings(teams: Team[], rounds: { roundNumber: number; results: RoundResult[] }[]): Team[] {
  const rankedIn = (team: Team) => {
    const round = rounds.find((r) => r.roundNumber === team.finishedAtRound);
    return round?.results.find((r) => r.teamId === team.id)?.rank ?? 999;
  };
  return [...teams].sort((a, b) => {
    if (a.finishedAtRound !== null && b.finishedAtRound !== null) {
      return a.finishedAtRound - b.finishedAtRound || rankedIn(a) - rankedIn(b);
    }
    if (a.finishedAtRound !== null) return -1;
    if (b.finishedAtRound !== null) return 1;
    return b.position - a.position || a.name.localeCompare(b.name, 'ja');
  });
}
export function normalizeMoves(moves: number[], count: number): number[] {
  return Array.from({ length: count }, (_, i) => Number.isInteger(moves[i]) ? moves[i] : 0);
}
