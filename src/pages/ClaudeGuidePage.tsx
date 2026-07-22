// PIVOT CREATIVE 내부용 강의자료: "클로드에게 업무 시스템을 만들어달라고 요청하는 법" 실습 가이드.
// 개인정보처리방침 페이지(PrivacyPolicyPage)와 동일한 패턴 — 로그인 게이트 없이 URL로만 접근,
// 앱 메뉴/네비게이션에는 의도적으로 노출하지 않음.

import { useState } from 'react';

type Method = 'app' | 'cli';

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

// 소통 오류 사례 카드: 상황(사용자가 한 말) → 오해(클로드가 처음에 이해한 것) → 실제 의도 → 해결 방법
function CaseStudy({ n, title, said, misread, actual, fix }: {
  n: number; title: string; said: string; misread: string; actual: string; fix: React.ReactNode;
}) {
  const rowStyle: React.CSSProperties = { display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' };
  const tagStyle = (bg: string, color: string): React.CSSProperties => ({
    flexShrink: 0, fontSize: 11.5, fontWeight: 700, color, background: bg,
    borderRadius: 5, padding: '3px 8px', marginTop: 1, whiteSpace: 'nowrap',
  });
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 22px', marginBottom: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>사례 {n}. {title}</div>
      <div style={rowStyle}>
        <span style={tagStyle('#eef2ff', '#4338ca')}>사용자가 한 말</span>
        <span style={{ fontSize: 14, color: '#334155' }}>"{said}"</span>
      </div>
      <div style={rowStyle}>
        <span style={tagStyle('#fef2f2', '#b91c1c')}>처음 오해</span>
        <span style={{ fontSize: 14, color: '#334155' }}>{misread}</span>
      </div>
      <div style={rowStyle}>
        <span style={tagStyle('#ecfdf5', '#047857')}>실제 의도</span>
        <span style={{ fontSize: 14, color: '#334155' }}>{actual}</span>
      </div>
      <div style={{ ...rowStyle, marginBottom: 0, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
        <span style={tagStyle('#f5f3ff', '#6d28d9')}>어떻게 풀었나</span>
        <span style={{ fontSize: 14, color: '#334155' }}>{fix}</span>
      </div>
    </div>
  );
}

function CompareTable() {
  const rows: [string, string, string][] = [
    ['설치', '터미널에 명령어 한 줄', '앱 다운로드 후 더블클릭'],
    ['화면', '텍스트만 오가는 검은 창', '채팅창 + 파일 미리보기 + diff 화면이 한 창에'],
    ['변경 승인', '터미널에 "y/n"으로 답하거나 설정으로 자동 승인', '파일별로 "수락/거절" 버튼 클릭 (변경 전/후 비교 화면 제공)'],
    ['여러 작업 동시 진행', '터미널 창을 여러 개 띄워야 함', '사이드바에서 세션(작업) 여러 개를 나란히 관리'],
    ['추천 대상', '터미널이 익숙하거나 자동화(스크립트)를 많이 쓸 사람', '터미널이 낯설고, 눈으로 변경 내용을 확인하며 진행하고 싶은 사람'],
  ];
  return (
    <div style={{ overflowX: 'auto', margin: '14px 0 20px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ textAlign: 'left', padding: '9px 12px', fontWeight: 700, color: '#475569', border: '1px solid #e2e8f0' }}>구분</th>
            <th style={{ textAlign: 'left', padding: '9px 12px', fontWeight: 700, color: '#475569', border: '1px solid #e2e8f0' }}>터미널(CLI)</th>
            <th style={{ textAlign: 'left', padding: '9px 12px', fontWeight: 700, color: '#475569', border: '1px solid #e2e8f0' }}>데스크탑 앱</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a}>
              <td style={{ padding: '9px 12px', border: '1px solid #e2e8f0', fontWeight: 600, color: '#1e293b' }}>{a}</td>
              <td style={{ padding: '9px 12px', border: '1px solid #e2e8f0', color: '#334155' }}>{b}</td>
              <td style={{ padding: '9px 12px', border: '1px solid #e2e8f0', color: '#334155' }}>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 진행 방식(데스크탑 앱/터미널)에 따라 내용이 갈리는 곳에서 선택된 방식의 콘텐츠만 보여줌
function MethodOnly({ current, when, children }: { current: Method; when: Method; children: React.ReactNode }) {
  if (current !== when) return null;
  return <>{children}</>;
}

function MethodTabs({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  const tabs: { id: Method; label: string }[] = [
    { id: 'app', label: '🖥️ 데스크탑 앱으로 진행' },
    { id: 'cli', label: '⌨️ 터미널로 진행' },
  ];
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', paddingTop: 4, paddingBottom: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 5, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              background: method === t.id ? '#4f46e5' : 'transparent',
              color: method === t.id ? '#fff' : '#64748b',
              transition: 'background .15s, color .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
        아래 <b>1. 시작하는 방법</b>과 <b>2. 새 프로젝트 시작하기</b>의 설치/실행 안내가 선택한 방식에 맞춰 바뀝니다. 나머지 내용은 두 방식 모두 동일합니다.
      </p>
    </div>
  );
}

const TOC = [
  ['prep', '0. 준비물 체크리스트'],
  ['ways', '1. 시작하는 두 가지 방법 — 터미널 vs 데스크탑 앱'],
  ['start', '2. 새 프로젝트 시작하기 (Git · GitHub)'],
  ['understand', '3. 클로드가 내 말을 "정확히" 알아듣게 하는 법'],
  ['cases', '4. 실제 있었던 소통 오류 4가지 — 어떻게 풀렸나'],
  ['debug', '5. 버그를 찾는 법 (실전 디버깅 노하우)'],
  ['deploy', '6. 서버/배포 세팅 (Vercel + Firebase)'],
  ['cycle', '7. 실전 사이클 — 기능 하나 만들어보기'],
  ['pitfalls', '8. 자주 하는 실수 & 팁'],
  ['checklist', '9. 요약 체크리스트'],
] as const;

export default function ClaudeGuidePage() {
  const [method, setMethod] = useState<Method>('app');
  return (
    <div style={{ height: '100vh', width: '100%', background: '#f8fafc', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 120px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo", sans-serif', color: '#1f2937', lineHeight: 1.75 }}>

        <header style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: '#6366f1', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>PIVOT CREATIVE · 내부 강의자료</p>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10, color: '#0f172a' }}>클로드에게 업무 시스템을 만들어달라고 요청하는 법</h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            지금 보고 있는 이 업무 관리 툴(Task Manager)을 실제로 어떻게 만들었는지, 그 과정에서 있었던 소통 오류와 버그를 어떻게 풀었는지까지 담은 실습 가이드입니다.
            · 최종 수정일: 2026-07-22
          </p>
        </header>

        <MethodTabs method={method} onChange={setMethod} />

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
            <li>맥(macOS) 또는 윈도우 컴퓨터</li>
            <li>Claude Pro/Max 계정 (Claude Code 실행에 필요) — claude.ai에서 가입</li>
            <li>GitHub 계정 (github.com) — 코드를 저장하는 곳</li>
            <li>Vercel 계정 (vercel.com) — GitHub으로 가입하면 편함, 웹사이트를 실제로 띄워주는 서버 역할</li>
            <li>Firebase(구글) 계정 — 데이터베이스·로그인 기능이 필요한 경우에만 (구글 계정 있으면 바로 가능)</li>
          </ul>
          <Callout tone="tip" title="이 가이드가 다루는 범위">
            이 문서는 지금 이 Task Manager와 같은 구조 — React + Vercel(배포) + Firebase(데이터베이스·로그인) —
            를 클로드에게 요청해서 만드는 과정을 다룹니다. 코드를 직접 작성하는 법이 아니라, <b>무엇을 준비하고, 클로드에게 어떻게 말해야 오해 없이 전달되는지, 문제가 생겼을 때 어떻게 찾는지</b>에 집중합니다.
          </Callout>
        </section>

        <section>
          <H2 id="ways">1. 시작하는 두 가지 방법 — 터미널 vs 데스크탑 앱</H2>
          <P>클로드에게 코드를 직접 만들고 고쳐달라고 요청하는 프로그램이 "Claude Code"입니다. 두 가지 방식으로 쓸 수 있습니다 — 위 탭에서 원하는 방식을 선택하면 아래 안내가 그에 맞춰 바뀝니다.</P>
          <CompareTable />

          <MethodOnly current={method} when="cli">
            <H3>터미널(CLI) 방식 설치</H3>
            <P>터미널 앱을 열고 아래 명령어를 입력합니다.</P>
            <Code>{`curl -fsSL https://claude.ai/install.sh | bash`}</Code>
            <P>설치가 끝나면 새 터미널 창을 열고 잘 설치됐는지 확인합니다.</P>
            <Code>{`claude --version`}</Code>
            <P>작업할 폴더로 이동한 뒤 <IC>claude</IC>만 입력하면 대화가 시작되고, 처음 실행 시 브라우저가 열리며 로그인 화면이 뜹니다.</P>
            <Code>{`cd ~/Desktop/my-new-tool\nclaude`}</Code>
            <Callout tone="tip" title="터미널을 쓰다가 앱으로 바꿔도 됨">
              두 방식은 같은 엔진을 쓰고 설정(로그인, 프로젝트 규칙 등)도 공유합니다. 반복 작업이나 자동화가 필요할 때 터미널을, 평소엔 앱으로 눈으로 확인하며 진행하는 식으로 섞어 써도 문제없습니다.
            </Callout>
          </MethodOnly>

          <MethodOnly current={method} when="app">
            <H3>데스크탑 앱 설치 &amp; 사용법 (터미널 없이)</H3>
            <ol style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
              <li>claude.ai에서 데스크탑 앱을 다운로드해 설치 (Mac/Windows/Linux 모두 지원) 후 실행, 계정으로 로그인</li>
              <li>상단 가운데의 <b>Code</b> 탭 클릭 (유료 플랜 가입 안내가 뜨면 먼저 구독)</li>
              <li><b>Local</b> 선택 → <b>Select folder</b>로 작업할 프로젝트 폴더 선택 (윈도우는 Git 설치가 필요, 맥은 대부분 기본 내장)</li>
              <li>화면 하단 채팅창에 원하는 작업을 문장으로 입력 (예: "업무 등록 화면에 마감일 필드를 추가해줘")</li>
              <li>클로드가 수정한 내용이 <b>변경 전/후 비교 화면(diff)</b>으로 뜨면, 파일별로 <b>수락(Accept)</b>/<b>거절(Reject)</b> 버튼으로 확인하며 진행</li>
            </ol>
            <Callout tone="tip" title="권한 모드(자동 승인 여부)">
              데스크탑 앱은 기본적으로 <b>Manual</b> 모드라 파일을 고칠 때마다 승인을 받습니다. 익숙해지면 <b>Accept edits</b>(자동 승인) 모드로 바꿔 속도를 낼 수 있고,
              큰 변경 전에는 <b>Plan</b> 모드(코드는 안 고치고 계획만 먼저 보여줌)로 방향부터 확인하는 것도 유용합니다.
            </Callout>
            <Callout tone="tip" title="필요할 때는 터미널도 같이 쓸 수 있음">
              두 방식은 같은 엔진을 쓰고 설정을 공유합니다. 나중에 반복 작업·자동화가 필요해지면 터미널(CLI)도 병행할 수 있습니다.
            </Callout>
          </MethodOnly>
        </section>

        <section>
          <H2 id="start">2. 새 프로젝트 시작하기 (Git · GitHub)</H2>

          <MethodOnly current={method} when="cli">
            <H3>2-1. 프로젝트 폴더 만들기 (터미널)</H3>
            <Code>{`mkdir my-new-tool\ncd my-new-tool\ngit init`}</Code>
            <H3>2-2. GitHub 저장소 만들고 연결하기</H3>
            <P>github.com에서 New repository로 빈 저장소를 하나 만든 뒤(예: <IC>my-new-tool</IC>, Private 권장), 아래처럼 로컬 폴더와 연결합니다.</P>
            <Code>{`git remote add origin https://github.com/내계정/my-new-tool.git\ngit branch -M main`}</Code>
          </MethodOnly>

          <MethodOnly current={method} when="app">
            <H3>2-1. 프로젝트 폴더 만들기 (데스크탑 앱)</H3>
            <P>Finder(맥) 또는 탐색기(윈도우)에서 새 폴더를 만든 뒤, 앱의 <b>Select folder</b>에서 그 폴더를 선택합니다. 그 다음 채팅창에 이렇게 요청하면 됩니다.</P>
            <Code>{`"이 폴더에 새 프로젝트를 시작해줘, git도 초기화해줘"`}</Code>
            <H3>2-2. GitHub 저장소 만들고 연결하기</H3>
            <P>github.com에서 New repository로 빈 저장소를 하나 만든 뒤(예: <IC>my-new-tool</IC>, Private 권장), 채팅창에 아래처럼 요청합니다.</P>
            <Code>{`"GitHub 저장소를 만들었어. 주소는 https://github.com/내계정/my-new-tool.git 이야, 이 프로젝트랑 연결해줘"`}</Code>
          </MethodOnly>

          <Callout tone="tip" title="이 순서가 왜 먼저인가요">
            GitHub 저장소를 미리 연결해두면, 클로드가 코드를 수정할 때마다 <IC>git push</IC>만으로 바로 배포까지 이어집니다(6번 참고).
            이 프로젝트도 <IC>jsyoo-creator/task-manager</IC> Private 저장소로 관리되고 있고, main 브랜치에 push하면 자동 배포됩니다.
          </Callout>
        </section>

        <section>
          <H2 id="understand">3. 클로드가 내 말을 "정확히" 알아듣게 하는 법</H2>
          <P>클로드는 화면을 항상 보고 있는 게 아니라, 사용자가 입력한 <b>텍스트(그리고 첨부한 스크린샷)</b>만으로 상황을 판단합니다. 그래서 사람끼리 대화할 때는 안 생기는 오해가 종종 생깁니다 — 아래는 오해를 줄이는 구체적인 방법입니다.</P>

          <H3>3-1. "어디"를 항상 구체적으로 지칭한다</H3>
          <P>어떤 화면(페이지 이름), 어떤 항목(컬럼/버튼/필드 이름)인지 콕 집어 말합니다. 이 앱을 예로 들면:</P>
          <Code>{`좋은 예: "설정 > 엑셀 관리 탭에서, 복지몰 파트로 전환했을 때 필드 목록이 이상해"
아쉬운 예: "그 화면에서 항목이 이상해"`}</Code>

          <H3>3-2. 스크린샷을 첨부하고, "이 부분"이라고 짚어준다</H3>
          <P>말로 설명하기 애매한 레이아웃·색상·정렬 문제는 스크린샷 한 장이 문장 열 줄보다 정확합니다. 실제로 이 프로젝트에서도 스크린샷 없이 말로만 설명하다 여러 차례 오해가 생겼고, 스크린샷을 첨부한 뒤에야 바로 원인을 찾은 사례가 많았습니다(4번 사례 참고).</P>

          <H3>3-3. "무엇이 어떻게" 다른지 — 현재 상태와 원하는 상태를 같이 말한다</H3>
          <Code>{`좋은 예: "지금은 A만 나오는데, B도 같이 나왔으면 좋겠어"
아쉬운 예: "이상해", "저렇게 말고"`}</Code>

          <H3>3-4. 모호할 수 있는 단어는 한 번 더 풀어서 말한다</H3>
          <P>"중앙", "가운데", "이상하다", "불편하다", "~처럼" 같은 표현은 사람마다, 상황마다 다르게 해석될 수 있습니다. 가능하면 "왼쪽 정렬 말고 텍스트 자체가 칸 가운데에 오게"처럼 결과물을 그림 그리듯 설명하세요.</P>

          <H3>3-5. 클로드가 되묻거나 선택지를 주면, 정확하게 답한다</H3>
          <P>애매한 요청에는 클로드가 먼저 "어떤 화면 말씀이신가요?", "이 중 어떤 방식을 원하시나요?" 처럼 되묻거나 선택지를 보여줄 수 있습니다. 이때 대충 아무거나 고르지 말고, 실제로 원하는 것과 정확히 일치하는지 확인하고 답하세요 — 여기서 잘못 고르면 오히려 반대 결과가 나올 수 있습니다(사례 4 참고).</P>

          <H3>3-6. 큰 작업 전에는 먼저 "이렇게 할 건데 맞아?"를 확인받는다</H3>
          <P>화면 구조나 데이터가 걸린 큰 변경은, 클로드에게 "코드부터 바로 고치지 말고, 어떻게 할 건지 방향부터 먼저 설명해줘"라고 요청하면 헛수고를 크게 줄일 수 있습니다.</P>
        </section>

        <section>
          <H2 id="cases">4. 실제 있었던 소통 오류 4가지 — 어떻게 풀렸나</H2>
          <P>아래는 이 Task Manager를 만들면서 실제로 있었던 오해와, 그게 어떻게 바로잡혔는지를 정리한 사례입니다. 완벽하게 설명해도 오해가 생길 수 있다는 것, 그리고 오해가 생겼을 때 어떻게 바로잡는지가 더 중요하다는 것을 보여줍니다.</P>

          <CaseStudy
            n={1}
            title={'"가운데(중앙)"의 의미'}
            said="다른 팀은 중앙에 잘 있는데, 이 팀은 왜 이래?"
            misread="처음엔 '헤더와 값의 시작 위치(좌측 여백)를 맞춰달라'는 뜻으로 여러 차례 좌측 정렬 기준만 조정함"
            actual="실제로는 텍스트/값 자체가 칸의 정중앙(text-align: center)에 오길 원한 것"
            fix={<>사용자가 "시작일이 어딜 봐서 날짜 중앙에 있다는거야?"라고 명확히 반박한 뒤에야 진짜 의도를 확인함. 이후로는 <b>"중앙/가운데"</b>라는 단어가 나오면 절대 임의로 해석하지 않고, 화면 구조를 그림(ASCII 프리뷰)으로 먼저 보여주며 "좌측 정렬 유지 vs 가운데 정렬" 중 확정하고 시작하는 습관으로 바뀜.</>}
          />

          <CaseStudy
            n={2}
            title='"~에서도 보이게 해줘"가 "복사"인지 "이동"인지'
            said="다른 팀 업무를 지원팀 화면에서도 보이게 해줘"
            misread="지원팀 화면에 추가로 노출(중복 허용) — 원본 팀 화면에는 그대로 두고 지원팀 화면에도 같이 보여주는 방식으로 구현"
            actual="지원팀으로 옮겨서(귀속), 원본 팀 화면에서는 더 이상 보이지 않아야 함 — 중복이 아니라 '전용으로 배정'하는 의미였음"
            fix={<>"내가 우선 표시한 지원팀에만 나와야 한다니까"라는 재지적을 받은 뒤 원본 팀 화면에서 해당 항목을 제외하도록 다시 수정함. 이후로는 <b>"~에서도 보이게"</b> 같은 요청을 받으면 "추가로 노출"과 "옮겨서 귀속"의 가능성을 먼저 구분해 확인함.</>}
          />

          <CaseStudy
            n={3}
            title='"스크롤하기 불편해"가 가리키는 것'
            said="여기 너무 좁아서 좌우로 스크롤하기 힘들어"
            misread="스크롤바(마우스로 잡는 막대) 자체가 얇아서 잡기 힘들다는 뜻으로 이해해, 스크롤바 두께만 두껍게 수정"
            actual="스크롤이 일어나는 콘텐츠 영역 자체의 세로 크기(패딩/높이)가 좁아서 답답하다는 뜻 — 스크롤바 두께 문제가 아니었음"
            fix={<>실제 요청(영역 크기 확대)을 구현한 뒤에도, 오해로 만든 "두꺼운 스크롤바"를 그냥 남겨뒀다가 "그 스크롤 두껍다니까 왜 유지하냐"는 재지적을 받고서야 제거함. 교훈: 오해로 만든 변경은 진짜 요청을 구현했다고 해서 그냥 두지 말고, 명시적으로 유지해달라는 말이 없다면 원칙적으로 함께 되돌릴 것.</>}
          />

          <CaseStudy
            n={4}
            title='"A처럼 B도 중앙에" — 되물어서 확인했는데도 반대였던 경우'
            said="체크박스/드래그처럼 '월'도 중앙에 오게 해줘"
            misread="선택지를 만들어 되물은 뒤(AskUserQuestion), '월을 체크박스·드래그가 있는 1번째 줄 기준에 맞춘다'는 옵션을 추천해 사용자가 선택 — 그런데 그 결과 원래 잘 되어 있던 체크박스/드래그의 정렬까지 함께 깨짐"
            actual="'월이 체크박스·드래그와 같은 정렬 그룹(세로 중앙 고정 레일)으로 옮겨가야 한다'는 뜻이었음 — 기존에 잘 동작하던 체크박스/드래그 정렬은 그대로 두고 월만 그쪽으로 옮기는 것이 정답"
            fix={<>한 번 확인 질문을 거쳐도 결과가 사용자 의도와 반대일 수 있다는 걸 보여준 사례. "원래 잘 동작하던 상태"를 기준선으로 삼아, 그 기준선을 최대한 보존하는 방향으로 재해석해 해결함. 교훈: 확인 질문에서 고른 답이 실제 결과에서 다시 반박당하면, "추천 옵션 자체가 반대 방향이었을 가능성"부터 의심할 것.</>}
          />

          <Callout tone="tip" title="공통 교훈">
            네 사례 모두 처음부터 완벽하게 통하지 않았습니다. 중요한 건 처음에 완벽히 설명하는 것보다, <b>"어? 그게 아니라"</b>는 피드백이 왔을 때 지금까지의 해석을 버리고 새로 확인하는 태도입니다.
            특히 사용자가 명확하게 반박하면(“어딜 봐서 그게 중앙이야” 같은), 그건 거의 항상 이전 해석이 틀렸다는 신호입니다.
          </Callout>
        </section>

        <section>
          <H2 id="debug">5. 버그를 찾는 법 (실전 디버깅 노하우)</H2>
          <P>기능이 이상하게 동작할 때, 클로드는 아래와 같은 순서로 원인을 좁혀갑니다. 사용자가 이 흐름을 알고 협조하면 훨씬 빨리 해결됩니다.</P>

          <H3>5-1. "재현 경로"를 있는 그대로 믿고 그 경로부터 추적한다</H3>
          <P>사용자가 "이렇게 하니까 이런 문제가 생겨"라고 설명하면, 그 설명을 캐시나 오래된 데이터 탓으로 넘겨짚지 않고 <b>사용자가 말한 정확한 순서 그대로</b> 코드를 따라가며 원인을 찾습니다. 실제로 이 방식을 벗어나 "아마 캐시 문제일 것"이라고 지레짐작했다가 헛수고한 적이 있어서, 지금은 사용자의 재현 경위를 최우선으로 신뢰하고 따라갑니다.</P>

          <H3>5-2. 정상 동작하는 "비슷한 다른 화면"과 코드를 비교한다</H3>
          <P>같은 종류의 기능이 화면 A에서는 되고 화면 B에서는 안 되면, A가 참조하는 코드 패턴을 grep(검색)해서 B와 정확히 뭐가 다른지 비교합니다.</P>
          <Callout tone="tip" title="실제 사례 (오늘 있었던 일)">
            "엑셀 관리" 탭에서 파트별 설정을 잘못 가져오는 버그가 있었는데, 같은 화면 안의 "중복 체크 기준" 섹션은 같은 파트 데이터를 정상적으로 가져오고 있었습니다.
            정상 동작하는 코드가 <IC>{'currentPart?.metaFields ?? team.metaFields'}</IC> 형태로 파트 값을 먼저 확인하는 걸 확인하고, 문제가 있던 코드를 검색해보니 그 부분만 파트 값 확인 없이 팀 전체 값만 쓰고 있던 게 원인이었습니다. "다른 곳은 되는데 여기만 안 된다"는 단서가 원인을 빠르게 좁혀줬습니다.
          </Callout>

          <H3>5-3. 데이터베이스를 직접 볼 수 없을 때 — 임시 진단 로그를 활용한다</H3>
          <P>이 프로젝트는 서버 쪽에서 데이터베이스(Firestore)를 직접 조회할 권한이 없어서, 코드에서만 원인을 추정할 수 있습니다. 실제로 몇 건이 영향을 받았는지 확인해야 할 때는:</P>
          <ol style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li>확인하려는 내용을 화면에 임시로 <IC>console.log</IC>/<IC>console.table</IC>로 출력하는 코드를 추가</li>
            <li>배포한 뒤, 사용자에게 해당 화면을 열고 브라우저 개발자 도구(콘솔)를 열어달라고 요청</li>
            <li>콘솔에 찍힌 내용을 그대로 복사해서 전달받아 분석</li>
            <li>확인이 끝나면 <b>반드시</b> 이 임시 코드를 제거하고 재배포</li>
          </ol>
          <P>실제로 위 5-2의 엑셀 관리 버그를 고친 뒤, "전체 팀 중 몇 개 파트가 실제로 영향을 받았는지" 확인할 때 이 방법을 써서 17개 파트 중 8개 파트가 영향받았다는 걸 바로 확인할 수 있었습니다.</P>

          <H3>5-4. 화면/레이아웃 버그는 "무엇이 어떻게 잘못됐는지" 스크린샷으로 먼저 재확인한다</H3>
          <P>색상이 이상하다, 정렬이 안 맞는다 같은 신고는 사람마다 표현이 달라 오해가 쉽습니다(사례 1, 3 참고). 코드를 고치기 전에 스크린샷으로 "정확히 무엇이 잘못됐는지"부터 짚고 시작하면 시행착오가 크게 줄어듭니다.</P>

          <H3>5-5. "코드 버그"인지 "데이터 자체의 문제"인지 구분한다</H3>
          <P>가끔은 코드가 정상인데 실제 저장된 데이터가 잘못 입력되어 있어서 이상하게 보이는 경우도 있습니다. 코드를 다 뒤져도 원인이 안 보이면, "혹시 이 값 자체가 잘못 저장된 건 아닌지" 데이터 쪽도 의심해볼 필요가 있습니다.</P>

          <Callout tone="tip" title="사용자가 협조하면 좋은 것">
            버그를 빠르게 찾으려면 (1) 정확한 재현 경로(어떤 화면에서 무엇을 눌렀더니), (2) 가능하면 스크린샷, (3) 콘솔 로그를 요청받으면 그대로 복사해서 전달, 이 세 가지가 가장 큰 도움이 됩니다.
          </Callout>
        </section>

        <section>
          <H2 id="deploy">6. 서버/배포 세팅 (Vercel + Firebase)</H2>
          <P>"서버 세팅"이라고 하면 복잡하게 느껴지지만, 이 프로젝트는 직접 서버를 관리하지 않고 아래 두 서비스에 맡기는 구조입니다.</P>

          <H3>6-1. Vercel — 웹사이트를 실제로 띄워주는 곳</H3>
          <ol style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li>vercel.com 접속 → GitHub 계정으로 로그인</li>
            <li><b>Add New → Project</b> → 방금 만든 GitHub 저장소 선택 → Import</li>
            <li>프레임워크는 자동 감지됨(Vite 등) → Deploy 클릭</li>
            <li>이후로는 GitHub의 <IC>main</IC> 브랜치에 코드가 push될 때마다 자동으로 다시 배포됩니다.</li>
          </ol>

          <H3>6-2. Firebase — 데이터베이스 + 로그인 기능</H3>
          <ol style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li>console.firebase.google.com → 프로젝트 추가</li>
            <li><b>Firestore Database</b> 생성 → 프로덕션 모드, 리전은 서울(<IC>asia-northeast3</IC>) 권장</li>
            <li><b>Authentication → Sign-in method</b>에서 Google 로그인 사용 설정</li>
            <li>프로젝트 설정 → 내 앱 → 웹 앱 추가 → 나오는 설정값(<IC>apiKey</IC>, <IC>authDomain</IC> 등 6개) 복사</li>
          </ol>

          <H3>6-3. 두 서비스 연결하기 — 환경변수 등록</H3>
          <P>6-2에서 복사한 값 6개를 Vercel 프로젝트의 <b>Settings → Environment Variables</b>에 아래 이름으로 등록합니다(이 프로젝트에서 실제로 쓰는 이름).</P>
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
          <H2 id="cycle">7. 실전 사이클 — 기능 하나 만들어보기</H2>
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
            화면이 나온 뒤 실제 사용해보며 나온 문제(사례 2 참고)를 하나씩 짚어 여러 차례 다듬었습니다.
          </Callout>
        </section>

        <section>
          <H2 id="pitfalls">8. 자주 하는 실수 &amp; 팁</H2>
          <ul style={{ paddingLeft: 20, marginBottom: 16, color: '#334155' }}>
            <li><b>"이상해요"로만 말하기</b> — 어떤 화면, 어떤 항목이 어떻게 다른지(원하는 모습까지) 구체적으로 말할수록 빠르게 해결됩니다.</li>
            <li><b>큰 기능을 한 번에 다 요청하기</b> — 화면 단위/기능 단위로 쪼개고, 매번 실제로 확인한 뒤 다음으로 넘어가세요.</li>
            <li><b>환경변수 등록을 잊고 "안 된다"고 하기</b> — Firebase 연동 기능이 안 되면 십중팔구 Vercel 환경변수 미등록 또는 재배포 누락입니다.</li>
            <li><b>실데이터를 다루는 일괄 작업을 바로 실행시키기</b> — 항상 "몇 개만 먼저 테스트해봐줘"라고 요청한 뒤 결과를 보고 전체 실행을 맡기세요.</li>
            <li><b>"중앙/가운데"처럼 애매할 수 있는 표현</b> — 화면 예시(스크린샷)나 "이렇게 생기면 돼"처럼 그림으로 보여주면 오해가 줄어듭니다.</li>
            <li><b>확인 질문에서 고른 답이 이상해도 그냥 넘어가기</b> — 되물어서 나온 결과가 기대와 다르면 바로 지적하세요. 한 번 확인했다고 항상 맞는 건 아닙니다(사례 4).</li>
          </ul>
        </section>

        <section>
          <H2 id="checklist">9. 요약 체크리스트</H2>
          <ul style={{ paddingLeft: 20, marginBottom: 8, color: '#334155' }}>
            <li>☐ Claude Pro/Max, GitHub, Vercel, Firebase(구글) 계정 준비</li>
            <li>☐ 위 탭에서 방식 선택 후 Claude Code 설치 (데스크탑 앱 또는 터미널)</li>
            <li>☐ 프로젝트 폴더 생성 → <IC>git init</IC> → GitHub 저장소 연결</li>
            <li>☐ 요청할 때 "어디서, 무엇이, 어떻게" 다른지 구체적으로 + 애매하면 스크린샷 첨부</li>
            <li>☐ 화면/기능 단위로 요청 → 직접 확인 → 구체적으로 피드백 → 반복</li>
            <li>☐ 문제가 생기면 재현 경로 + 스크린샷 + (요청받으면) 콘솔 로그를 그대로 전달</li>
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
