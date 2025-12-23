/**
 * IndexedDB utility for storing large CSV data and graph state
 */

const DB_NAME = 'LineageVisualizationDB';
const DB_VERSION = 1;
const CSV_STORE = 'csvData';
const STATE_STORE = 'graphState';

/**
 * Open or create the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(CSV_STORE)) {
        db.createObjectStore(CSV_STORE);
      }
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE);
      }
    };
  });
}

/**
 * Store data in IndexedDB
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setItem(key: string, value: any, store: 'csv' | 'state' = 'csv'): Promise<void> {
  const db = await openDatabase();
  const storeName = store === 'csv' ? CSV_STORE : STATE_STORE;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.put(value, key);

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Retrieve data from IndexedDB
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getItem(key: string, store: 'csv' | 'state' = 'csv'): Promise<any | null> {
  const db = await openDatabase();
  const storeName = store === 'csv' ? CSV_STORE : STATE_STORE;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.get(key);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Remove data from IndexedDB
 */
export async function removeItem(key: string, store: 'csv' | 'state' = 'csv'): Promise<void> {
  const db = await openDatabase();
  const storeName = store === 'csv' ? CSV_STORE : STATE_STORE;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.delete(key);

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get all keys from IndexedDB
 */
export async function getAllKeys(store: 'csv' | 'state' = 'csv'): Promise<string[]> {
  const db = await openDatabase();
  const storeName = store === 'csv' ? CSV_STORE : STATE_STORE;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.getAllKeys();

    request.onsuccess = () => {
      db.close();
      resolve(request.result.map(k => String(k)));
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Clear all data from a store
 */
export async function clearStore(store: 'csv' | 'state' = 'csv'): Promise<void> {
  const db = await openDatabase();
  const storeName = store === 'csv' ? CSV_STORE : STATE_STORE;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.clear();

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}
