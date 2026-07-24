
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
  // 파비콘은 운영 아이콘과 동일한 모양을 유지한 채, hue 블렌드로 색상만 노란 계열로 바꿔치기한다.
  const isStg = import.meta.env.VITE_APP_ENV === 'stg';
  const STG_BANNER_HEIGHT = 22;
  if (isStg) {
    document.title = `[STG] ${document.title}`;
    document.documentElement.style.setProperty('--stg-banner-h', `${STG_BANNER_HEIGHT}px`);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      ctx.globalCompositeOperation = 'hue';
      ctx.fillStyle = '#f5a300';
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(img, 0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
      const dataUrl = canvas.toDataURL('image/png');
      document.querySelectorAll('link[rel~="icon"]').forEach(link => { (link as HTMLLinkElement).href = dataUrl; });
    };
    img.src = '/favicon.png';
  }

  createRoot(document.getElementById("root")!).render(
    <>
      {isStg && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          height: STG_BANNER_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f59e0b', color: '#000', textAlign: 'center',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
        }}>
          STG 테스트 환경 — 실제 운영 데이터 아님
        </div>
      )}
      {isPrivacyPolicyPath ? <PrivacyPolicyPage /> : isClaudeGuidePath ? <ClaudeGuidePage /> : <App />}
    </>
  );
