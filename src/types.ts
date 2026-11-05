export type FinishPolicy = 'first-goal' | 'all-goal' | 'manual';
export type SelectionMode = 'ordered' | 'random';
export type GameStatus = 'setup' | 'playing' | 'finished';
export type Phase = 'ready' | 'revealed' | 'result';
export type PublicStage = 'standby' | 'challenge' | 'result' | 'finished';

export interface Team {
  id: string;
  name: string;
  color: string;
  position: number;
  finishedAtRound: number | null;
}
export interface Challenge {
  id: string;
  title: string;
  description: string;
  timeLimitSeconds: number | null;
  order: number;
  status: 'unused' | 'completed';
  customMoves: number[] | null;
}
export interface GameSettings {
  goalPosition: number;
  defaultMoves: number[];
  selectionMode: SelectionMode;
  finishPolicy: FinishPolicy;
}
export interface RoundResult {
  teamId: string;
  rank: number;
  movement: number;
  before: number;
  after: number;
}
export interface RoundRecord {
  id: string;
  roundNumber: number;
  challengeId: string;
  challengeTitle: string;
  results: RoundResult[];
  timestamp: number;
}
export interface PublicView {
  gameId: string;
  title: string;
  goalPosition: number;
  stage: PublicStage;
  roundNumber: number;
  teams: Team[];
  challengeTitle?: string;
  challengeDescription?: string;
  timeLimitSeconds?: number | null;
  results?: RoundResult[];
}
export interface Game {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  settings: GameSettings;
  teams: Team[];
  challenges: Challenge[];
  rounds: RoundRecord[];
  status: GameStatus;
  phase: Phase;
  selectedChallengeId: string | null;
  publicView: PublicView;
}
export interface AppData {
  games: Game[];
  activeGameId: string | null;
}
