# [고차함수 활용 현업 적용 예제]

안녕하세요 이번 코드리뷰에서는 지난 세션에서 다뤘던 고차함수와 클로저를 현업에서 좋게 활용했다고 생각한 예시가 있어 공유드리면 좋을 것 같아 소개드리고자 합니다!
<br/><br/>

# 배경 지식

무한스크롤 시 전체 선택 구매 기능이 담긴 화면입니다.
전체 데이터를 다 불러올 수 없는 상황에서 요청 파라미터에 아래의 둘 중 하나를 넣어줍니다.

- 전체 선택 한 경우
  - 전체 선택에서 제외한 id만 넘겨줍니다. -> `ep_exclude_ids?: number[];`
  - 제외한 id가 없다면 빈 배열이 됨 -> `ep_exclude_ids:[]`
- 전체 선택 하지 않은 경우:
  선택된 id만 넘겨줍니다. -> `ep_include_ids?: number[];`

- 두 경우의 비교 `isSelectedInList`
  > 구매요청할 때는 받아온 데이터의 개수와 선택된 아이템 개수를 비교하여
  > 받아온 데이터의 개수가 더 크면 이미 전부 패칭된 데이터이기 때문에 `ep_include_ids`를, 작으면 받아온 리스트보다 선택된 개수가 더 많기 때문에 `ep_exclude_ids` 를 보내줍니다.

```jsx
const isSelectedInList = initialized.length >= selected.length; //true: ep_include_ids
```

<br/><br/>

# 구현 사항 (에피소드 선택 구매 화면)

> 현재 진행하고 있는 프로젝트에 적용한 예시입니다. 캐시를 충전해서 n화를 소장하고 대여해서 보는 카카오웹툰같은 서비스라고 생각해주시면 됩니다.

1. n개의 에피소드
2. n개를 선택구매 또는 전체구매 할 수 있음 (당연히 전체선택시 일부 아이템 취소 가능)
3. 선택될 때마다 아이템의 가격을 ui에 업데이트 해주어야 함
4. 구매 버튼은 두 개이며 소장 버튼과 대여 버튼이 있음 가격은 에피소드마다 다를 수 있으며 ui는 동시에 업데이트
5. 유저가 소장 또는 대여 버튼을 클릭시 ep_exclude_ids or ep_include_ids , 소장 또는 대여 총 가격을 보내줘야 함
   <br/><br/><br/>

# 고민했던 점

id만 보내는거면 단순한데, 가격까지 업데이틀 해야하는구나 뭔가 비슷한데 다르다..! 자칫하면 복잡해질 수 있겠다..!

<br/><br/>

# 공통점 찾기

ids , price를 구하는 로직에서 <ins><b>사용되는 ids와 각 경우마다 두 가지 조건(include,exclude)이 있는 것은 동일</b></ins>한데, <ins><b>수행되야 하는 로직만</b></ins>다르다.

### ids 경우

- ep_include_ids 일 때: 선택된 ids 추출
- ep_exclude_ids 일 때: 제외할 ids 추출

### price 경우

- ep_include_ids 일 때: 선택된 ids가격 합산
- ep_exclude_ids 일 때: 전체 가격 - 제외할 ids가격
  <br/><br/>

# 공통점 무시하고 작성하기

위의 공통점을 무시하고 로직을 작성해보겠습니다.

| price로직, ids 로직 모두 필요한 변수들입니다.

```jsx
const initialized = [...checkStatus].filter((d) => isNotNull(d.id));
// 리스트에 노출된 아이템 리스트 {id: number, isChecked: boolean}[]

const isSelectedInList = initialized.length >= selected.length;

const _selectedIds = [...selectedIds];
// isChecked : true(선택된)인 아이템 리스트

const includeIds = [...checkStatus]
  .filter((v) => v.isChecked)
  .map((v) => v.id)
  .filter(isNotNull);

const excludeIds = initialized
  .filter((v) => !v.isChecked)
  .map((i) => i.id)
  .filter(isNotNull);
```

