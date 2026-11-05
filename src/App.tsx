import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Clock3, Download, FolderOpen, Home, LayoutDashboard, ListChecks, MonitorUp, Plus, Settings2, Sparkles, Trash2, Trophy, Upload, WifiOff } from 'lucide-react';
import type { Game, PublicView } from './types';
import { makeGame } from './engine';
import { useGameStore, currentView } from './store';
import { CHANNEL_NAME, listenForDisplayRequests } from './sync';
import type { SyncMessage } from './sync';
import { loadPublic } from './storage';
import { Audience } from './components/Audience';
import { SettingsScreen } from './components/Settings';
import { PlayScreen } from './components/Play';

type Route = 'home' | 'settings' | 'play';
const displayId = new URLSearchParams(window.location.search).get('display');

function DisplayWindow({ id }: { id: string }) {
  const [view, setView] = useState<PublicView | null>(null);
  useEffect(() => {
    let mounted = true;
    loadPublic(id).then((data) => { if (mounted && data) setView(data); }).catch(console.error);
    if (!('BroadcastChannel' in window)) return () => { mounted = false; };
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      if (event.data?.type === 'snapshot' && event.data.view.gameId === id) setView(event.data.view);
    };
    channel.postMessage({ type: 'request', gameId: id } satisfies SyncMessage);
    const retry = window.setTimeout(() => channel.postMessage({ type: 'request', gameId: id } satisfies SyncMessage), 600);
    return () => { mounted = false; window.clearTimeout(retry); channel.close(); };
  }, [id]);
  return <div className="display-window">
    {view ? <Audience view={view} projector/> : <div className="waiting-display"><span className="brand-symbol">K</span><h1>表示画面を準備しています</h1><p>運営画面からゲームを開始してください。</p></div>}
  </div>;
}

