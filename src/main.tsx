
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.tsx";
  import "./styles/index.css";

  // 개인정보처리방침은 로그인 없이 외부(Pinterest API 심사 등)에서 열람해야 하므로,
  // 앱의 로그인 게이트를 아예 거치지 않도록 라우팅 전에 분기한다. 메뉴/내비게이션에는 노출 안 함.
  const isPrivacyPolicyPath = window.location.pathname.replace(/\/+$/, "") === "/privacy-policy";

  createRoot(document.getElementById("root")!).render(
    isPrivacyPolicyPath ? <PrivacyPolicyPage /> : <App />
  );
