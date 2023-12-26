# [React Query의 setQueryData 활용한 캐싱된 데이터 업데이트 훅 소개]

React Query의 `setQueryData` 함수는 캐싱된 데이터를 수정할 수 있는 훅으로, 이를 통해 UI를 먼저 업데이트하는 Optimistic Update 및 서버 비용 개선용으로 활용할 수 있습니다.

# 배경

이전에는 주로 캐싱 데이터를 업데이트할 때 UI 업데이트를 위한 Optimistic Update 용도로 사용하고는 했는데, 최근 프로젝트에서 수많은 ApI 요청으로 인한 서버 비용을 개선하기 위해 캐시를 수정하게 되었습니다. 
<br/>

# 동기

Optimistic Update를 처음 접했을 때 인피니티 쿼리에 적용하면서 다가가기 어렵고(?) 시간도 꽤 소요되었던 경험이 었어, 처음 접하시는 분들이 더 쉽게 활용할 수 있도록 쿼리 캐시 수정용 훅을 만들었습니다.

<br/>

# `setQueryData` 용도

### 빠른 UI 업데이트

- 어떠한 데이터를 수정, 삭제, 생성 (mutate) 한 후, 응답 시간이 오래 걸리는 작업
- 응답시간은 빠르나, UI 업데이트가 느린 작업
  > 각각 백, 프런트 로직 이슈일 수 있지만, 빠른 수정이 필요하다면, 응답이 오기전, 데이터를 수정하는 작업도 대안이 됩니다.

> `mutate` 함수의 `onMutate` 콜백에서 요청 결과가 오기 전에 캐싱된 데이터를 수정하여 UI를 즉시 업데이트하고, 실패 시에는 원복시킬 수 있는 Optimistic Update를 사용할 수 있습니다.

### API 요청 최소화

댓글 좋아요, 도서 좋아요 등과 같은 간단한 좋아요 기능에서는 해당 쿼리에 의존하고 있는 다수의 쿼리들을 무효화시키는데 활용됩니다. 이러한 기능은 비용이 크지 않을 것으로 예상되지만, 페이지네이션 리스트이며, 이미 패칭한 데이터들이 많다면, 수많은 데이터를 리패칭하는 작업은 비용이 많이 들 수 있습니다.

예를 들어,

댓글 좋아요를 클릭했을 때, 해당 작업으로 인해 다음과 같은 데이터들이 영향을 받습니다.

- 내 댓글 리스트
- 도서 상세 댓글 리스트
- 도서 상세 Best 댓글 리스트
- 댓글 상세
- 대댓글 리스트

이와 같이 다수의 데이터가 영향을 받을 수 있으며, 이미 패칭된 데이터가 있다면 전체를 리패칭해야 하는 비용이 발생할 수 있습니다.

<br/><br/>

# useSetQuery.ts 훅 소개

사용성을 좀 더 편하게 하기 위해 순서별로,용도별로 나누었습니다.

```tsx
const useSetQuery = () => {
  const queryCache =  useQueryClient().getQueryCache();
  const queryCacheKey = queryCache.getAll().map((cache) => cache.queryKey); // 캐시된 쿼리키

  // query key 찾기
  const findQueryKey = ... // 캐시된 쿼리 키를 찾아 반환하는 함수입니다. 주어진 조건에 따라 원하는 쿼리 키를 검색할 수 있습니다.
  const updateQueryData = ... // 단일 쿼리 데이터 업데이트
  const updateInfinityQueryData = ... // 무한 리스트 쿼리 데이터 업데이트
  const rollback = ... // 이전 데이터로 롤백

  return {
    findQueryKey,
    updateQueryData,
    updateInfinityQueryData,
    rollback,
  };
};

```

# 사용

### 단일 쿼리 업데이트 updateQueryData 예시

```tsx
const { updateQueryData, findQueryKey, rollback } = useSetQuery();

const bookDetailQueryKey = useMemo(
  () =>
    findQueryKey<ReturnType<typeof QUERY_KEY_BOOK_API.RETRIEVE>>(
      (q1) => q1 === QUERY_KEY_BOOK_API.RETRIEVE()[0],
      (q2) => q2?.secretKey === secretKey && !!q2.params?.headers
    ),
  [findQueryKey, secretKey]
);

const { mutate: bookLikeMutate } = useBookLikeCreateMutation({
  options: {
    onMutate: () => {
      updateQueryData<BookRetrieveType>({
        queryKey: bookDetailQueryKey,
        updater: (oldData) => ({
          ...oldData,
          is_like: !oldData.is_like,
        }),
      });
    },
    onError: (error, _, context) => {
      const { prev } = context as { prev: BookRetrieveType };
      rollback(bookDetailQueryKey, prev);
    },
  },
});
```

### 인피니티 쿼리 업데이트 updateInfinityQueryData 예시

```tsx
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
  [updateInfinityQueryData]
);
```

구현된 훅 전체와 인피니티 쿼리를 여러 개 처리한 comment hook은 /hooks 경로에서 보실 수 있습니다

## 주의할 점

- 불변적으로 업데이트 해야합니다.
  - getQueryData 등으로 가져와서 적용시키면 안됩니다.
- 요청 전, onMutate 시에 사용시 에러시 캐시 데이터를 원복시켜줘야합니다.

## 질문

1. findQueryKey 의 과정없이 쿼리키를 직접 주입해도 되지만,
   쿼리키 두 번째 인자에 요청 파라미터가 들어가게 되면, 그 값까지 찾아 넣어야 해서 값 존재 유무 방식으로 했는데, 더 나은 방법이 있을까요?
