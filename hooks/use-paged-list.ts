'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  changeFilters,
  emptyPaging,
  filterQuery,
  listUrl,
  readNextCursor,
  receivePage,
  type ListFilters,
  type PagingState,
} from '@/lib/list-paging';

interface PagedListOptions {
  /** Server-side filters, sent as query parameters. A change reloads from the first page. */
  filters?: ListFilters;
  /** Load the first page while true (and again each time it turns true). */
  enabled?: boolean;
  /** The message when a failed response carries no `error` text. */
  errorText: string;
  /** Shows a failed load. The rows already loaded stay. */
  onError: (message: string) => void;
}

/**
 * One list route, page by page. The first page loads on mount and whenever the
 * filters change (the old rows and cursor are dropped first); `loadMore` appends
 * the next page while a cursor exists. A response that arrives after a newer
 * load started is ignored, so a slow first page cannot overwrite a filter change.
 */
export function usePagedList<T extends { _id: string }>(
  path: string,
  { filters = {}, enabled = true, errorText, onError }: PagedListOptions,
) {
  const key = filterQuery(filters);
  const [state, setState] = useState<PagingState<T>>(() => emptyPaging<T>(key));
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Bumped by every first-page load; a response from an older load is stale.
  const generation = useRef(0);
  const loadingMore = useRef(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  const fetchPage = useCallback(
    async (before: string | null): Promise<{ rows: T[]; cursor: string | null }> => {
      const response = await fetch(listUrl(path, { filters: key, before }));
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || errorText);
      if (!Array.isArray(data)) return { rows: [], cursor: null };
      return { rows: data as T[], cursor: readNextCursor(response) };
    },
    [path, key, errorText],
  );

  // quiet: refresh the first page without the loading state (after a save whose
  // response could not be placed in the list), keeping the rows if it fails.
  const loadFirst = useCallback(
    async (quiet: boolean) => {
      const gen = ++generation.current;
      loadingMore.current = false;
      setIsLoadingMore(false);
      if (!quiet) {
        setIsLoading(true);
        setState(s => changeFilters(s, key));
      }
      try {
        const page = await fetchPage(null);
        if (gen !== generation.current) return;
        setState(s => receivePage(s, { key, ...page, append: false }));
      } catch (error) {
        if (gen !== generation.current) return;
        if (!quiet) setState(emptyPaging<T>(key));
        onErrorRef.current(error instanceof Error ? error.message : errorText);
      } finally {
        if (gen === generation.current) setIsLoading(false);
      }
    },
    [key, fetchPage, errorText],
  );

  useEffect(() => {
    if (enabled) void loadFirst(false);
  }, [enabled, loadFirst]);

  const cursor = state.cursor;
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore.current) return;
    const gen = generation.current;
    loadingMore.current = true;
    setIsLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      if (gen !== generation.current) return;
      setState(s => receivePage(s, { key, ...page, append: true }));
    } catch (error) {
      if (gen !== generation.current) return;
      // The loaded rows and the cursor stay, so the button can be pressed again.
      onErrorRef.current(error instanceof Error ? error.message : errorText);
    } finally {
      if (gen === generation.current) {
        loadingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [cursor, key, fetchPage, errorText]);

  /** Local edits (a delete, a create, a save) applied to the loaded rows. */
  const updateRows = useCallback((update: (rows: T[]) => T[]) => {
    setState(s => ({ ...s, rows: update(s.rows) }));
  }, []);

  const refresh = useCallback(() => loadFirst(true), [loadFirst]);

  return {
    rows: state.rows,
    /** True while the server has said more rows exist (an X-Next-Cursor came back). */
    hasMore: cursor !== null,
    isLoading,
    isLoadingMore,
    loadMore,
    refresh,
    updateRows,
  };
}
