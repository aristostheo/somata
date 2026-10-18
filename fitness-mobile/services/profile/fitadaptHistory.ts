import { auth, db } from "@/lib/firebase";
import { collection, getDocs, limit, orderBy, query, startAfter,
  type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { FITADAPT_HISTORY_PAGE_SIZE, projectHistoryPage, type FitAdaptHistoryEvent } from "./fitadaptHistoryData";

export type FitAdaptHistoryCursor = QueryDocumentSnapshot<DocumentData>;
export type FitAdaptHistoryPage = { events: FitAdaptHistoryEvent[]; cursor: FitAdaptHistoryCursor | null; hasMore: boolean };

export async function loadFitAdaptHistoryPage(uid: string, cursor?: FitAdaptHistoryCursor): Promise<FitAdaptHistoryPage> {
  if (!uid || auth.currentUser?.uid !== uid) throw new Error("Sign in to view your own plan history.");
  const ref = collection(db, "fitadaptPlans", uid, "history");
  const clauses = [orderBy("resolvedAt", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(FITADAPT_HISTORY_PAGE_SIZE + 1)];
  const snapshot = await getDocs(query(ref, ...clauses));
  const page = snapshot.docs.slice(0, FITADAPT_HISTORY_PAGE_SIZE);
  return { events: projectHistoryPage(page.map((item) => ({ id: item.id, data: item.data() }))),
    cursor: page.at(-1) ?? null, hasMore: snapshot.docs.length > FITADAPT_HISTORY_PAGE_SIZE };
}
