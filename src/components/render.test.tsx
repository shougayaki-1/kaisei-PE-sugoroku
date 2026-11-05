import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { makeGame, startGame } from '../engine';
import { Board } from './Board';
import { Audience } from './Audience';
import { SettingsScreen } from './Settings';
import { PlayScreen } from './Play';

describe('主要画面のスモークテスト', () => {
  it('公開画面でゲーム名と盤面を描画できる', () => {
    const game = makeGame(true);
    const html = renderToString(<Audience view={game.publicView}/>);
    expect(html).toContain('サンプル体育すごろく');
    expect(html).toContain('GAME BOARD');
  });
  it('設定画面でチームとお題編集タブを描画できる', () => {
    const html = renderToString(<SettingsScreen game={makeGame(true)} onPlay={() => {}}/>);
    expect(html).toContain('チームを追加');
    expect(html).toContain('ルール・盤面');
  });
  it('進行画面で出題操作を描画できる', () => {
    const game = startGame(makeGame(true));
    const html = renderToString(<PlayScreen game={game} onEdit={() => {}}/>);
    expect(html).toContain('このお題を公開する');
  });
  it('マス数が10の倍数でなくても盤面を描画できる', () => {
    const game = makeGame();
    const html = renderToString(<Board teams={game.teams} goal={17}/>);
    expect(html).toContain('blank-');
    expect(html).toContain('GOAL');
  });
});
