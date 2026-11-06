import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Flag, ListChecks, Plus, Settings2, Trash2, Users } from 'lucide-react';
import type { Challenge, Game, Team } from '../types';
import { makeChallenge, normalizeMoves, startGame, TEAM_COLORS, newId } from '../engine';
import { useGameStore } from '../store';
import { Board } from './Board';

type Props = { game: Game; onPlay: () => void };
type Tab = 'teams' | 'rules' | 'challenges';
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const asInt = (value: string, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

export function SettingsScreen({ game, onPlay }: Props) {
  const [tab, setTab] = useState<Tab>('teams');
  const [selected, setSelected] = useState<string | null>(null);
  const modify = useGameStore((s) => s.modifyGame);
  const editable = game.status === 'setup';
  const update = (fn: (g: Game) => void) => modify(game.id, (g) => { fn(g); return g; });
  const challengeList = [...game.challenges].sort((a, b) => a.order - b.order);
  const selectedChallenge = challengeList.find((c) => c.id === selected) ?? challengeList[0];
  const eligibleChallenge = (c: Challenge) => c.status === 'unused' && !(game.phase === 'revealed' && game.selectedChallengeId === c.id && game.status === 'playing');
  const start = () => {
    try { modify(game.id, startGame); onPlay(); }
    catch (error) { alert(error instanceof Error ? error.message : 'ゲームを開始できませんでした。'); }
  };
  const addTeam = () => update((g) => {
    if (g.teams.length >= 12) return;
    const i = g.teams.length;
    const team: Team = { id: newId(), name: 'チーム' + (i + 1), color: TEAM_COLORS[i], position: 0, finishedAtRound: null };
    g.teams.push(team);
    g.settings.defaultMoves = normalizeMoves(g.settings.defaultMoves, g.teams.length);
    g.challenges.forEach((c) => { if (c.customMoves) c.customMoves = normalizeMoves(c.customMoves, g.teams.length); });
  });
  const removeTeam = (id: string) => update((g) => {
    if (g.teams.length <= 2) return;
    g.teams = g.teams.filter((t) => t.id !== id);
    g.settings.defaultMoves = normalizeMoves(g.settings.defaultMoves, g.teams.length);
    g.challenges.forEach((c) => { if (c.customMoves) c.customMoves = normalizeMoves(c.customMoves, g.teams.length); });
  });
  const addChallenge = () => {
    const c = makeChallenge('', game.challenges.length);
    update((g) => { g.challenges.push(c); if (g.status === 'playing' && !g.selectedChallengeId && g.phase === 'ready') g.selectedChallengeId = c.id; });
    setSelected(c.id);
  };
  const moveChallenge = (id: string, direction: number) => update((g) => {
    const items = [...g.challenges].sort((a, b) => a.order - b.order);
    const index = items.findIndex((c) => c.id === id);
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    items.forEach((c, i) => { c.order = i; });
    g.challenges = items;
  });
  const changeChallenge = (id: string, fn: (c: Challenge) => void) => update((g) => {
    const challenge = g.challenges.find((c) => c.id === id);
    if (challenge && eligibleChallenge(challenge)) fn(challenge);
  });

  return (
    <div className="screen-container">
      <div className="page-heading">
        <div><span className="eyebrow">GAME BUILDER</span><h1>ゲーム設定</h1><p>チームとお題を登録し、すごろくのルールを決めます。</p></div>
        <div className="heading-actions">
          {game.status !== 'setup' && <button className="btn btn-secondary" onClick={onPlay}><ArrowLeft size={17} />ゲームに戻る</button>}
          {editable && <button className="btn btn-primary" onClick={start}><Check size={17} />ゲームを開始</button>}
        </div>
      </div>
      <div className="form-field game-title-input"><label>ゲーム名</label><input value={game.title} maxLength={100} onChange={(e) => update((g) => { g.title = e.target.value; })} placeholder="例：体育すごろく2026" /></div>
      <div className="setting-tabs" role="tablist" aria-label="ゲーム設定">
        <button role="tab" aria-selected={tab === 'teams'} className={tab === 'teams' ? 'active' : ''} onClick={() => setTab('teams')}><Users size={18}/> チーム</button>
        <button role="tab" aria-selected={tab === 'rules'} className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}><Settings2 size={18}/> ルール・盤面</button>
        <button role="tab" aria-selected={tab === 'challenges'} className={tab === 'challenges' ? 'active' : ''} onClick={() => setTab('challenges')}><ListChecks size={18}/> お題 <span className="tab-count">{game.challenges.length}</span></button>
      </div>

      {tab === 'teams' && <div className="two-column-settings">
        <section className="panel">
          <div className="section-heading"><div><h2>参加チーム</h2><p>2〜12チームで自由に編成できます。</p></div><span className="count-tag">{game.teams.length} チーム</span></div>
          {!editable && <div className="notice">ゲーム開始後は、チームの構成を変更できません。</div>}
          <div className="team-editor-list">
            {game.teams.map((team, i) => <div className="team-editor" key={team.id}>
              <span className="item-number">{String(i + 1).padStart(2, '0')}</span>
              <input aria-label={team.name + 'の色'} type="color" className="color-picker" value={team.color} disabled={!editable} onChange={(e) => update((g) => { g.teams[i].color = e.target.value; })} />
              <input aria-label={'チーム' + (i + 1) + 'の名前'} className="team-name-input" value={team.name} maxLength={30} disabled={!editable} onChange={(e) => update((g) => { g.teams[i].name = e.target.value; })} />
              {editable && <button aria-label={team.name + 'を削除'} className="icon-button danger-on-hover" disabled={game.teams.length <= 2} onClick={() => removeTeam(team.id)}><Trash2 size={17}/></button>}
            </div>)}
          </div>
          {editable && <button className="btn btn-dashed full-width" disabled={game.teams.length >= 12} onClick={addTeam}><Plus size={17}/>チームを追加</button>}
        </section>
        <section className="panel">
          <div className="section-heading"><div><h2>プレビュー</h2><p>設定した色の駒が盤面に反映されます。</p></div></div>
          <Board teams={game.teams} goal={game.settings.goalPosition} compact />
        </section>
      </div>}

      {tab === 'rules' && <div className="two-column-settings">
        <section className="panel">
          <div className="section-heading"><div><h2>すごろく設定</h2><p>盤面やゲームの終了条件を決めます。</p></div><Flag size={20}/></div>
          {!editable && <div className="notice">ゲーム開始後は基本ルールを変更できません。</div>}
          <div className="form-field"><label htmlFor="goal">ゴールまでのマス数</label>
            <div className="number-control"><input id="goal" type="number" min={1} max={150} value={game.settings.goalPosition} disabled={!editable} onChange={(e) => update((g) => { g.settings.goalPosition = clamp(asInt(e.target.value, 20), 1, 150); })}/><span>マス</span></div>
          </div>
          <div className="form-field"><label htmlFor="finish">ゴール条件</label><select id="finish" disabled={!editable} value={game.settings.finishPolicy} onChange={(e) => update((g) => { g.settings.finishPolicy = e.target.value as Game['settings']['finishPolicy']; })}>
            <option value="first-goal">最初にゴールしたラウンドで終了</option>
            <option value="all-goal">全チームがゴールしたら終了</option>
            <option value="manual">運営者が手動で終了</option>
          </select></div>
          <div className="form-field"><label htmlFor="selection">標準のお題選択方式</label><select id="selection" disabled={!editable} value={game.settings.selectionMode} onChange={(e) => update((g) => { g.settings.selectionMode = e.target.value as Game['settings']['selectionMode']; })}>
            <option value="ordered">登録順に出題</option><option value="random">未実施からランダム出題</option>
          </select></div>
        </section>
        <section className="panel">
          <div className="section-heading"><div><h2>共通の移動ルール</h2><p>順位ごとのマス数を設定します。</p></div></div>
          <div className="moves-list">
            {game.settings.defaultMoves.map((move, i) => <div className="move-row" key={i}>
              <span className="rank-chip">{i + 1}位</span>
              <input aria-label={(i + 1) + '位の移動量'} type="number" min={-150} max={150} value={move} disabled={!editable} onChange={(e) => update((g) => { g.settings.defaultMoves[i] = clamp(asInt(e.target.value), -150, 150); })}/>
              <span className={'move-indicator ' + (move >= 0 ? 'positive' : 'negative')}>{move > 0 ? '+' : ''}{move} マス</span>
            </div>)}
          </div>
          <p className="helper">正の数なら前進、負の数なら後退、0なら移動なしです。お題ごとに上書きできます。</p>
          {editable && <div className="preset-buttons"><button className="btn btn-secondary btn-sm" onClick={() => update((g) => { g.settings.defaultMoves = normalizeMoves([5, 3, -1], g.teams.length); })}>5 / 3 / −1</button><button className="btn btn-secondary btn-sm" onClick={() => update((g) => { g.settings.defaultMoves = g.teams.map((_, i) => Math.max(1, g.teams.length - i)); })}>全員前進</button></div>}
        </section>
      </div>}

      {tab === 'challenges' && <div className="challenge-layout">
        <section className="panel challenge-list-panel">
          <div className="section-heading"><div><h2>お題リスト</h2><p>途中追加に対応。全お題を使い切ると、次のラウンドから自動で再利用します。</p></div><span className="count-tag">{game.challenges.length} 件</span></div>
          <div className="challenge-list">
            {challengeList.map((challenge, i) => <div key={challenge.id} className={'challenge-list-item ' + (selectedChallenge?.id === challenge.id ? 'chosen ' : '') + (challenge.status === 'completed' ? 'completed' : '')}>
              <button className="challenge-pick" onClick={() => setSelected(challenge.id)}>
                <span className="challenge-list-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="challenge-title-wrap"><strong>{challenge.title || '無題のお題'}</strong><small>{challenge.status === 'completed' ? '実施済み' : challenge.customMoves ? '専用ルール' : '共通ルール'}</small></span>
              </button>
              <div className="reorder-controls">
                <button className="icon-button small" title="上へ" disabled={i === 0 || !eligibleChallenge(challenge)} onClick={() => moveChallenge(challenge.id, -1)}><ArrowUp size={14}/></button>
                <button className="icon-button small" title="下へ" disabled={i === challengeList.length - 1 || !eligibleChallenge(challenge)} onClick={() => moveChallenge(challenge.id, 1)}><ArrowDown size={14}/></button>
              </div>
            </div>)}
            {challengeList.length === 0 && <p className="empty-hint">お題がありません。まずは追加してください。</p>}
          </div>
          <button className="btn btn-dashed full-width" onClick={addChallenge}><Plus size={17}/>新しいお題を追加</button>
        </section>
        <section className="panel challenge-details-panel">
          {selectedChallenge ? <>
            <div className="section-heading"><div><h2>お題の編集</h2><p>参加者に表示する内容を登録します。</p></div>
              <button className="icon-button danger-on-hover" title="削除" disabled={!eligibleChallenge(selectedChallenge)} onClick={() => {
                if (!confirm('このお題を削除しますか？')) return;
                update((g) => { g.challenges = g.challenges.filter((c) => c.id !== selectedChallenge.id); if (g.selectedChallengeId === selectedChallenge.id) g.selectedChallengeId = null; });
                setSelected(null);
              }}><Trash2 size={18}/></button>
            </div>
            {!eligibleChallenge(selectedChallenge) && <div className="notice">実施済み、または現在公開中のお題は編集できません。</div>}
            <div className="form-field"><label>お題タイトル</label><input maxLength={90} disabled={!eligibleChallenge(selectedChallenge)} value={selectedChallenge.title} onChange={(e) => changeChallenge(selectedChallenge.id, (c) => { c.title = e.target.value; })} placeholder="例：反復横跳びチャレンジ" /></div>
            <div className="form-field"><label>ルール・説明</label><textarea rows={5} maxLength={2000} disabled={!eligibleChallenge(selectedChallenge)} value={selectedChallenge.description} onChange={(e) => changeChallenge(selectedChallenge.id, (c) => { c.description = e.target.value; })} placeholder="お題の内容や参加者への説明を書きます。" /></div>
            <div className="form-field"><label>制限時間（任意）</label><div className="number-control"><input type="number" min={0} max={3600} disabled={!eligibleChallenge(selectedChallenge)} value={selectedChallenge.timeLimitSeconds ?? ''} placeholder="設定なし" onChange={(e) => changeChallenge(selectedChallenge.id, (c) => { c.timeLimitSeconds = e.target.value === '' ? null : clamp(asInt(e.target.value), 0, 3600); })}/><span>秒</span></div></div>
            <div className="subsection">
              <div className="section-heading"><div><h3>順位別の移動量</h3><p>このお題に固有のルールを設定できます。</p></div></div>
              <label className="checkbox-line"><input type="checkbox" disabled={!eligibleChallenge(selectedChallenge)} checked={selectedChallenge.customMoves !== null} onChange={(e) => changeChallenge(selectedChallenge.id, (c) => { c.customMoves = e.target.checked ? [...game.settings.defaultMoves] : null; })}/> このお題だけ移動量を変える</label>
              {selectedChallenge.customMoves ? <div className="moves-list">
                {selectedChallenge.customMoves.map((move, i) => <div className="move-row" key={i}><span className="rank-chip">{i + 1}位</span><input type="number" aria-label={(i + 1) + '位の専用移動量'} min={-150} max={150} disabled={!eligibleChallenge(selectedChallenge)} value={move} onChange={(e) => changeChallenge(selectedChallenge.id, (c) => { c.customMoves![i] = clamp(asInt(e.target.value), -150, 150); })}/><span className={'move-indicator ' + (move >= 0 ? 'positive' : 'negative')}>{move > 0 ? '+' : ''}{move}</span></div>)}
              </div> : <div className="notice muted">共通ルールを使用：{game.settings.defaultMoves.map((m, i) => (i + 1) + '位 ' + (m > 0 ? '+' : '') + m).join(' / ')}</div>}
            </div>
          </> : <div className="empty-editor"><ListChecks size={44}/><h2>お題を作成しましょう</h2><p>左側の「新しいお題を追加」を押してください。</p><button className="btn btn-primary" onClick={addChallenge}><Plus size={17}/>お題を追加</button></div>}
        </section>
      </div>}
      <div className="settings-bottom">
        <p><Check size={16}/> 変更はこのブラウザに自動保存されます。</p>
        {editable ? <button className="btn btn-primary" onClick={start}>設定を保存してゲーム開始 <ArrowRight size={17}/></button>
          : <button className="btn btn-primary" onClick={onPlay}>ゲーム画面へ戻る <ArrowRight size={17}/></button>}
      </div>
    </div>
  );
}
