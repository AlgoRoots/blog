import { useCallback, useMemo } from 'react';

import { InfiniteData, QueryKey, useQueryClient } from '@tanstack/react-query';
import { isEmpty } from 'lodash-es';

import { ItemOf } from '@/types/utility/item-of';

type InfinityQueryUpdater<T extends { results: any[] }> = {
  queryKey: unknown[];
  isTarget: (item: ItemOf<T['results']>) => boolean;
  updater: (item: ItemOf<T['results']>) => ItemOf<T['results']>;
};

const useSetQuery = () => {
  const queryClient = useQueryClient();
  const queryCache = queryClient.getQueryCache();
  const queryCacheKey = queryCache.getAll().map((cache) => cache.queryKey);

  const findQueryKey = useCallback(
    <
      T extends QueryKey,
      Q1 = string,
      Q2 = T[1] extends string | infer R ? R : string,
    >(
      q1Condition: (firstKey: Q1) => boolean,
      q2Condition: (secondaryKey: Q2) => boolean,
    ) => {
      const target = queryCacheKey.filter((key) => {
        return q1Condition(key[0] as Q1) && q2Condition(key[1] as Q2);
      });
      return target.flat();
    },
    [queryCacheKey],
  );

  const updateQueryData = useCallback(
    <T>({
      queryKey,
      updater,
    }: {
      queryKey: unknown[];
      updater: (oldData: T) => T;
    }) => {
      if (isEmpty(queryKey)) return;
      queryClient.setQueriesData<T>(queryKey, (oldData) => {
        if (!oldData) return oldData;
        return updater(oldData);
      });
    },
    [queryClient],
  );

  const updateInfinityQueryData = useCallback(
    <T extends { results: any[] }>({
      queryKey,
      isTarget,
      updater,
    }: InfinityQueryUpdater<T>) => {
      if (isEmpty(queryKey)) return;

      queryClient.setQueriesData<InfiniteData<T>>(queryKey, (oldData) => {
        if (!oldData) return oldData;

        const targetPageIdx = oldData.pages.findIndex((page) =>
          page.results?.some(isTarget),
        );

        const updatedPages = oldData.pages.map((page, pageIndex) => {
          if (pageIndex === targetPageIdx) {
            const updatedResults = page.results?.map((item) => {
              if (isTarget(item)) {
                return updater(item);
              }
              return item;
            });
            return {
              ...page,
              results: updatedResults,
            };
          }
          return page;
        });

        return {
          ...oldData,
          pages: updatedPages,
        };
      });
    },
    [queryClient],
  );
  const rollback = useCallback(
    <T>(queryKey: unknown[], prev: T) => {
      console.log('rollback');
      if (isEmpty(queryKey)) return;
      queryClient.setQueriesData<T>(queryKey, prev);
    },
    [queryClient],
  );

  return {
    findQueryKey,
    updateQueryData,
    updateInfinityQueryData,
    rollback,
  };
};

export default useSetQuery;
