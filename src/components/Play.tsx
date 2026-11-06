import { useEffect, useMemo, useState } from 'react';

let displayWindowRef: Window | null = null;
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Eye, Flag, ListChecks, Maximize2, Monitor, MonitorUp, Plus, Redo2, RotateCcw, Shuffle, Trophy, Undo2 } from 'lucide-react';
import type { Game } from '../types';
import { activeTeams, adjustPosition, commitResults, finishGame, nextRound, restartChallengeCycle, revealChallenge, selectChallenge, sortedStandings, unusedChallenges } from '../engine';
import { useGameStore } from '../store';
import { Audience } from './Audience';

type Props = { game: Game; onEdit: () => void };
export function PlayScreen({ game, onEdit }: Props) {
  const modify = useGameStore((s) => s.modifyGame);
  const undo = useGameStore((s) => s.undoGame);
  const redo = useGameStore((s) => s.redoGame);
  const undoCount = useGameStore((s) => s.undo[game.id]?.length ?? 0);
  const redoCount = useGameStore((s) => s.redo[game.id]?.length ?? 0);
  const [mode, setMode] = useState<'single' | 'dual'>(displayWindowRef && !displayWindowRef.closed ? 'dual' : 'single');
  const [focus, setFocus] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [showPositions, setShowPositions] = useState(false);
  const challenge = game.challenges.find((c) => c.id === game.selectedChallengeId);
  const unused = unusedChallenges(game);
  const eligible = activeTeams(game);
  const eligibleIds = eligible.map((t) => t.id).join(',');
  useEffect(() => { setOrder(eligibleIds ? eligibleIds.split(',') : []); }, [game.id, game.rounds.length, eligibleIds]);
  const moves = challenge?.customMoves ?? game.settings.defaultMoves;
  const standings = useMemo(() => sortedStandings(game.teams, game.rounds), [game.teams, game.rounds]);

  const action = (fn: (g: Game) => Game, checkpoint = false) => {
    try { modify(game.id, fn, checkpoint); }
    catch (error) { alert(error instanceof Error ? error.message : '操作に失敗しました。'); }
  };
  const reorder = (index: number, delta: number) => setOrder((old) => {
    const next = [...old], target = index + delta;
    if (target < 0 || target >= next.length) return old;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const openDisplay = () => {
    const url = window.location.origin + window.location.pathname + '?display=' + encodeURIComponent(game.id);
    const windowRef = window.open(url, 'kaisei-display-' + game.id);
    if (!windowRef) alert('表示画面を開けませんでした。ブラウザのポップアップ設定を確認してください。');
    else { displayWindowRef = windowRef; windowRef.focus(); setMode('dual'); setFocus(false); }
  };
  const manualFinish = () => {
    if (confirm('ゲームを終了しますか？ 最終結果を表示します。')) action(finishGame, true);
  };
  const canChoose = game.status === 'playing' && game.phase === 'ready';
  const movePosition = (id: string, current: number) => {
    const requested = positions[id] === undefined ? current : Number(positions[id]);
    if (!Number.isInteger(requested)) { alert('移動先は整数で入力してください。'); return; }
    action((g) => adjustPosition(g, id, requested), true);
    setPositions((old) => { const next = { ...old }; delete next[id]; return next; });
  };
  return <div className={'play-screen ' + (focus ? 'focus-view' : '')}>
    <div className="play-toolbar">
      <div><span className="eyebrow">LIVE GAME</span><h1>{game.title}</h1><p>{game.rounds.length} ラウンド実施済み · {game.teams.length} チーム</p></div>
      <div className="toolbar-actions">
        <button className="btn btn-secondary" onClick={onEdit}><ListChecks size={16}/>お題・設定</button>
        <button className="btn btn-secondary" disabled={!undoCount} title="元に戻す" onClick={() => undo(game.id)}><Undo2 size={16}/><span className="desktop-text">戻す</span></button>
        <button className="btn btn-secondary" disabled={!redoCount} title="やり直す" onClick={() => redo(game.id)}><Redo2 size={16}/></button>
        <button className="btn btn-primary" onClick={openDisplay}><MonitorUp size={16}/>2画面モード</button>
      </div>
    </div>
    <div className="mode-bar">
      <span className={'mode-indicator ' + (mode === 'dual' ? 'mode-dual' : '')}><span className="live-dot"/>{mode === 'dual' ? '2画面モード：表示画面を別ウィンドウで開いています' : '1画面モード：運営と表示が同じ画面です'}</span>
      <div className="mode-actions">
        <button className="text-button" onClick={() => { displayWindowRef?.close(); displayWindowRef = null; setMode('single'); setFocus(false); }}><Monitor size={15}/>1画面</button>
        <button className="text-button" onClick={openDisplay}><MonitorUp size={15}/>2画面</button>
        <button className="text-button" onClick={() => setFocus(!focus)}><Maximize2 size={15}/>{focus ? '操作に戻る' : '発表表示'}</button>
      </div>
    </div>
    <div className="play-layout">
      <main className="play-presentation"><Audience view={game.publicView}/></main>
      {!focus && <aside className="operator-panel">
        <div className="operator-top"><span className="eyebrow">CONTROL PANEL</span><h2>進行コントロール</h2><span className="count-tag">ROUND {String(game.rounds.length + (game.status === 'finished' ? 0 : 1)).padStart(2, '0')}</span></div>
        {game.status === 'finished' ? <div className="operator-content finished-content"><Trophy size={42} className="trophy-icon"/><h3>ゲーム終了！</h3><p>最終順位が確定しました。</p><div className="finish-standings">
          {standings.map((t, i) => <div key={t.id} className="finish-team"><span>{i + 1}位</span><i className="team-dot" style={{ background: t.color }}/><strong>{t.name}</strong><small>{t.position} マス</small></div>)}
        </div><button className="btn btn-secondary full-width" onClick={() => undo(game.id)} disabled={!undoCount}><RotateCcw size={16}/>直前の操作を取り消す</button></div>
        : <div className="operator-content">
          {game.phase === 'ready' && <>
            <div className="step-label"><span>01</span> お題を選ぶ</div>
            {unused.length ? <>
              <div className="form-field"><label htmlFor="challenge-select">出題するお題</label><div className="select-wrap"><select id="challenge-select" value={game.selectedChallengeId ?? ''} onChange={(e) => action((g) => selectChallenge(g, e.target.value))}><option value="" disabled>お題を選択</option>{unused.map((c) => <option key={c.id} value={c.id}>{c.title || '無題のお題'}</option>)}</select><ChevronDown size={16}/></div></div>
              <div className="challenge-preview"><span className="eyebrow">NEXT CHALLENGE</span><h3>{challenge?.title ?? 'お題が未選択です'}</h3><p>{challenge?.description || 'お題を公開すると、参加者向け画面に表示されます。'}</p>{challenge?.timeLimitSeconds != null && <small>制限時間：{challenge.timeLimitSeconds} 秒</small>}</div>
              <button className="btn btn-secondary full-width" onClick={() => {
                const next = unused[Math.floor(Math.random() * unused.length)];
                action((g) => selectChallenge(g, next.id));
              }}><Shuffle size={17}/>ランダムで選び直す</button>
              <button className="btn btn-primary full-width btn-large" disabled={!challenge} onClick={() => action(revealChallenge)}><Eye size={18}/>このお題を公開する</button>
            </> : <div className="empty-control"><ListChecks size={35}/><h3>{game.challenges.length ? 'すべてのお題を実施しました' : 'お題がありません'}</h3><p>{game.challenges.length ? 'お題を最初からもう一巡するか、新しく追加できます。' : 'お題を追加してゲームを続けられます。'}</p>{game.challenges.length > 0 && <button className="btn btn-primary" onClick={() => action(restartChallengeCycle, true)}><RotateCcw size={16}/>お題をもう一巡する</button>}<button className="btn btn-secondary" onClick={onEdit}><Plus size={16}/>お題を追加</button></div>}
          </>}
          {game.phase === 'revealed' && <>
            <div className="step-label"><span>02</span> 順位を確定する</div>
            <div className="challenge-preview revealed-preview"><span className="eyebrow">CHALLENGE IN PROGRESS</span><h3>{challenge?.title}</h3><p>{challenge?.description || 'お題の結果に応じて順位を並べ替えてください。'}</p></div>
            <p className="input-help">矢印でチームを並べ替えてください。上が1位です。同順位はありません。</p>
            <div className="ranking-editor">
              {order.map((id, i) => {
                const t = game.teams.find((x) => x.id === id);
                const move = moves[i] ?? 0;
                return <div className="ranking-edit-row" key={id}>
                  <span className="rank-chip">{i + 1}位</span><i className="team-dot" style={{ background: t?.color }}/><strong>{t?.name ?? '?'}</strong>
                  <span className={'move-value ' + (move >= 0 ? 'positive' : 'negative')}>{move > 0 ? '+' : ''}{move}</span>
                  <div className="ranking-buttons"><button className="icon-button small" aria-label={(t?.name ?? '') + 'の順位を上げる'} disabled={i === 0} onClick={() => reorder(i, -1)}><ArrowUp size={16}/></button><button className="icon-button small" aria-label={(t?.name ?? '') + 'の順位を下げる'} disabled={i === order.length - 1} onClick={() => reorder(i, 1)}><ArrowDown size={16}/></button></div>
                </div>;
              })}
            </div>
            <div className="result-preview"><h4>移動先のプレビュー</h4>{order.map((id, i) => {
              const t = game.teams.find((x) => x.id === id)!;
              const after = Math.max(0, Math.min(game.settings.goalPosition, t.position + (moves[i] ?? 0)));
              return <div key={id}><span>{t.name}</span><strong>{t.position} <ArrowRight size={13}/> {after}</strong></div>;
            })}</div>
            <button className="btn btn-primary full-width btn-large" onClick={() => action((g) => commitResults(g, order), true)}><Check size={19}/>順位を確定・駒を移動</button>
          </>}
          {game.phase === 'result' && <>
            <div className="step-label"><span>03</span> 結果発表</div>
            <div className="success-box"><Check size={23}/><h3>結果を反映しました</h3><p>全チームの駒を更新しました。</p></div>
            <div className="round-summary">
              {game.rounds.at(-1)?.results.map((r) => {
                const t = game.teams.find((x) => x.id === r.teamId);
                return <div key={r.teamId}><span>{r.rank}位 · {t?.name}</span><strong>{r.before} → {r.after}</strong></div>;
              })}
            </div>
            <button className="btn btn-primary full-width btn-large" onClick={() => action(nextRound)}><ArrowRight size={18}/>次のラウンドへ</button>
          </>}
          <div className="operator-divider"/>
          <div className="operator-extras">
            <button className="collapsible-heading" onClick={() => setShowPositions(!showPositions)}><span><Flag size={16}/>チーム位置の修正</span><ChevronDown size={16} className={showPositions ? 'rotate' : ''}/></button>
            {showPositions && <div className="position-editor">{game.teams.map((t) => <div key={t.id} className="position-edit-row"><i className="team-dot" style={{ background: t.color }}/><span>{t.name}</span><input type="number" aria-label={t.name + 'の位置'} min={0} max={game.settings.goalPosition} value={positions[t.id] ?? String(t.position)} onChange={(e) => setPositions((s) => ({ ...s, [t.id]: e.target.value }))}/><button className="btn btn-secondary btn-sm" onClick={() => movePosition(t.id, t.position)}>修正</button></div>)}</div>}
            <button className="btn btn-quiet-danger full-width" onClick={manualFinish}><Flag size={15}/>ゲームを終了する</button>
          </div>
        </div>}
        <div className="operator-footer"><span className="live-dot"/> すべての操作は自動保存されます。</div>
      </aside>}
    </div>
    {game.rounds.length > 0 && !focus && <section className="history-panel"><div className="section-heading"><div><h2>ラウンド履歴</h2><p>確定した結果を確認できます。</p></div></div><div className="history-list">{[...game.rounds].reverse().map((round) => <div className="history-row" key={round.id}><span className="history-number">#{String(round.roundNumber).padStart(2, '0')}</span><strong>{round.challengeTitle}</strong><span className="history-result">{round.results.map((r) => {
      const team = game.teams.find((t) => t.id === r.teamId);
      return r.rank + '位 ' + (team?.name ?? '?');
    }).join(' · ')}</span></div>)}</div></section>}
  </div>;
}
