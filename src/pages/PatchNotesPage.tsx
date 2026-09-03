// PIVOT CREATIVE 내부 공유용 패치노트. PrivacyPolicyPage/ClaudeGuidePage와 동일한 패턴 —
// 로그인 게이트 없이 URL로만 접근, 앱 메뉴/네비게이션에는 의도적으로 노출하지 않음.
// 내용은 새 패치가 나올 때마다 이 파일의 DAYS 배열에 항목을 추가해 갱신한다(최신이 배열 앞쪽).

type ItemType = '기능추가' | '버그수정' | 'UI개선';

interface PatchItem {
  type: ItemType;
  title: string;
  desc: React.ReactNode;
  hashes: string[];
}

interface RetryStep {
  label: string;
  why: string;
  hash: string;
  final?: boolean;
}

interface DayEntry {
  date: string;
  story?: { title: string; type: ItemType; intro: string; steps: RetryStep[] };
  items: PatchItem[];
}

// 최신 날짜가 배열 맨 앞
const DAYS: DayEntry[] = [
  {
    date: '9월 3일',
    story: {
      title: '위클리 "검수" 카드 정렬 — 세 번째 시도 끝에 해결',
      type: '버그수정',
      intro: '전날(9/2) 적용한 정렬 기준이 실제 화면 순서와 맞지 않는다는 리포트를 받고 재작업. 매번 스크린샷으로 재확인하며 기준을 좁혀감.',
      steps: [
        { label: '검수 대상 업무 등록순 (createdAt)', why: 'DB 문서 생성 시각 기준 — 카드 제목 날짜와 무관해 재현 안 됨', hash: '2f33b6c' },
        { label: '검수 대상 업무의 시작일 (startDate)', why: '이 필드도 카드 제목 날짜와 실제로 안 맞아 여전히 뒤섞임', hash: 'c5611f0' },
        { label: '업무관리 페이지 나열 순서 (sortOrder)', why: 'DB 날짜 필드 대신 업무관리 목록에 보이는 순서를 그대로 반영 — 업무관리에서 순서를 바꾸면 위클리도 함께 바뀜', hash: 'e673d09', final: true },
      ],
    },
    items: [
      {
        type: '기능추가',
        title: '본인이 등록한 업무, 삭제 권한 없어도 삭제 가능',
        desc: <>업무에 등록자(<b>authorName</b>)를 새로 기록. 팀 삭제 권한이 없는 일반 사용자도 <b>본인이 등록한 업무</b>는 업무 목록·상세 화면에서 삭제(휴지통 이동) 가능. 세부업무 개별삭제·일괄삭제·휴지통 복원/영구삭제는 기존과 동일하게 팀 권한 필요.</>,
        hashes: ['2d72302'],
      },
    ],
  },
  {
    date: '9월 2일',
    items: [
      {
        type: 'UI개선',
        title: '업무관리 연도/월 필터 UI 개편',
        desc: <>네이티브 드롭다운을 없애고 화살표(‹›) + 팝오버 방식으로 변경. 화살표를 값 박스 안에 두고 구분선으로 영역만 나누는 형태로 확정, 월 자릿수가 바뀌어도 너비가 흔들리지 않게 고정.</>,
        hashes: ['ccf0194', '54decb3', 'ff7f2ac', 'f94a9fb', 'fd7d7bb', '31e0fbf'],
      },
      {
        type: '버그수정',
        title: '위클리 검수 카드 상태 뱃지 표시 버그',
        desc: <>위클리에서 검수 항목이 실제 라벨과 무관하게 항상 "진행 중/완료"로만 보이던 문제 수정. 커스텀 라벨을 담는 <b>reviewStatusText</b> 필드를 별도로 실어 보내도록 함.</>,
        hashes: ['bca92fa'],
      },
      {
        type: '기능추가',
        title: '검수 상태 명칭 커스터마이징',
        desc: <>일반 세부업무·PL업무 검수 필드 모두, 팀별로 <b>"검수 전/검수 중/검수 완료"</b> 표시 문구를 자유롭게 바꿀 수 있게 함. 내부 저장값은 그대로 두고 화면 표시 텍스트만 얹는 방식이라 기존 로직에 영향 없음.</>,
        hashes: ['05a8dfe'],
      },
    ],
  },
];

