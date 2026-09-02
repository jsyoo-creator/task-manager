
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.tsx";
  import ClaudeGuidePage from "./pages/ClaudeGuidePage.tsx";
  import "./styles/index.css";

  // 개인정보처리방침/내부 강의자료는 로그인 없이 열람해야 하므로,
  // 앱의 로그인 게이트를 아예 거치지 않도록 라우팅 전에 분기한다. 메뉴/내비게이션에는 노출 안 함.
  const pathname = window.location.pathname.replace(/\/+$/, "");
  const isPrivacyPolicyPath = pathname === "/privacy-policy";
  const isClaudeGuidePath = pathname === "/claude-guide";

  // STG(스테이징) 환경에서 운영과 혼동하지 않도록 로그인 화면을 포함해 항상 최상단에 표시.
  // 파비콘도 브라우저 탭에서 바로 구분되게 캔버스로 즉석 생성해 덮어씀(별도 이미지 파일 불필요)
  const isStg = import.meta.env.VITE_APP_ENV === 'stg';
  if (isStg) {
    document.title = `[STG] ${document.title}`;
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STG', 32, 34);
      const dataUrl = canvas.toDataURL('image/png');
      document.querySelectorAll('link[rel~="icon"]').forEach(link => { (link as HTMLLinkElement).href = dataUrl; });
    }
  }

  createRoot(document.getElementById("root")!).render(
    <>
      {isStg && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          background: '#f59e0b', color: '#000', textAlign: 'center',
          fontSize: 12, fontWeight: 700, padding: '3px 0', letterSpacing: '0.05em',
        }}>
          STG 테스트 환경 — 실제 운영 데이터 아님
        </div>
      )}
      {isPrivacyPolicyPath ? <PrivacyPolicyPage /> : isClaudeGuidePath ? <ClaudeGuidePage /> : <App />}
    </>
  );
