import {
  Activity,
  fileBytes,
  STORAGE_LIMIT,
  validateActivity,
} from "./categories";
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("pt-career-damoa-preview", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("activities", { keyPath: ["owner", "id"] });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        new Error(
          "브라우저 저장소를 열 수 없습니다. 저장소 설정을 확인해주세요.",
        ),
      );
  });
}
const ownerRange = (owner: string) =>
  IDBKeyRange.bound([owner, ""], [owner, "\uffff"]);
export async function loadActivities(owner: string): Promise<Activity[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const r = db
        .transaction("activities")
        .objectStore("activities")
        .getAll(ownerRange(owner));
      r.onsuccess = () =>
        resolve(
          r.result.sort((a: Activity, b: Activity) =>
            b.updated.localeCompare(a.updated),
          ),
        );
      r.onerror = () =>
        reject(new Error("기록을 불러오지 못했습니다. 다시 시도해주세요."));
    });
  } finally {
    db.close();
  }
}
export async function saveActivity(activity: Activity): Promise<void> {
  validateActivity(activity);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("activities", "readwrite");
      const store = tx.objectStore("activities");
      let failure = "저장하지 못했습니다. 브라우저의 남은 공간을 확인해주세요.";
      const r = store.getAll(ownerRange(activity.owner));
      r.onsuccess = () => {
        const rows: Activity[] = r.result.filter(
          (row: Activity) => row.id !== activity.id,
        );
        if (fileBytes([...rows, activity]) > STORAGE_LIMIT) {
          failure =
            "개인 저장 용량 100MB를 초과합니다. 첨부 자료를 줄여주세요.";
          tx.abort();
          return;
        }
        store.put(activity);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new Error(failure));
      tx.onerror = () => reject(new Error(failure));
    });
  } finally {
    db.close();
  }
}
export async function deleteActivity(owner: string, id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("activities", "readwrite");
      tx.objectStore("activities").delete([owner, id]);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(new Error("삭제하지 못했습니다. 다시 시도해주세요."));
    });
  } finally {
    db.close();
  }
}
