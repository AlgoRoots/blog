# [nextJS] getLayout: 페이지간 상태를 공유하고 싶을 때

NextJS에서 제공하는 getLayout()에 대해 소개하고자 합니다.

## 문제 상황

회사의 보일러플레이트에서는 전역 상태 관리를 위해 Redux Toolkit을 사용하는 대신, React Context API를 사용하고 있습니다. 이로 인해 상태 및 핸들러를 지역적으로도 효과적으로 관리할 수 있게 되었고, use-context-selector를 사용하여 Context API의 렌더링 문제를 해결하였습니다.

지역적으로 사용할 때는 공통된 로직과 패턴은 페이지마다 Provider로 래핑하여 공유하고 있었습니다. 그러나 페이지 간에 Context를 공유해야 하는 상황이 발생했습니다. 

## 예시 상황
캐시를 충전하는 페이지에서 아이템을 선택하면 캐시 결제 페이지로 넘어가며 이 때 캐시 충전 페이지에서 선택했던 해당 아이템의 정보(id, amount 등)를 가져와야합니다. 

## 문제 해결 방안

제가 생각했던 두 가지 방법이 있었습니다.

1. 라우터 쿼리(query)를 통한 전달: 간단하지만 쿼리에 캐시 값이 노출될 경우 유저가 변경할 수 있는 위험이 있었습니다.
   1. as props을 활용 하여 전달 : 쿼리를 숨겨 전달이 가능하지만 변경이 안된다는 것이 보장되는가? 에대한 의문이 있어 개인적으로 선호하는 방식은 아닙니다.
2. 전역 상태에 저장: 구현 가능하지만 코드의 응집도가 떨어집니다.
3. 한 페이지에서 step을 통한 컴포넌트 관리 : 개인적으로 사용했던 방식이기도 하지만 다른 페이지에서 결제 페이지로 바로 이동하는 경우가 있을 수도 있다고 생각하여 설계시 제외했던 구현방식입니다.

## Layout 이용

이 문제를 해결하기 위해 NextJS의 Layout 기능을 활용할 수 있었습니다. Layout을 사용하면 페이지 간에 Context를 공유할 수 있으며 페이지 전환 사이에 React 컴포넌트 트리가 유지되므로 상태가 지속됩니다.

간단히 설명하면, 페이지마다의 레이아웃을 공유할 수 있으며 페이지 간의 상태를 유지하고 싶을 때 사용할 수 있습니다.

## 코드 적용 방법

페이지에 `getLayout` 함수를 추가하고 최상위 페이지(`app.tsx`)에서 해당 함수를 호출하여 레이아웃을 가져옵니다.

 Page에 getLayout을 오브젝트로 등록하고 
```jsx
// pages/index.tsx
import type { ReactElement } from 'react'
import Layout from '../components/layout'
import NestedLayout from '../components/nested-layout'
import type { NextPageWithLayout } from './_app'
 
const Page: NextPageWithLayout = () => {
  return <p>hello world</p>
}
 
Page.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
      <NestedLayout>{page}</NestedLayout>
    </Layout>
  )
}
 
export default Page

```
최상단 페이지 app.tsx 에서 렌더링하는 컴포넌트의 getLayout를 체크해 가지고 옵니다. 
```jsx
// pages/_app.tsx
import type { ReactElement, ReactNode } from 'react'
import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
 
export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}
 
type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}
 
export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page) => page)
 
  return getLayout(<Component {...pageProps} />)
}
```

# 실무 적용: NextPageLayout.tsx

저뿐만 아니라 팀원 분들도 `getLayout()`을 사용해야 하는 경우가 생기게 되어 의견을 공유하다보니 문서의 예제처럼 각각 관리되는 것보다는 하나의 파일에서 관리되는 것이 좋을 것 이라는 판단을 내리게 되었습니다.

따라서 현재는 `NextPageLayout.tsx`이라는 파일 안에서 관리하고 있습니다. 


## NextPageLayout.tsx 파일 구조

`NextPageLayout.tsx` 파일의 구조를 보여줍니다. 이 파일은 페이지 간 공유할 레이아웃을 정의하는 데 사용됩니다.

```jsx
// src/components/@Layout/NextPageLayout.tsx

import { ReactElement } from 'react';
import { PaymentProvider } from '@/containers/CashPayment/context/usePaymentContext';
import { ProfileProvider } from '@/containers/My/Profile/context/useProfileContext';
import withVerifiedGuard from '@/hocs/profile/withVerifiedGuard';
import withAuthGuard from '@/hocs/withAuthGuard';
import withUnAuthGuard from '@/hocs/withUnAuthGuard';

// 고차 컴포넌트 (Higher-Order Component) 정의
const WithAuth = withAuthGuard(({ children }) => <>{children}</>);
const WithUnAuth = withUnAuthGuard(({ children }) => <>{children}</>);
const WithVerified = withVerifiedGuard(({ children }) => <>{children}</>);

// 페이지 레이아웃을 가져오기 위한 함수 정의
export const getPaymentLayout = (page: ReactElement) => {
  return (
    <WithAuth>
      <PaymentProvider>{page}</PaymentProvider>
    </WithAuth>
  );
};

export const getProfileLayout = (page: ReactElement) => {
  return (
    <WithAuth>
      <ProfileProvider>
        <WithVerified>{page}</WithVerified>
      </ProfileProvider>
    </WithAuth>
  );
};

export const getUserLayout = (page: ReactElement) => {
  return <WithUnAuth>{page}</WithUnAuth>;
};

```

## 정리
페이지 간 상태 공유에 유용한 NextJS getLayout()에 대해 소개했습니다. 레이아웃을 사용하면 페이지 간 상태 공유가 가능하며, Context가 아니더라도 상태 공유에 유용하게 사용될 수 있습니다.
