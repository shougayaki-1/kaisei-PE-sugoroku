import type { Team } from '../types';

type BoardProps = { teams: Team[]; goal: number; compact?: boolean };

export function Board({ teams, goal, compact = false }: BoardProps) {
  const columns = goal <= 8 ? Math.max(goal, 1) : 10;
  const count = Math.ceil(goal / columns);
  const positions: number[] = [];
  for (let row = 0; row < count; row++) {
    const start = row * columns + 1;
    const end = Math.min((row + 1) * columns, goal);
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    if (row % 2 === 1) indices.reverse();
    positions.push(...indices);
  }
  const starters = teams.filter((t) => t.position === 0);
  return (
    <div className={'board-frame ' + (compact ? 'board-compact' : '')}>
      <div className="board-topline">
        <div className="start-zone">
          <span className="board-caption">START</span>
          <div className="token-row">
            {starters.map((t) => <Token team={t} key={t.id} />)}
            {!starters.length && <span className="empty-spot">—</span>}
          </div>
        </div>
        <div className="board-progress">
          <span className="board-caption">GOAL</span>
          <strong>{goal} <small>マス</small></strong>
        </div>
      </div>
      <div className="board-grid" style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))' }}>
        {positions.map((pos) => {
          const occupied = teams.filter((t) => t.position === pos);
          return (
            <div className={'board-cell ' + (pos === goal ? 'goal-cell ' : '') + (occupied.length ? 'occupied ' : '')}
              key={pos} title={occupied.map((t) => t.name).join('、')}>
              <span className="cell-number">{pos === goal ? 'GOAL' : String(pos).padStart(2, '0')}</span>
              <div className="token-row">{occupied.map((t) => <Token team={t} key={t.id} />)}</div>
            </div>
          );
        })}
      </div>
      <div className="board-footnote">数字の順番に進みます。偶数段は右から左へ折り返します。</div>
    </div>
  );
}
function Token({ team }: { team: Team }) {
  return <span className="board-token" style={{ background: team.color }}
    title={team.name} aria-label={team.name}>{team.name.trim().slice(0, 1) || '?'}</span>;
}
