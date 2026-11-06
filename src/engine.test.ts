import { describe, it, expect } from 'vitest';
import {
  makeGame, startGame, revealChallenge, commitResults, nextRound, restartChallengeCycle, adjustPosition, makeChallenge, sortedStandings,
} from './engine';

describe('すごろくの進行', () => {
  it('順位に応じて移動し、0未満とゴール超過を防ぐ', () => {
    let g = makeGame(true);
    g.settings.goalPosition = 6;
    g = revealChallenge(startGame(g));
    g = commitResults(g, g.teams.map((t) => t.id));
    expect(g.teams.map((t) => t.position)).toEqual([5, 3, 0]);
    expect(g.status).toBe('playing');
    g = nextRound(g);
    g = revealChallenge(g);
    g = commitResults(g, g.teams.map((t) => t.id));
    expect(g.teams[0].position).toBe(6);
    expect(g.status).toBe('finished');
  });
  it('同順位につながる重複チームIDを拒否する', () => {
    const g = revealChallenge(startGame(makeGame(true)));
    expect(() => commitResults(g, [g.teams[0].id, g.teams[0].id, g.teams[2].id])).toThrow();
  });
  it('お題ごとの移動量を適用する', () => {
    const g = makeGame(true);
    g.challenges[0].customMoves = [9, 1, -5];
    const running = revealChallenge(startGame(g));
    const after = commitResults(running, g.teams.map((t) => t.id));
    expect(after.teams.map((t) => t.position)).toEqual([9, 1, 0]);
    expect(after.challenges[0].status).toBe('completed');
  });
  it('全員ゴール方式ではゴール済みチームを除いて順位を付ける', () => {
    let g = makeGame(true);
    g.settings.goalPosition = 4;
    g.settings.finishPolicy = 'all-goal';
    g = revealChallenge(startGame(g));
    g = commitResults(g, g.teams.map((t) => t.id));
    expect(g.status).toBe('playing');
    expect(g.teams[0].finishedAtRound).toBe(1);
    g = revealChallenge(nextRound(g));
    expect(() => commitResults(g, g.teams.map((t) => t.id))).toThrow();
    g = commitResults(g, [g.teams[1].id, g.teams[2].id]);
    expect(g.teams[1].finishedAtRound).toBe(2);
  });
  it('手動終了方式ではゴールに達しても終了しない', () => {
    let g = makeGame(true);
    g.settings.goalPosition = 2;
    g.settings.finishPolicy = 'manual';
    g = commitResults(revealChallenge(startGame(g)), g.teams.map((t) => t.id));
    expect(g.status).toBe('playing');
  });
  it('位置の修正は公開盤面に反映される', () => {
    let g = startGame(makeGame(true));
    g = adjustPosition(g, g.teams[0].id, 999);
    expect(g.teams[0].position).toBe(g.settings.goalPosition);
    expect(g.publicView.teams[0].position).toBe(g.settings.goalPosition);
  });
  it('ゴールしたラウンドとそのラウンドの順位で着順を決める', () => {
    let g = makeGame(true);
    g.settings.goalPosition = 3;
    g.settings.finishPolicy = 'all-goal';
    g = commitResults(revealChallenge(startGame(g)), g.teams.map((t) => t.id));
    expect(sortedStandings(g.teams, g.rounds)[0].id).toBe(g.teams[0].id);
  });
  it('全お題を実施すると自動的に最初から再利用でき、過去のラウンド履歴が残る', () => {
    let g = makeGame(true);
    g.settings.finishPolicy = 'manual';
    g.settings.goalPosition = 150;
    const ids = g.challenges.map((c) => c.id);
    g = startGame(g);
    for (let i = 0; i < ids.length; i++) {
      expect(g.selectedChallengeId).toBe(ids[i]);
      g = commitResults(revealChallenge(g), g.teams.map((t) => t.id));
      if (i < ids.length - 1) g = nextRound(g);
    }
    expect(g.challenges.every((c) => c.status === 'completed')).toBe(true);
    const history = g.rounds.map((r) => r.challengeId);
    g = nextRound(g);
    expect(g.selectedChallengeId).toBe(ids[0]);
    expect(g.challenges.every((c) => c.status === 'unused')).toBe(true);
    expect(g.rounds.map((r) => r.challengeId)).toEqual(history);
    g = commitResults(revealChallenge(g), g.teams.map((t) => t.id));
    expect(g.rounds).toHaveLength(ids.length + 1);
    expect(g.rounds.at(-1)?.roundNumber).toBe(ids.length + 1);
    expect(g.challenges[0].status).toBe('completed');
  });
  it('ランダム出題も1巡するまで同じお題を出さず、2巡目へ進む', () => {
    let g = makeGame(true);
    g.settings.finishPolicy = 'manual';
    g.settings.goalPosition = 150;
    g.settings.selectionMode = 'random';
    g = startGame(g);
    for (let cycle = 0; cycle < 2; cycle++) {
      const seen = new Set<string>();
      for (let i = 0; i < g.challenges.length; i++) {
        const id = g.selectedChallengeId!;
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        g = commitResults(revealChallenge(g), g.teams.map((t) => t.id));
        if (i < g.challenges.length - 1 || cycle === 0) g = nextRound(g);
      }
      expect(seen.size).toBe(g.challenges.length);
    }
    expect(g.rounds).toHaveLength(10);
  });
  it('旧データで全お題消化後に停止したゲームは手動で周回を再開できる', () => {
    const g = makeGame(true);
    g.status = 'playing';
    g.phase = 'ready';
    g.challenges.forEach((c) => { c.status = 'completed'; });
    const restarted = restartChallengeCycle(g);
    expect(restarted.challenges.every((c) => c.status === 'unused')).toBe(true);
    expect(restarted.selectedChallengeId).toBe(restarted.challenges[0].id);
    expect(() => restartChallengeCycle(restarted)).toThrow();
  });
  it('出題済みのお題は再抽選されない', () => {
    let g = makeGame(true);
    g = commitResults(revealChallenge(startGame(g)), g.teams.map((t) => t.id));
    const done = g.rounds[0].challengeId;
    g = nextRound(g);
    expect(g.selectedChallengeId).not.toBe(done);
    const extra = makeChallenge('追加お題', g.challenges.length);
    expect(extra.status).toBe('unused');
  });
});
