import { create } from 'zustand';
import type { AppData, Game } from './types';
import { cloned, makeGame, makePublicView } from './engine';
import { loadApp, saveApp, savePublic } from './storage';
import { broadcastPublic } from './sync';

type GameMutation = (game: Game) => Game;
interface GameStore extends AppData {
  hydrated: boolean;
  undo: Record<string, Game[]>;
  redo: Record<string, Game[]>;
  hydrate: () => Promise<void>;
  createGame: (sample?: boolean) => string;
  selectGame: (id: string) => void;
  removeGame: (id: string) => void;
  modifyGame: (id: string, fn: GameMutation, checkpoint?: boolean) => void;
  undoGame: (id: string) => void;
  redoGame: (id: string) => void;
  importGame: (raw: unknown) => string;
}
export const useGameStore = create<GameStore>((set, get) => ({
  games: [], activeGameId: null, hydrated: false, undo: {}, redo: {},
  hydrate: async () => {
    try {
      const data = await loadApp();
      if (data && Array.isArray(data.games)) {
        set({ games: data.games, activeGameId: data.activeGameId, hydrated: true });
        return;
      }
    } catch (error) { console.error('保存データを読み込めませんでした', error); }
    set({ hydrated: true });
  },
  createGame: (sample = false) => {
    const game = makeGame(sample);
    set((s) => ({ games: [game, ...s.games], activeGameId: game.id }));
    broadcastPublic(game.publicView);
    return game.id;
  },
  selectGame: (id) => set({ activeGameId: id }),
  removeGame: (id) => set((s) => ({
    games: s.games.filter((g) => g.id !== id),
    activeGameId: s.activeGameId === id ? null : s.activeGameId,
  })),
  modifyGame: (id, fn, checkpoint = false) => set((s) => {
    const previous = s.games.find((g) => g.id === id);
    if (!previous) return s;
    const next = fn(cloned(previous));
    next.updatedAt = Date.now();
    if (next.status === 'setup') next.publicView = makePublicView(next, 'standby');
    broadcastPublic(next.publicView);
    return {
      games: s.games.map((g) => g.id === id ? next : g),
      undo: checkpoint ? { ...s.undo, [id]: [...(s.undo[id] ?? []), cloned(previous)].slice(-40) } : s.undo,
      redo: checkpoint ? { ...s.redo, [id]: [] } : s.redo,
    };
  }),
  undoGame: (id) => set((s) => {
    const history = s.undo[id] ?? [];
    const current = s.games.find((g) => g.id === id);
    if (!history.length || !current) return s;
    const restored = cloned(history[history.length - 1]);
    broadcastPublic(restored.publicView);
    return {
      games: s.games.map((g) => g.id === id ? restored : g),
      undo: { ...s.undo, [id]: history.slice(0, -1) },
      redo: { ...s.redo, [id]: [...(s.redo[id] ?? []), cloned(current)].slice(-40) },
    };
  }),
  redoGame: (id) => set((s) => {
    const history = s.redo[id] ?? [];
    const current = s.games.find((g) => g.id === id);
    if (!history.length || !current) return s;
    const restored = cloned(history[history.length - 1]);
    broadcastPublic(restored.publicView);
    return {
      games: s.games.map((g) => g.id === id ? restored : g),
      redo: { ...s.redo, [id]: history.slice(0, -1) },
      undo: { ...s.undo, [id]: [...(s.undo[id] ?? []), cloned(current)].slice(-40) },
    };
  }),
  importGame: (raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('ファイルの形式が正しくありません。');
    const object = raw as Partial<Game> & { game?: Game };
    const source = object.game ?? object;
    if (!Array.isArray(source.teams) || !Array.isArray(source.challenges) ||
        !Array.isArray(source.rounds) || !source.settings || typeof source.title !== 'string' ||
        !Number.isInteger(source.settings.goalPosition) || source.settings.goalPosition < 1 ||
        !Array.isArray(source.settings.defaultMoves) || !['first-goal', 'all-goal', 'manual'].includes(source.settings.finishPolicy) ||
        !['ordered', 'random'].includes(source.settings.selectionMode) ||
        !['setup', 'playing', 'finished'].includes(source.status ?? '')) {
      throw new Error('対応していないゲームデータです。');
    }
    const game = cloned(source as Game);
    game.id = crypto.randomUUID();
    game.title = game.title.slice(0, 100);
    game.createdAt = Date.now();
    game.updatedAt = Date.now();
    game.publicView = makePublicView(game, game.status === 'finished' ? 'finished' : 'standby');
    game.publicView.gameId = game.id;
    if (game.status === 'playing') {
      // Do not restore an incomplete reveal with stale/public results.
      game.phase = 'ready';
      game.selectedChallengeId = null;
    }
    set((s) => ({ games: [game, ...s.games], activeGameId: game.id }));
    broadcastPublic(game.publicView);
    return game.id;
  },
}));

let queue = Promise.resolve();
useGameStore.subscribe((state, oldState) => {
  if (!state.hydrated || (state.games === oldState.games && state.activeGameId === oldState.activeGameId)) return;
  const appData: AppData = { games: cloned(state.games), activeGameId: state.activeGameId };
  queue = queue.catch(() => {}).then(async () => {
    await saveApp(appData);
    await Promise.all(appData.games.map((g) => savePublic(g.publicView)));
  }).catch((error) => console.error('データ保存に失敗しました', error));
});
export function currentView(id: string) {
  return useGameStore.getState().games.find((g) => g.id === id)?.publicView ?? null;
}