| Price / ids 추출하는 로직

각 함수에서 조건 별로 각각에 맞는 동작을 수행하고 있습니다.

```jsx
const getTotalPrice: number = (key: "rent_price" | "sale_price") => {
  if (isSelectedInList) {
    return includeIds.reduce((prev, id) => {
      const data = episode.map.get(id);
      if (!data) return prev;
      return prev + (data[key] || 0);
    }, 0);
  } else {
    return excludeIds.reduce((prev, cur) => {
      const data = episode.map.get(cur);
      return prev - (data?.[key] || 0);
    }, episode.query.data?.pages[0][`total_${key}`] || 0);
  }
};

const includeOrExcludeIds = (() => {
  if (isSelectedInList) {
    return { ep_include_ids: includeIds };
  } else {
    return { ep_exclude_ids: excludeIds };
  }
})();
```

<br/><br/>

# 고차함수를 통한 추상화

> ids , price를 구하는 로직에서 <ins><b>사용되는 ids와 각 경우마다 두 가지 조건(include,exclude)이 있는 것은 동일</b></ins>한데, <ins><b>수행되야 하는 로직만</b></ins>다르다.

추후에 다른 개발자분이 수정한다고 했을 때, 위의 코드는 신경써야할 부분이 많아보입니다.
공통된 값들은 하나로 합쳐 응집도를 높이고, 수정이 있더라도 용이하게 할 수 있도록 차이가 있는 부분만 명확하게 하고 싶었습니다.

그럼, 다르게 이루어진 <ins>수행하는 로직</ins>만 받아서 처리하면 되지 않을까요?

```jsx
const includeOrExclude = <T1, T2>({
  onIncludes,
  onExcludes,
}: {
  onIncludes: (ids: number[]) => T1,
  onExcludes: (ids: number[]) => T2,
}): T1 | T2 => {
  const initialized = [...checkStatus].filter((d) => isNotNull(d.id));
  const selected = [...selectedIds];

  const isSelectedInList = initialized.length >= selected.length;

  const includeIds = [...checkStatus]
    .filter((v) => v.isChecked)
    .map((v) => v.id)
    .filter(isNotNull);

  const excludeIds = initialized
    .filter((v) => !v.isChecked)
    .map((i) => i.id)
    .filter(isNotNull);

  if (isSelectedInList) {
    return onIncludes(includeIds);
  } else {
    return onExcludes(excludeIds);
  }
};
```

<br/><br/>

# 적용

```jsx
const getTotalPrice = (key: "rent_price" | "sale_price") => {
  return includeOrExclude({
    onIncludes: (ids) => {
      return ids.reduce((prev, id) => {
        const data = episode.map.get(id);
        if (!data) return prev;
        return prev + (data[key] || 0);
      }, 0);
    },
    onExcludes: (ids) => {
      return ids.reduce((prev, cur) => {
        const data = episode.map.get(cur);
        return prev - (data?.[key] || 0);
      }, episode.query.data?.pages[0][`total_${key}`] || 0);
    },
  });
};

const includeOrExcludeIds = includeOrExclude({
  onIncludes: (ids) => {
    return { ep_include_ids: ids };
  },
  onExcludes: (ids) => {
    return { ep_exclude_ids: ids };
  },
});
```

<br/><br/>

# 정리

고차함수 이제 그만 우려먹겠습니다.. 안녕..

작성을 하다보니 배경지식이 없다면 이 로직이 왜 이렇게 수행되어야하는 지 부터 파악이 되어야 해서 어려울 것 같다는 생각을 했습니다. 우선 배경지식 설명이 힘들었어요.. 어찌됐든 고차함수를 활용해 include, exclude를 추출하는 로직을 추상화시키고, 수행되는 동작만 처리하는 `includeOrExclude` 함수를 처리하고 난 후 조금 더 명확하게 기능이 보여 조금은 더 나아진 코드가 아닐까 싶습니다 !
