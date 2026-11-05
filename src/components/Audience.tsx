import { useEffect, useState } from 'react';
import { CheckCircle2, Flag, Medal, Sparkles, Trophy, Users } from 'lucide-react';
import type { PublicView, Team } from '../types';
import { Board } from './Board';

function useAnimatedTeams(view: PublicView): Team[] {
  const [teams, setTeams] = useState(view.teams);
  useEffect(() => {
    if (!view.results?.length || (view.stage !== 'result' && view.stage !== 'finished')) {
      setTeams(view.teams);
      return;
    }
    const movements = new Map(view.results.map((r) => [r.teamId, r]));
    const maxSteps = Math.max(...view.results.map((r) => Math.abs(r.after - r.before)));
    setTeams(view.teams.map((t) => ({ ...t, position: movements.get(t.id)?.before ?? t.position })));
    if (!maxSteps) { setTeams(view.teams); return; }
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setTeams(view.teams.map((t) => {
        const result = movements.get(t.id);
        if (!result) return t;
        const distance = result.after - result.before;
        const position = result.before + Math.sign(distance) * Math.min(Math.abs(distance), step);
        return { ...t, position };
      }));
      if (step >= maxSteps) window.clearInterval(timer);
    }, 140);
    return () => window.clearInterval(timer);
  }, [view]);
  return teams;
}
function orderedTeams(view: PublicView): Team[] {
  const order = view.standingOrder;
  if (order?.length) return [...view.teams].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return [...view.teams].sort((a, b) => b.position - a.position || a.name.localeCompare(b.name, 'ja'));
}

export function Audience({ view, projector = false }: { view: PublicView; projector?: boolean }) {
  const animated = useAnimatedTeams(view);
  const standings = orderedTeams(view);
  const isFinish = view.stage === 'finished';
  const isChallenge = view.stage === 'challenge';
  const isResult = view.stage === 'result';
  const ranks = view.results ?? [];

  return <div className={'audience ' + (projector ? 'audience-projector' : '')}>
    <div className="audience-header">
      <div className="audience-brand"><span className="brand-symbol">K</span><span>KAiSEi <b>SUGOROKU</b></span></div>
      <div className="audience-status"><span className="live-dot"/>{isFinish ? 'FINAL RESULT' : view.stage === 'standby' ? 'STANDBY' : 'ROUND ' + String(view.roundNumber).padStart(2, '0')}</div>
    </div>
    <div className="audience-intro">
      <div className="audience-kicker">{isFinish ? 'GAME COMPLETE' : isChallenge ? "LET'S CHALLENGE" : isResult ? 'ROUND RESULT' : 'READY TO PLAY'}</div>
      <h2>{isFinish ? '最終結果発表' : isChallenge || isResult ? (view.challengeTitle || 'お題') : view.title}</h2>
      {isChallenge && <p>{view.challengeDescription || 'チームで挑戦して、順位を決めよう！'}</p>}
      {isChallenge && view.timeLimitSeconds != null && view.timeLimitSeconds > 0 && <span className="time-pill">制限時間 {view.timeLimitSeconds} 秒</span>}
      {isResult && <p>順位が確定しました。駒が進みます！</p>}
      {isFinish && <p>すべてのチームの健闘を称えましょう。</p>}
      {view.stage === 'standby' && <p>お題が公開されるまで、少々お待ちください。</p>}
    </div>
    {isFinish && <div className="winner-banner"><Trophy size={25}/><div><span>WINNER</span><strong>{standings[0]?.name ?? '—'}</strong></div><Sparkles size={23}/></div>}
    {isResult && ranks.length > 0 && <div className="result-strip">
      {ranks.map((r) => {
        const team = view.teams.find((t) => t.id === r.teamId);
        return <div className="result-card" key={r.teamId}><span className="result-rank">{r.rank}<small>位</small></span><span className="result-team"><span className="team-dot" style={{ background: team?.color }}/>{team?.name}</span><strong className={r.movement >= 0 ? 'positive' : 'negative'}>{r.movement > 0 ? '+' : ''}{r.movement}<small>マス</small></strong></div>;
      })}
    </div>}
    <div className="audience-board-area">
      <div className="board-section-head"><div><Flag size={17}/><span>GAME BOARD</span></div><span>{view.goalPosition} マスでゴール</span></div>
      <Board teams={animated} goal={view.goalPosition}/>
    </div>
    <div className="audience-ranking">
      <div className="ranking-label"><Medal size={18}/> {isFinish ? '最終順位' : '現在の順位'}</div>
      <div className="ranking-items">
        {standings.map((team, i) => <div className="ranking-item" key={team.id}><span className={'standing-place place-' + (i + 1)}>{i + 1}</span><span className="team-dot" style={{ background: team.color }}/><span className="ranking-name">{team.name}</span><strong>{team.position}<small> / {view.goalPosition}</small></strong>{team.finishedAtRound !== null && <CheckCircle2 size={17} className="success-text"/>}</div>)}
      </div>
    </div>
    <div className="audience-footer"><span><Users size={14}/> {view.teams.length} チームが参加</span><span>KAiSEi PE SUGOROKU</span></div>
  </div>;
}
