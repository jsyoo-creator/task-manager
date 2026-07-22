// PIVOT CREATIVE 내부용 강의자료: "클로드에게 업무 시스템을 만들어달라고 요청하는 법" 실습 가이드.
// 개인정보처리방침 페이지(PrivacyPolicyPage)와 동일한 패턴 — 로그인 게이트 없이 URL로만 접근,
// 앱 메뉴/네비게이션에는 의도적으로 노출하지 않음.

const CODE_STYLE: React.CSSProperties = {
  display: 'block',
  background: '#0f172a',
  color: '#e2e8f0',
  padding: '14px 16px',
  borderRadius: 8,
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: 13.5,
  lineHeight: 1.7,
  overflowX: 'auto',
  whiteSpace: 'pre',
  margin: '10px 0 20px',
};

const INLINE_CODE_STYLE: React.CSSProperties = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  background: '#eef2f7',
  color: '#1e293b',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: '0.92em',
};

function Code({ children }: { children: string }) {
  return <code style={CODE_STYLE}>{children}</code>;
}

function IC({ children }: { children: React.ReactNode }) {
  return <code style={INLINE_CODE_STYLE}>{children}</code>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ fontSize: 21, fontWeight: 800, marginTop: 48, marginBottom: 14, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: 10 }}>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 16.5, fontWeight: 700, marginTop: 26, marginBottom: 8, color: '#1e293b' }}>{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 12, color: '#334155' }}>{children}</p>;
}

