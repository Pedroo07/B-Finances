import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { mergeRule } from "../importer/rules";
import type { ImportRule, ImportRuleInput } from "../importer/rules";

const auth = getAuth();

function getImportRulesCollection() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return collection(db, `users/${user.uid}/importRules`);
}

function sanitizeRule(input: ImportRuleInput): ImportRuleInput {
  return {
    matchText: input.matchText,
    ...(input.rewriteDescription !== undefined && {
      rewriteDescription: input.rewriteDescription,
    }),
    ...(input.category !== undefined && { category: input.category }),
  };
}

export async function getImportRules(): Promise<ImportRule[]> {
  const snapshot = await getDocs(getImportRulesCollection());

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as ImportRuleInput),
  }));
}

export async function saveImportRule(
  input: ImportRuleInput,
  currentRules: ImportRule[],
): Promise<ImportRule> {
  const rulesRef = getImportRulesCollection();
  const merged = sanitizeRule(mergeRule(currentRules, input));
  const current = currentRules.find(
    (rule) => rule.matchText === input.matchText,
  );

  if (current) {
    await setDoc(doc(rulesRef, current.id), merged);
    return { id: current.id, ...merged };
  }

  const created = await addDoc(rulesRef, merged);
  return { id: created.id, ...merged };
}

export async function deleteImportRule(id: string): Promise<void> {
  await deleteDoc(doc(getImportRulesCollection(), id));
}
