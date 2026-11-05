import type { PublicView } from './types';

export const CHANNEL_NAME = 'kaisei-pe-sugoroku-v1';
export type SyncMessage =
  | { type: 'snapshot'; view: PublicView }
  | { type: 'request'; gameId: string };

let sender: BroadcastChannel | null = null;
export function broadcastPublic(view: PublicView) {
  if (!('BroadcastChannel' in window)) return;
  if (!sender) sender = new BroadcastChannel(CHANNEL_NAME);
  sender.postMessage({ type: 'snapshot', view } satisfies SyncMessage);
}
export function listenForDisplayRequests(getView: (id: string) => PublicView | null): () => void {
  if (!('BroadcastChannel' in window)) return () => {};
  const listener = new BroadcastChannel(CHANNEL_NAME);
  listener.onmessage = (event: MessageEvent<SyncMessage>) => {
    if (event.data?.type !== 'request') return;
    const view = getView(event.data.gameId);
    if (view) listener.postMessage({ type: 'snapshot', view } satisfies SyncMessage);
  };
  return () => listener.close();
}
