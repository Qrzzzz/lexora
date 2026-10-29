const DB = "lexora-notebook",
  STORE = "workspace";
let database;
async function open() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(Error("请先关闭其他旧版 Lexora 页面，再刷新"));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = null;
      };
      resolve(db);
    };
  });
  return database;
}
export async function loadWorkspace() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly"),
      request = transaction.objectStore(STORE).get("current");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function persistWorkspace(snapshot) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(snapshot, "current");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || Error("保存中断"));
    tx.onerror = () => reject(tx.error);
  });
}
