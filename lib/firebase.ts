import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _db: Firestore | null = null;

/**
 * Firebase Admin SDK -> Cloud Firestore.
 * On Cloud Run this uses the service account automatically (Application Default Credentials).
 * Locally: run `gcloud auth application-default login` and set GOOGLE_CLOUD_PROJECT.
 */
export function db(): Firestore {
  if (_db) return _db;
  const app =
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID,
    });
  _db = getFirestore(app);
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}

export function ws(workspaceId: string) {
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(workspaceId)) throw new Error("Invalid workspace id");
  return db().collection("workspaces").doc(workspaceId);
}
