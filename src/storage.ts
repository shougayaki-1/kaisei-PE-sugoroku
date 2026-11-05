import type { AppData, PublicView } from './types';

const DB_NAME = 'kaisei-pe-sugoroku';
const STORE_NAME = 'data';
let connection: Promise<IDBDatabase> | null = null;

function getDatabase(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return connection;
}
async function read<T>(key: string): Promise<T | null> {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
async function write(key: string, value: unknown): Promise<void> {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
export const loadApp = () => read<AppData>('app');
export const saveApp = (data: AppData) => write('app', data);
export const loadPublic = (id: string) => read<PublicView>('public:' + id);
export const savePublic = (view: PublicView) => write('public:' + view.gameId, view);
