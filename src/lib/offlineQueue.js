import { openDB } from 'idb';

const DB_NAME = 'AuditPro_OfflineDB';
const STORE_NAME = 'sales_queue';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function enqueueOfflineSale(payload) {
  const db = await getDB();
  // payload should contain: id (client_uuid), department_id, sales_payload, timestamp
  await db.put(STORE_NAME, {
    ...payload,
    timestamp: new Date().toISOString()
  });
}

export async function getOfflineSales() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function dequeueOfflineSale(id) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearOfflineSales() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