const TYPE_STYLE: Record<ItemType, { bg: string; fg: string }> = {
  기능추가: { bg: 'var(--pn-accent-soft)', fg: 'var(--pn-accent-ink)' },
  버그수정: { bg: 'var(--pn-good-soft)', fg: 'var(--pn-good)' },
  UI개선: { bg: 'var(--pn-warn-soft)', fg: 'var(--pn-warn)' },
};

function TypeChip({ type }: { type: ItemType }) {
  const s = TYPE_STYLE[type];
  return <span className="pn-chip" style={{ background: s.bg, color: s.fg }}>{type}</span>;
}

function Hashes({ hashes }: { hashes: string[] }) {
  return (
    <div className="pn-hashes">
      {hashes.map(h => <span key={h} className="pn-hash">{h}</span>)}
    </div>
  );
}

const totalItems = DAYS.reduce((sum, d) => sum + d.items.length + (d.story ? 1 : 0), 0);
const totalCommits = DAYS.reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.hashes.length, 0) + (d.story?.steps.length ?? 0), 0);

export default function PatchNotesPage() {
  return (
    <div className="pn-root">
      <style>{`
        @font-face{ font-family:"Pretendard"; font-weight:400; font-style:normal; font-display:swap; src:url(/fonts/pretendard/Pretendard-Regular.woff2) format("woff2"); }
        @font-face{ font-family:"Pretendard"; font-weight:500; font-style:normal; font-display:swap; src:url(/fonts/pretendard/Pretendard-Medium.woff2) format("woff2"); }
        @font-face{ font-family:"Pretendard"; font-weight:600; font-style:normal; font-display:swap; src:url(/fonts/pretendard/Pretendard-SemiBold.woff2) format("woff2"); }
        @font-face{ font-family:"Pretendard"; font-weight:700; font-style:normal; font-display:swap; src:url(/fonts/pretendard/Pretendard-Bold.woff2) format("woff2"); }

        .pn-root{
          --pn-bg:#F5F5F9; --pn-surface:#FFFFFF; --pn-surface-2:#FAFAFC;
          --pn-border:#E4E4EE; --pn-border-soft:#ECECF4;
          --pn-text:#1D1E2C; --pn-text-muted:#6C6E85; --pn-text-faint:#9799AC;
          --pn-accent:#5B5BD6; --pn-accent-ink:#3F3FB0; --pn-accent-soft:#EEEEFB;
          --pn-good:#15803D; --pn-good-soft:#E6F5EA;
          --pn-warn:#B45309; --pn-warn-soft:#FDF0DE;
          --pn-shadow: 0 1px 2px rgba(30,31,50,0.04), 0 8px 24px -12px rgba(30,31,50,0.10);
          background:var(--pn-bg); color:var(--pn-text); min-height:100vh;
          font-family:"Pretendard",-apple-system,"Malgun Gothic",sans-serif;
          line-height:1.6; -webkit-font-smoothing:antialiased;
        }
        @media (prefers-color-scheme: dark){
          .pn-root:not([data-theme="light"]){
            --pn-bg:#131420; --pn-surface:#191A29; --pn-surface-2:#1E1F30;
            --pn-border:#2C2D42; --pn-border-soft:#26273A;
            --pn-text:#ECECF6; --pn-text-muted:#9A9CB5; --pn-text-faint:#71738C;
            --pn-accent:#8D8DF0; --pn-accent-ink:#B4B4F6; --pn-accent-soft:#24244A;
            --pn-good:#4ADE80; --pn-good-soft:#173225;
            --pn-warn:#FBBF6B; --pn-warn-soft:#332512;
            --pn-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 12px 28px -14px rgba(0,0,0,0.55);
          }
        }
        .pn-wrap{ max-width:760px; margin:0 auto; padding:56px 24px 80px; }
        .pn-eyebrow{ display:flex; align-items:center; gap:8px; font-family:"IBM Plex Mono",monospace; font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--pn-text-faint); margin-bottom:18px; }
        .pn-eyebrow .pn-dot{ width:5px; height:5px; border-radius:50%; background:var(--pn-accent); flex-shrink:0; }
        .pn-h1{ font-weight:700; font-size:clamp(30px,5vw,40px); letter-spacing:-0.02em; text-wrap:balance; margin:0 0 10px; color:var(--pn-text); }
        .pn-sub{ font-size:15px; color:var(--pn-text-muted); max-width:56ch; margin:0 0 28px; }
        .pn-meta-row{ display:flex; flex-wrap:wrap; gap:10px 22px; padding:16px 0; border-top:1px solid var(--pn-border); border-bottom:1px solid var(--pn-border); font-size:12.5px; color:var(--pn-text-muted); }
        .pn-meta-row b{ color:var(--pn-text); font-weight:600; }

        .pn-legend{ display:flex; flex-wrap:wrap; gap:8px 16px; margin:24px 0 4px; }
        .pn-legend-row{ display:flex; align-items:center; gap:6px; font-size:12px; color:var(--pn-text-muted); }

        .pn-day{ margin-top:40px; }
        .pn-day-head{ display:flex; align-items:baseline; gap:10px; margin-bottom:16px; }
        .pn-day-head .pn-date{ font-weight:700; font-size:19px; }
        .pn-day-head .pn-count{ font-size:12px; color:var(--pn-text-faint); }
        .pn-day-head .pn-rule{ flex:1; height:1px; background:var(--pn-border); align-self:center; }

        .pn-item{ background:var(--pn-surface); border:1px solid var(--pn-border); border-radius:12px; padding:16px 18px; margin-bottom:10px; box-shadow:var(--pn-shadow); }
        .pn-item-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:6px; }
        .pn-item-title{ font-weight:600; font-size:14.5px; color:var(--pn-text); }
        .pn-chip{ flex-shrink:0; font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px; white-space:nowrap; }
        .pn-item-desc{ font-size:13px; color:var(--pn-text-muted); max-width:64ch; }
        .pn-item-desc b{ color:var(--pn-text); font-weight:600; }
        .pn-hashes{ margin-top:10px; display:flex; flex-wrap:wrap; gap:6px; }
        .pn-hash{ font-family:"IBM Plex Mono",monospace; font-size:11px; background:var(--pn-surface-2); border:1px solid var(--pn-border-soft); color:var(--pn-text-muted); padding:2px 7px; border-radius:6px; }

        .pn-story{ background:var(--pn-surface); border:1px solid var(--pn-border); border-radius:12px; padding:18px 18px 16px; margin-bottom:10px; box-shadow:var(--pn-shadow); }
        .pn-steps{ display:flex; flex-direction:column; margin:14px 0 4px; }
        .pn-step{ display:grid; grid-template-columns:22px 1fr; gap:12px; position:relative; padding-bottom:14px; }
        .pn-step:last-child{ padding-bottom:0; }
        .pn-step-dot{ width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:"IBM Plex Mono",monospace; font-size:11px; font-weight:500; background:var(--pn-surface-2); border:1px solid var(--pn-border); color:var(--pn-text-faint); z-index:1; }
        .pn-step.pn-final .pn-step-dot{ background:var(--pn-good-soft); border-color:var(--pn-good); color:var(--pn-good); }
        .pn-step:not(:last-child)::before{ content:""; position:absolute; left:11px; top:22px; bottom:-14px; width:1px; background:var(--pn-border); }
        .pn-step-body{ padding-top:2px; }
        .pn-step-title{ font-size:13px; font-weight:600; color:var(--pn-text); }
        .pn-step-why{ font-size:12.5px; color:var(--pn-text-muted); margin-top:2px; }
        .pn-step .pn-hash{ margin-top:6px; display:inline-block; }

        .pn-callout{ background:var(--pn-surface); border:1px solid var(--pn-border); border-left:3px solid var(--pn-accent); border-radius:0 12px 12px 0; padding:16px 20px; margin-top:36px; }
        .pn-callout h2{ font-size:16px; font-weight:700; margin:0 0 10px; }
        .pn-callout ul{ margin:0; padding-left:18px; }
        .pn-callout li{ font-size:13px; color:var(--pn-text-muted); margin-bottom:6px; }
        .pn-callout li b{ color:var(--pn-text); font-weight:600; }
        .pn-callout li:last-child{ margin-bottom:0; }

        .pn-verify{ margin-top:28px; font-size:11.5px; color:var(--pn-text-faint); border-top:1px solid var(--pn-border); padding-top:14px; }

        @media (max-width:520px){ .pn-item-top{ flex-direction:column; } }
      `}</style>

      <div className="pn-wrap">
        <div className="pn-eyebrow"><span className="pn-dot" />PIVOT CREATIVE · Task Manager · 내부 공유</div>
        <h1 className="pn-h1">9/2–9/3 패치노트</h1>
        <p className="pn-sub">업무관리 툴에 반영된 검수 라벨·정렬, 연도/월 필터, 업무 삭제 권한 변경사항을 최신순으로 정리했습니다.</p>

        <div className="pn-meta-row">
          <div>배포 <b>main(운영) · Vercel 자동배포</b></div>
          <div>작업 항목 <b>{totalItems}건</b></div>
          <div>커밋 <b>{totalCommits}건</b></div>
        </div>

        <div className="pn-legend">
          <div className="pn-legend-row"><TypeChip type="기능추가" /> 새로 생긴 기능</div>
          <div className="pn-legend-row"><TypeChip type="버그수정" /> 기존 오작동 수정</div>
          <div className="pn-legend-row"><TypeChip type="UI개선" /> 화면·조작 방식 개선</div>
        </div>

        {DAYS.map(day => (
          <div className="pn-day" key={day.date}>
            <div className="pn-day-head">
              <span className="pn-date">{day.date}</span>
              <span className="pn-count">{day.items.length + (day.story ? 1 : 0)}건</span>
              <span className="pn-rule" />
            </div>

            {day.story && (
              <div className="pn-story">
                <div className="pn-item-top" style={{ marginBottom: 0 }}>
                  <div className="pn-item-title">{day.story.title}</div>
                  <TypeChip type={day.story.type} />
                </div>
                <div className="pn-item-desc" style={{ marginTop: 6 }}>{day.story.intro}</div>
                <div className="pn-steps">
                  {day.story.steps.map((s, i) => (
                    <div className={`pn-step${s.final ? ' pn-final' : ''}`} key={s.hash}>
                      <div className="pn-step-dot">{s.final ? '✓' : i + 1}</div>
                      <div className="pn-step-body">
                        <div className="pn-step-title">{s.label}</div>
                        <div className="pn-step-why">{s.why}</div>
                        <span className="pn-hash">{s.hash}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {day.items.map(item => (
              <div className="pn-item" key={item.title}>
                <div className="pn-item-top">
                  <div className="pn-item-title">{item.title}</div>
                  <TypeChip type={item.type} />
                </div>
                <div className="pn-item-desc">{item.desc}</div>
                <Hashes hashes={item.hashes} />
              </div>
            ))}
          </div>
        ))}

        <div className="pn-callout">
          <h2>확인이 필요한 부분</h2>
          <ul>
            <li><b>staging 미반영</b> — 9/3 커밋 4건(정렬 재수정 3건 + 삭제권한)이 아직 staging에 안 올라감. 다음 STG 동기화 때 함께 반영 필요.</li>
            <li><b>지원팀 위클리 크로스뷰</b> — 다른 팀 업무를 가져와 보여주는 지원팀 화면은 아직 createdAt 정렬이라 이번 정렬 개선이 적용 안 됨.</li>
            <li><b>기존 업무는 삭제권한 소급 적용 안 됨</b> — authorName이 없는 과거 업무는 계속 팀 권한이 있어야 삭제 가능.</li>
          </ul>
        </div>

        <p className="pn-verify">이 페이지의 커밋 해시·배포 상태는 git 로그 기준으로 작성했습니다 — 전달 전 원출처(레포/배포 로그) 대조 확인 부탁드립니다.</p>
      </div>
    </div>
  );
}
