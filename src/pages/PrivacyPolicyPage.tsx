// Pinterest API 등 외부 API 신청 시 제출하는 개인정보처리방침 페이지.
// 로그인 없이 누구나 접근 가능해야 해서 main.tsx에서 라우팅 전에 분기 처리됨 —
// 앱 메뉴/네비게이션에는 의도적으로 노출하지 않음.
export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#ffffff' }}>
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo", sans-serif', color: '#1f2937', lineHeight: 1.7 }}>
      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>PIVOT CREATIVE (피벗크리에이티브) · Last updated: 2026-07-21</p>
      </header>

      <section style={{ marginBottom: 48 }}>
        <p style={{ marginBottom: 16 }}>
          PIVOT CREATIVE ("we", "us", "our") operates an internal creative-reference tool that uses
          the Pinterest API to search for design references and help our team generate AI image
          prompts for internal creative work. This Privacy Policy explains what information we
          access, how we use it, and how you can contact us.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>1. Information we collect</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <li>Public Pinterest content returned by the Pinterest API in response to searches performed by our authorized internal users (e.g. pin images, titles, descriptions, and source links).</li>
          <li>Basic Pinterest account profile information (such as account name) only when a team member explicitly connects their own Pinterest account to authorize API access.</li>
        </ul>

        <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>2. How we use this information</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <li>To display and organize design references retrieved from Pinterest for internal creative research.</li>
          <li>To help our team draft AI image-generation prompts based on the visual concept of reference images.</li>
        </ul>
        <p style={{ marginBottom: 16 }}>We do not use this information for advertising, profiling, or any purpose unrelated to internal creative work.</p>

        <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>3. Sharing</h2>
        <p style={{ marginBottom: 16 }}>We do not sell or share Pinterest data with third parties. Data is only visible to authorized members of our internal team.</p>

        <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>4. Retention &amp; deletion</h2>
        <p style={{ marginBottom: 16 }}>We retain data only as long as needed for the internal project it relates to. You may request deletion of any connected account data or cached reference data at any time by contacting us below.</p>

        <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>5. Contact</h2>
        <p>PIVOT CREATIVE — <a href="mailto:js.yoo@pivot-inc.com">js.yoo@pivot-inc.com</a></p>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '40px 0' }} />

      <section>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>개인정보처리방침</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>피벗크리에이티브(PIVOT CREATIVE) · 최종 수정일: 2026-07-21</p>

        <p style={{ marginBottom: 16 }}>
          피벗크리에이티브(이하 "회사")는 Pinterest API를 활용해 디자인 레퍼런스를 검색하고,
          내부 팀이 AI 이미지 생성 프롬프트를 작성하는 데 도움을 주는 사내 전용 도구를 운영합니다.
          본 방침은 회사가 어떤 정보를 수집·이용하는지, 이용자가 어떻게 문의할 수 있는지를 설명합니다.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>1. 수집하는 정보</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <li>회사의 승인된 내부 사용자가 검색을 실행했을 때 Pinterest API가 반환하는 공개 콘텐츠(핀 이미지, 제목, 설명, 원본 링크 등)</li>
          <li>팀원이 자신의 Pinterest 계정을 직접 연동·인증하는 경우에 한해, 계정 기본 프로필 정보(계정명 등)</li>
        </ul>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>2. 이용 목적</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <li>내부 크리에이티브 리서치를 위해 Pinterest에서 가져온 레퍼런스를 표시·정리</li>
          <li>레퍼런스 이미지의 시각적 컨셉을 바탕으로 팀이 AI 이미지 생성 프롬프트를 작성하도록 보조</li>
        </ul>
        <p style={{ marginBottom: 16 }}>수집된 정보는 광고, 프로파일링 등 내부 업무와 무관한 목적으로는 이용하지 않습니다.</p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>3. 제3자 제공</h2>
        <p style={{ marginBottom: 16 }}>Pinterest에서 수집한 정보를 제3자에게 판매하거나 제공하지 않으며, 회사 내부의 승인된 인원만 접근할 수 있습니다.</p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>4. 보관 및 삭제</h2>
        <p style={{ marginBottom: 16 }}>관련 프로젝트에 필요한 기간 동안만 보관하며, 이용자는 언제든지 아래 연락처로 연동 계정 정보나 캐시된 레퍼런스 데이터의 삭제를 요청할 수 있습니다.</p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>5. 문의</h2>
        <p>피벗크리에이티브 — <a href="mailto:js.yoo@pivot-inc.com">js.yoo@pivot-inc.com</a></p>
      </section>
    </div>
    </div>
  );
}