function AppShell() {
  const games = useGameStore((s) => s.games);
  const activeId = useGameStore((s) => s.activeGameId);
  const hydrated = useGameStore((s) => s.hydrated);
  const createGame = useGameStore((s) => s.createGame);
  const selectGame = useGameStore((s) => s.selectGame);
  const removeGame = useGameStore((s) => s.removeGame);
  const importGame = useGameStore((s) => s.importGame);
  const hydrate = useGameStore((s) => s.hydrate);
  const game = games.find((g) => g.id === activeId);
  const [route, setRoute] = useState<Route>('home');
  const [sideOpen, setSideOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void hydrate(); return listenForDisplayRequests(currentView); }, [hydrate]);
  const navigate = (next: Route) => { if (next !== 'home' && !game) return; setRoute(next); setSideOpen(false); };
  const create = (sample = false) => { createGame(sample); navigateNew(); };
  const navigateNew = () => { setRoute('settings'); setSideOpen(false); };
  const open = (g: Game) => { selectGame(g.id); setRoute(g.status === 'setup' ? 'settings' : 'play'); setSideOpen(false); };
  const exportGame = (g: Game) => {
    const blob = new Blob([JSON.stringify({ version: 1, game: g }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = (g.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 70) || 'sugoroku') + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const doImport = async (file: File) => {
    try {
      if (file.size > 2_000_000) throw new Error('ファイルが大きすぎます。');
      importGame(JSON.parse(await file.text()));
      setRoute('settings');
    } catch (error) { alert(error instanceof Error ? error.message : '読み込みに失敗しました。'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  if (!hydrated) return <div className="app-loading"><span className="brand-symbol">K</span><p>読み込み中…</p></div>;

  return <div className="app-shell">
    <aside className={'sidebar ' + (sideOpen ? 'sidebar-open' : '')}>
      <div className="sidebar-brand"><span className="brand-symbol">K</span><div><strong>KAiSEi</strong><small>PE SUGOROKU</small></div></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav">
        <button className={route === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={18}/>ホーム</button>
        <button disabled={!game} className={route === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={18}/>ゲーム設定</button>
        <button disabled={!game || game.status === 'setup'} className={route === 'play' ? 'active' : ''} onClick={() => navigate('play')}><LayoutDashboard size={18}/>進行画面</button>
      </nav>
      <div className="sidebar-label">CURRENT GAME</div>
      {game ? <div className="sidebar-current">
        <div className="sidebar-current-icon"><Trophy size={20}/></div>
        <strong>{game.title}</strong>
        <small>{game.teams.length} チーム · {game.settings.goalPosition} マス</small>
        <span className={'status-badge status-' + game.status}>{game.status === 'setup' ? '設定中' : game.status === 'playing' ? '進行中' : '終了'}</span>
      </div> : <div className="sidebar-empty">ゲームが選択されていません</div>}
      <div className="sidebar-spacer"/>
      <div className="sidebar-bottom"><WifiOff size={17}/><div><strong>ローカルで動作</strong><small>データはこのPCに保存</small></div></div>
    </aside>
    {sideOpen && <button className="sidebar-overlay" aria-label="メニューを閉じる" onClick={() => setSideOpen(false)}/>}
    <div className="main-column">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu" aria-label="メニューを開く" onClick={() => setSideOpen(true)}>☰</button><span className="breadcrumbs">KAiSEi SUGOROKU <ChevronRight size={15}/> <strong>{route === 'home' ? 'ホーム' : route === 'settings' ? 'ゲーム設定' : '進行画面'}</strong></span></div>
        <div className="topbar-right"><span className="save-indicator"><Check size={14}/> 自動保存</span><span className="header-avatar">K</span></div>
      </header>
      <div className="content">
        {route === 'home' && <div className="screen-container home-screen">
          <div className="welcome-card"><div className="welcome-copy"><span className="eyebrow">WELCOME TO PE SUGOROKU</span><h1>みんなで挑戦、<br/><em>一歩ずつゴールへ。</em></h1><p>お題で競って、順位に応じて進む。<br/>チーム対抗すごろくを自由に作成・進行できます。</p><div className="welcome-buttons">
            <button className="btn btn-light" onClick={() => create(false)}><Plus size={18}/>新しいゲームを作る</button>
            <button className="btn btn-outline-light" onClick={() => create(true)}><Sparkles size={18}/>サンプルで試す</button>
          </div></div><div className="welcome-art"><div className="art-finish">GOAL</div><div className="art-path"><span/><span/><span/><span/><span/><span/><span/><span/><span/></div><div className="art-tokens"><i/><i/><i/></div></div></div>
          <div className="home-section-head"><div><span className="eyebrow">YOUR GAMES</span><h2>保存したゲーム</h2><p>途中から再開したり、設定を編集したりできます。</p></div><button className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={16}/>JSONを読み込む</button></div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="visually-hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void doImport(file); }}/>
          {games.length ? <div className="game-card-grid">{games.map((g) => <article className="game-card" key={g.id}>
            <div className="game-card-upper"><span className="game-card-icon"><Trophy size={23}/></span><span className={'status-badge status-' + g.status}>{g.status === 'setup' ? '設定中' : g.status === 'playing' ? '進行中' : '終了'}</span></div>
            <h3>{g.title}</h3><div className="game-meta"><span><Clock3 size={14}/>{new Date(g.updatedAt).toLocaleDateString('ja-JP')}</span><span><BookOpen size={14}/>{g.challenges.length} お題</span><span><Trophy size={14}/>{g.teams.length} チーム</span></div>
            <div className="game-card-bottom"><button className="btn btn-primary btn-sm" onClick={() => open(g)}>{g.status === 'setup' ? '設定を続ける' : 'ゲームを開く'}<ArrowRight size={15}/></button><button className="icon-button" aria-label={g.title + 'をエクスポート'} title="JSONで書き出す" onClick={() => exportGame(g)}><Download size={17}/></button><button className="icon-button danger-on-hover" aria-label={g.title + 'を削除'} title="削除" onClick={() => { if (confirm('「' + g.title + '」を削除しますか？ この操作は取り消せません。')) removeGame(g.id); }}><Trash2 size={17}/></button></div>
          </article>)}</div> : <div className="empty-games"><FolderOpen size={43}/><h3>まだゲームがありません</h3><p>新しいゲームを作成するか、サンプルで操作を試してください。</p><button className="btn btn-primary" onClick={() => create(false)}><Plus size={17}/>新しいゲームを作る</button></div>}
          <div className="home-info-grid"><div className="info-panel"><MonitorUp size={22}/><strong>1画面・2画面に対応</strong><p>PCだけでも、プロジェクターにつないでも進行できます。</p></div><div className="info-panel"><ListChecks size={22}/><strong>お題を自由にカスタマイズ</strong><p>途中追加・ランダム出題・順位別の移動量に対応。</p></div><div className="info-panel"><CircleHelp size={22}/><strong>操作ミスにも対応</strong><p>結果の取り消しや、JSONバックアップが利用できます。</p></div></div>
        </div>}
        {route === 'settings' && game && <SettingsScreen game={game} onPlay={() => navigate(game.status === 'setup' ? 'home' : 'play')}/>}
        {route === 'play' && game && (game.status === 'setup' ? <SettingsScreen game={game} onPlay={() => navigate('home')}/> : <PlayScreen game={game} onEdit={() => navigate('settings')}/>)}
      </div>
    </div>
  </div>;
}
export function App() {
  if (displayId) return <DisplayWindow id={displayId}/>;
  return <AppShell/>;
}