function Callout({ tone, title, children }: { tone: 'tip' | 'warn'; title: string; children: React.ReactNode }) {
  const colors = tone === 'tip'
    ? { bg: '#ecfdf5', border: '#10b981', title: '#047857' }
    : { bg: '#fffbeb', border: '#f59e0b', title: '#b45309' };
  return (
    <div style={{ background: colors.bg, borderLeft: `4px solid ${colors.border}`, borderRadius: 6, padding: '12px 16px', margin: '16px 0' }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: colors.title, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

const TOC = [
  ['prep', '0. 준비물 체크리스트'],
  ['install', '1. Claude Code 설치 & 로그인'],
  ['start', '2. 새 프로젝트 시작하기 (터미널 · Git · GitHub)'],
  ['prompt', '3. 클로드에게 요청하는 법 — 핵심 원칙 5가지'],
  ['deploy', '4. 서버/배포 세팅 (Vercel + Firebase)'],
  ['cycle', '5. 실전 사이클 — 기능 하나 만들어보기'],
  ['pitfalls', '6. 자주 하는 실수 & 팁'],
  ['checklist', '7. 요약 체크리스트'],
] as const;

export default function ClaudeGuidePage() {
  return (
    <div style={{ height: '100vh', width: '100%', background: '#f8fafc', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 120px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo", sans-serif', color: '#1f2937', lineHeight: 1.75 }}>

        <header style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: '#6366f1', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>PIVOT CREATIVE · 내부 강의자료</p>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10, color: '#0f172a' }}>클로드에게 업무 시스템을 만들어달라고 요청하는 법</h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            지금 보고 있는 이 업무 관리 툴(Task Manager)을 실제로 어떻게 만들었는지 그대로 따라 하는 실습 가이드입니다.
            · 최종 수정일: 2026-07-22
          </p>
        </header>

        <nav style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 20px', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#475569', marginBottom: 10 }}>목차</div>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            {TOC.map(([id, label]) => (
              <li key={id} style={{ marginBottom: 6 }}>
                <a href={`#${id}`} style={{ color: '#4f46e5', textDecoration: 'none', fontSize: 14 }}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <section>
          <H2 id="prep">0. 준비물 체크리스트</H2>
          <P>시작하기 전에 아래 계정/프로그램이 필요합니다. 전부 무료로 가입 가능(Claude 유료 플랜 제외).</P>
          <ul style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li>맥(macOS) 컴퓨터 — 터미널 앱 기본 내장</li>
            <li>Claude Pro/Max 계정 (Claude Code 실행에 필요) — claude.ai에서 가입</li>
            <li>GitHub 계정 (github.com) — 코드를 저장하는 곳</li>
            <li>Vercel 계정 (vercel.com) — GitHub으로 가입하면 편함, 웹사이트를 실제로 띄워주는 서버 역할</li>
            <li>Firebase(구글) 계정 — 데이터베이스·로그인 기능이 필요한 경우에만 (구글 계정 있으면 바로 가능)</li>
          </ul>
          <Callout tone="tip" title="이 가이드가 다루는 범위">
            이 문서는 지금 이 Task Manager와 같은 구조 — React + Vercel(배포) + Firebase(데이터베이스·로그인) —
            를 클로드에게 요청해서 만드는 과정을 다룹니다. 코드를 직접 작성하는 법이 아니라, <b>무엇을 준비하고 클로드에게 어떻게 말해야 하는지</b>에 집중합니다.
          </Callout>
        </section>

        <section>
          <H2 id="install">1. Claude Code 설치 &amp; 로그인</H2>
          <P>Claude Code는 터미널에서 대화하며 실제로 파일을 만들고 수정해주는 프로그램입니다. 터미널(Terminal) 앱을 열고 아래 명령어를 입력합니다.</P>
          <H3>1-1. 설치</H3>
          <Code>{`curl -fsSL https://claude.ai/install.sh | bash`}</Code>
          <P>설치가 끝나면 새 터미널 창을 열고 아래로 잘 설치됐는지 확인합니다.</P>
          <Code>{`claude --version`}</Code>
          <H3>1-2. 로그인</H3>
          <P>작업할 폴더로 이동한 뒤 <IC>claude</IC>만 입력하면 대화가 시작되고, 처음 실행 시 브라우저가 열리며 로그인 화면이 뜹니다. 로그인만 하면 끝입니다.</P>
          <Code>{`cd ~/Desktop\nclaude`}</Code>
        </section>

        <section>
          <H2 id="start">2. 새 프로젝트 시작하기 (터미널 · Git · GitHub)</H2>
          <H3>2-1. 프로젝트 폴더 만들기</H3>
          <Code>{`mkdir my-new-tool\ncd my-new-tool\ngit init`}</Code>
          <H3>2-2. GitHub 저장소 만들고 연결하기</H3>
          <P>github.com에서 New repository로 빈 저장소를 하나 만든 뒤(예: <IC>my-new-tool</IC>, Private 권장), 아래처럼 로컬 폴더와 연결합니다.</P>
          <Code>{`git remote add origin https://github.com/내계정/my-new-tool.git\ngit branch -M main`}</Code>
          <Callout tone="tip" title="이 순서가 왜 먼저인가요">
            GitHub 저장소를 미리 연결해두면, 클로드가 코드를 수정할 때마다 <IC>git push</IC>만으로 바로 배포까지 이어집니다(4번 참고).
            이 프로젝트도 <IC>jsyoo-creator/task-manager</IC> Private 저장소로 관리되고 있고, main 브랜치에 push하면 자동 배포됩니다.
          </Callout>
        </section>

        <section>
          <H2 id="prompt">3. 클로드에게 요청하는 법 — 핵심 원칙 5가지</H2>

          <H3>원칙 1. 첫 요청에는 "무엇을, 왜, 어떤 기술로" 를 담는다</H3>
          <P>기술을 몰라도 괜찮습니다. "웹사이트로, 로그인 있고, 데이터 저장되는" 정도만 말해도 클로드가 적절한 스택을 추천합니다.</P>
          <Code>{`좋은 예:
"우리 팀 내부에서 쓸 업무 관리 웹앱을 만들고 싶어.
- 로그인은 구글 계정으로, pivot-inc.com 도메인만 허용
- 업무를 등록하고 담당자를 지정할 수 있어야 함
- 팀원 전체가 같은 화면을 보고 실시간으로 업데이트되면 좋겠음
- 나중에 무료/저비용으로 계속 운영할 수 있는 방식으로 추천해줘"

아쉬운 예:
"업무 관리 앱 만들어줘"`}</Code>

          <H3>원칙 2. 한 번에 다 시키지 말고, 화면/기능 단위로 쪼갠다</H3>
          <P>큰 시스템을 한 번에 요청하면 결과를 확인하기 어렵습니다. "로그인 화면부터", "그 다음 목록 화면" 처럼 단계별로 요청하고, 매번 실제로 눈으로 확인한 뒤 다음으로 넘어갑니다.</P>

          <H3>원칙 3. 화면을 보고 있는 것처럼 구체적으로 피드백한다</H3>
          <Code>{`좋은 예: "업무 목록에서 날짜 컬럼이 헤더보다 왼쪽으로 밀려 보여. 가운데 정렬로 맞춰줘"
아쉬운 예: "레이아웃이 이상해"`}</Code>
          <P>모호하면 클로드가 먼저 "어떤 화면의 어떤 부분인지" 되물어볼 수도 있습니다 — 그럴 때 정확히 답해줄수록 헛수고가 줄어듭니다.</P>

          <H3>원칙 4. 위험한 작업(삭제·되돌리기 어려운 것)은 먼저 확인받는다</H3>
          <P>클로드에게 "실제 데이터를 지우거나 일괄로 바꾸는 작업은 먼저 몇 개만 테스트해보고, 문제없으면 진행해줘" 라고 미리 말해두면 안전합니다.</P>

          <H3>원칙 5. 수정 후 배포까지 한 번에 요청한다</H3>
          <Code>{`"수정 확인했어, 문제없으니 커밋하고 배포까지 진행해줘"`}</Code>
          <P>Git·GitHub·Vercel이 연결되어 있으면, 클로드가 커밋 후 push하는 것만으로 실제 사이트가 자동으로 업데이트됩니다.</P>
        </section>

        <section>
          <H2 id="deploy">4. 서버/배포 세팅 (Vercel + Firebase)</H2>
          <P>"서버 세팅"이라고 하면 복잡하게 느껴지지만, 이 프로젝트는 직접 서버를 관리하지 않고 아래 두 서비스에 맡기는 구조입니다.</P>

          <H3>4-1. Vercel — 웹사이트를 실제로 띄워주는 곳</H3>
          <ol style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li>vercel.com 접속 → GitHub 계정으로 로그인</li>
            <li><b>Add New → Project</b> → 방금 만든 GitHub 저장소 선택 → Import</li>
            <li>프레임워크는 자동 감지됨(Vite 등) → Deploy 클릭</li>
            <li>이후로는 GitHub의 <IC>main</IC> 브랜치에 코드가 push될 때마다 자동으로 다시 배포됩니다.</li>
          </ol>

          <H3>4-2. Firebase — 데이터베이스 + 로그인 기능</H3>
          <ol style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li>console.firebase.google.com → 프로젝트 추가</li>
            <li><b>Firestore Database</b> 생성 → 프로덕션 모드, 리전은 서울(<IC>asia-northeast3</IC>) 권장</li>
            <li><b>Authentication → Sign-in method</b>에서 Google 로그인 사용 설정</li>
            <li>프로젝트 설정 → 내 앱 → 웹 앱 추가 → 나오는 설정값(<IC>apiKey</IC>, <IC>authDomain</IC> 등 6개) 복사</li>
          </ol>

          <H3>4-3. 두 서비스 연결하기 — 환경변수 등록</H3>
          <P>4-2에서 복사한 값 6개를 Vercel 프로젝트의 <b>Settings → Environment Variables</b>에 아래 이름으로 등록합니다(이 프로젝트에서 실제로 쓰는 이름).</P>
          <Code>{`VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID`}</Code>
          <P>등록 후 Vercel에서 재배포(Redeploy)를 한 번 해줘야 반영됩니다. 로컬에서 미리보기하려면 프로젝트 루트에 <IC>.env</IC> 파일을 만들어 같은 값을 넣으면 됩니다.</P>

          <Callout tone="warn" title="보안 규칙은 별도로 설정해야 함">
            Firestore를 만들면 기본적으로 아무나 접근하지 못하도록 막혀 있습니다. Firebase 콘솔 → Firestore → 규칙(Rules)에서
            로그인한 사용자만 접근 가능하도록 최소한 아래 정도는 설정해야 합니다. 클로드에게 "Firestore 보안 규칙도 같이 알려줘/설정해줘"라고 요청하세요.
            <Code>{`allow read, write: if request.auth != null;`}</Code>
          </Callout>

          <Callout tone="warn" title="API 키·계정정보는 대화창에 그대로 붙여넣지 않기">
            Firebase 설정값은 코드/환경변수에는 필요하지만, 외부에 공유하는 문서나 캡처에는 그대로 노출하지 않는 것이 좋습니다.
            회사 보안정책상 계정·결제·API 키 등은 산출물에 포함하지 않는 것이 원칙입니다.
          </Callout>
        </section>

        <section>
          <H2 id="cycle">5. 실전 사이클 — 기능 하나 만들어보기</H2>
          <P>예를 들어 "휴가 신청 화면"을 새로 추가한다면, 실제로는 아래 순서로 진행됩니다.</P>
          <ol style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li><b>요청:</b> "팀원이 휴가를 신청하고, 관리자가 승인/반려할 수 있는 화면을 새로 만들어줘. 신청 시 날짜와 사유를 입력받고, 목록에서 상태(대기/승인/반려)를 볼 수 있으면 좋겠어."</li>
            <li><b>확인:</b> 클로드가 화면을 만들면, 직접 브라우저에서 신청 → 승인 흐름을 눌러보며 확인한다.</li>
            <li><b>피드백:</b> "승인 버튼은 관리자한테만 보여야 해" 처럼 구체적으로 지적한다.</li>
            <li><b>반복:</b> 문제없을 때까지 2~3번을 반복한다.</li>
            <li><b>배포 요청:</b> "확인 끝났어, 커밋하고 배포해줘" → 실제 서비스 주소(Vercel URL)가 자동으로 업데이트된다.</li>
          </ol>
          <Callout tone="tip" title="이 프로젝트에서 실제로 있었던 예">
            "지원팀" 개념을 추가할 때도 이런 순서로 진행됐습니다 — 먼저 "다른 팀 업무를 지원팀이 요청해서 가져올 수 있게 해줘"라고 큰 그림을 요청하고,
            화면이 나온 뒤 "지원팀 위클리에는 보이는데 원래 팀 위클리에서는 안 빠진다"처럼 실제 사용해보며 나온 문제를 하나씩 짚어 여러 차례 다듬었습니다.
          </Callout>
        </section>

        <section>
          <H2 id="pitfalls">6. 자주 하는 실수 &amp; 팁</H2>
          <ul style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li><b>"이상해요"로만 말하기</b> — 어떤 화면, 어떤 항목이 어떻게 다른지(원하는 모습까지) 구체적으로 말할수록 빠르게 해결됩니다.</li>
            <li><b>큰 기능을 한 번에 다 요청하기</b> — 화면 단위/기능 단위로 쪼개고, 매번 실제로 확인한 뒤 다음으로 넘어가세요.</li>
            <li><b>환경변수 등록을 잊고 "안 된다"고 하기</b> — Firebase 연동 기능이 안 되면 십중팔구 Vercel 환경변수 미등록 또는 재배포 누락입니다.</li>
            <li><b>실데이터를 다루는 일괄 작업을 바로 실행시키기</b> — 항상 "몇 개만 먼저 테스트해봐줘"라고 요청한 뒤 결과를 보고 전체 실행을 맡기세요.</li>
            <li><b>"중앙/가운데"처럼 애매할 수 있는 표현</b> — 화면 예시(스크린샷)나 "이렇게 생기면 돼"처럼 그림으로 보여주면 오해가 줄어듭니다.</li>
          </ul>
        </section>

        <section>
          <H2 id="checklist">7. 요약 체크리스트</H2>
          <ul style={{ paddingLeft: 20, marginBottom: 8, color: '#334155' }}>
            <li>☐ Claude Pro/Max, GitHub, Vercel, Firebase(구글) 계정 준비</li>
            <li>☐ <IC>curl -fsSL https://claude.ai/install.sh | bash</IC>로 Claude Code 설치</li>
            <li>☐ 프로젝트 폴더 생성 → <IC>git init</IC> → GitHub 저장소 연결</li>
            <li>☐ 클로드에게 "무엇을, 왜, 어떤 방식으로"를 담아 첫 요청</li>
            <li>☐ 화면/기능 단위로 요청 → 직접 확인 → 구체적으로 피드백 → 반복</li>
            <li>☐ Vercel에 GitHub 저장소 Import → 자동 배포 연결</li>
            <li>☐ (필요시) Firebase 프로젝트 생성 → Firestore/Auth 설정 → Vercel 환경변수 등록</li>
            <li>☐ 확인 끝나면 "커밋하고 배포해줘"로 마무리</li>
          </ul>
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '48px 0 24px' }} />
        <p style={{ fontSize: 12.5, color: '#94a3b8' }}>PIVOT CREATIVE 내부 교육용 자료 · 문의: js.yoo@pivot-inc.com</p>
      </div>
    </div>
  );
}
