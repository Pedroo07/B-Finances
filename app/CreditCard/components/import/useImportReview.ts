"use client";

import { useCallback, useMemo, useReducer } from "react";
import {
  getBlockingErrors,
  reviewReducer,
  summarizeReview,
} from "@/lib/importer/review";
import type { ReviewAction, ReviewState } from "@/lib/importer/review";

type HookAction = ReviewAction | { type: "load"; state: ReviewState };

const EMPTY_STATE: ReviewState = { rows: [], past: [], manualCounter: 0 };

function reducer(state: ReviewState, action: HookAction): ReviewState {
  if (action.type === "load") return action.state;
  return reviewReducer(state, action);
}

export function useImportReview(expectedTotal?: number) {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE);

  const load = useCallback(
    (nextState: ReviewState) => dispatch({ type: "load", state: nextState }),
    [],
  );
  const reset = useCallback(
    () => dispatch({ type: "load", state: EMPTY_STATE }),
    [],
  );
  const summary = useMemo(
    () => summarizeReview(state.rows, expectedTotal),
    [state.rows, expectedTotal],
  );
  const blockingErrors = useMemo(
    () => getBlockingErrors(state.rows),
    [state.rows],
  );

  return {
    rows: state.rows,
    canUndo: state.past.length > 0,
    summary,
    blockingErrors,
    dispatch,
    load,
    reset,
  };
}

export type ImportReview = ReturnType<typeof useImportReview>;
