

import useSetQuery from '../useSetQuery';

export const useSetQueryComment = () => {
  const { findQueryKey, updateInfinityQueryData, updateQueryData } =
    useSetQuery();
  const bestRef = useRef<Boolean | null>(null);
  const prevReplyData = useRef<ReplyListType | null>(null);
  const queryClient = useQueryClient();

  const getInfinityKeys = useCallback(
    (secretKey: string, parentId?: number) => ({
      ALL: findQueryKey<ReturnType<typeof QUERY_KEY_REPLY_API.LIST_INFINITE>>(
        (q1) => q1 === QUERY_KEY_REPLY_API.LIST_INFINITE()[0],
        (q2) =>
          q2?.query?.visibility === 'book_detail' &&
          q2?.query.parent === 0 &&
          q2?.query.book === secretKey &&
          !!q2?.query.ordering,
      ),
      BEST: findQueryKey<ReturnType<typeof QUERY_KEY_REPLY_API.LIST_INFINITE>>(
        (q1) => q1 === QUERY_KEY_REPLY_API.LIST_INFINITE()[0],
        (q2) =>
          q2?.query?.visibility === 'best' &&
          q2?.query.book === secretKey &&
          !!q2?.query.ordering,
      ),
      MY: findQueryKey<ReturnType<typeof QUERY_KEY_REPLY_API.LIST_INFINITE>>(
        (q1) => q1 === QUERY_KEY_REPLY_API.LIST_INFINITE()[0],
        (q2) => q2?.query?.visibility === 'me' && !!q2?.query.ordering,
      ),
      REPLY: findQueryKey<ReturnType<typeof QUERY_KEY_REPLY_API.LIST_INFINITE>>(
        (q1) => q1 === QUERY_KEY_REPLY_API.LIST_INFINITE()[0],
        (q2) => !!q2?.query?.parent && q2?.query?.parent === Number(parentId),
      ),
    }),
    [findQueryKey],
  );

  const getCommentDetailKey = useCallback(
    (id: number) =>
      findQueryKey<ReturnType<typeof QUERY_KEY_REPLY_API.RETRIEVE>>(
        (q1) => q1 === QUERY_KEY_REPLY_API.RETRIEVE()[0],
        (q2) => q2?.replyId === id,
      ),
    [findQueryKey],
  );

  const setCommentDetailQuery = useCallback(
    (queryKey: unknown[]) => {
      updateQueryData<ReplyListType>({
        queryKey,
        updater: (oldData) => {
          return {
            ...oldData,
            is_like: !oldData.is_like,
            like_cnt: oldData.is_like
              ? oldData.like_cnt - 1
              : oldData.like_cnt + 1,
          };
        },
      });
    },
    [updateQueryData],
  );

  const updateLikeInfinityQuery = useCallback(
    ({ queryKey, id }: { queryKey: unknown[]; id: number }) => {
      updateInfinityQueryData<Required<PaginatedReplyListListType>>({
        queryKey,
        isTarget: (item) => item.reply_id === id,
        updater: (item) => {
          if (!prevReplyData.current) prevReplyData.current = item;

          const likeCnt = item.is_like ? item.like_cnt - 1 : item.like_cnt + 1;

          const isAddedBest = item.like_cnt === 99 && likeCnt === 100;
          const isSubtractBest = item.like_cnt === 100 && likeCnt === 99;

          if (isAddedBest || isSubtractBest) {
            bestRef.current = true;
          }

          return {
            ...item,
            is_like: !item.is_like,
            like_cnt: likeCnt,
          };
        },
      });
    },
    [updateInfinityQueryData],
  );

  const invalidateBestQuery = useCallback(
    (queryKey: unknown[]) => {
      if (isEmpty(queryKey)) return;
      queryClient.invalidateQueries(queryKey);
    },
    [queryClient],
  );

  const likeQuerySetHandler = useCallback(
    ({
      id,
      parentId,
      secretKey,
    }: {
      id: number;
      parentId: number;
      secretKey: string;
    }) => {
      const commentDetailKey = getCommentDetailKey(id);
      const infinityKeys = getInfinityKeys(secretKey, parentId);

      setCommentDetailQuery(commentDetailKey);

      Object.values(infinityKeys).forEach((queryKey) => {
        updateLikeInfinityQuery({
          queryKey,
          id,
        });
      });

      if (bestRef.current === true) {
        invalidateBestQuery(infinityKeys['BEST']);
      }
    },
    [
      getCommentDetailKey,
      getInfinityKeys,
      invalidateBestQuery,
      setCommentDetailQuery,
      updateLikeInfinityQuery,
    ],
  );

  const rollback = useCallback(
    ({
      id,
      parentId,
      secretKey,
    }: {
      id: number;
      parentId: number;
      secretKey: string;
    }) => {
      if (!prevReplyData.current) return;

      const commentDetailKey = getCommentDetailKey(id);

      updateQueryData<ReplyListType>({
        queryKey: commentDetailKey,
        updater: (oldData) => {
          if (!prevReplyData.current) return oldData;
          return prevReplyData.current;
        },
      });

      const infinityKeys = getInfinityKeys(secretKey, parentId);

      Object.values(infinityKeys).forEach((queryKey) => {
        updateInfinityQueryData<Required<PaginatedReplyListListType>>({
          queryKey,
          isTarget: (item) => item.reply_id === id,
          updater: (item) => {
            if (!prevReplyData.current) return item;

            return prevReplyData.current;
          },
        });
      });

      prevReplyData.current = null;
    },
    [
      getCommentDetailKey,
      getInfinityKeys,
      updateInfinityQueryData,
      updateQueryData,
    ],
  );

  return {
    handler: {
      likeQuerySetHandler,
      updateLikeInfinityQuery,
      rollback,
    },
  };
};
