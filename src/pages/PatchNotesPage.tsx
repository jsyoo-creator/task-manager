// PIVOT CREATIVE 내부 공유용 패치노트. PrivacyPolicyPage/ClaudeGuidePage와 동일한 패턴 —
// 로그인 게이트 없이 URL로만 접근, 앱 메뉴/네비게이션에는 의도적으로 노출하지 않음.
// 개발자가 아닌 일반 구성원도 읽는 페이지라 커밋 해시 등 기술 용어는 넣지 않고, 화면에서
// 실제로 무엇이 달라졌는지 쉬운 말로 적는다. 새 패치가 나오면 DAYS 배열 맨 앞에 추가한다.

type ItemType = '새기능' | '버그수정' | '화면개선';

interface PatchItem {
  type: ItemType;
  title: string;
  desc: React.ReactNode;
}

interface DayEntry {
  date: string;
  items: PatchItem[];
}

// 최신 날짜가 배열 맨 앞
const DAYS: DayEntry[] = [
  {
    date: '9월 3일',
    items: [
      {
        type: '버그수정',
        title: '위클리 "검수" 카드 목록 순서 수정',
        desc: <>위클리에서 검수 항목들이 업무관리 페이지와 다른 순서로 보이던 문제를 고쳤습니다. 이제 <b>업무관리에 나열된 순서 그대로</b> 위클리에도 나타나고, 업무관리에서 순서를 바꾸면 위클리도 같이 바뀝니다.</>,
      },
      {
        type: '새기능',
        title: '본인이 등록한 업무는 삭제 권한 없어도 삭제 가능',
        desc: <>지금까지는 팀에서 삭제 권한을 받은 사람만 업무를 삭제할 수 있었습니다. 이제는 삭제 권한이 없어도 <b>내가 직접 등록한 업무</b>는 스스로 삭제(휴지통으로 이동)할 수 있습니다. 세부업무 삭제·여러 개 한번에 삭제·휴지통 복원은 기존처럼 권한이 있는 사람만 가능합니다.</>,
      },
    ],
  },
  {
    date: '9월 2일',
    items: [
      {
        type: '화면개선',
        title: '업무관리 연도·월 선택 방식 변경',
        desc: <>연도/월을 고르던 드롭다운을 없애고, 좌우 화살표로 한 달씩 넘기거나 눌러서 바로 고를 수 있는 방식으로 바꿨습니다. 화면 크기가 흔들리지 않게 다듬었습니다.</>,
      },
      {
        type: '버그수정',
        title: '위클리 검수 카드에 실제 상태 문구가 안 보이던 문제 수정',
        desc: <>위클리 화면에서 검수 항목이 실제 상태(예: 팀에서 정한 커스텀 문구)와 다르게 항상 "진행 중"이나 "완료"로만 보이던 문제를 고쳤습니다.</>,
      },
      {
        type: '새기능',
        title: '검수 상태 이름을 팀에서 원하는 표현으로 바꿀 수 있게 됨',
        desc: <>"검수 전 / 검수 중 / 검수 완료"라는 기본 문구를, 팀 설정에서 원하는 표현으로 바꿔서 표시할 수 있게 됐습니다.</>,
      },
    ],
  },
];

const TYPE_STYLE: Record<ItemType, { bg: string; fg: string }> = {
  새기능: { bg: 'var(--pn-accent-soft)', fg: 'var(--pn-accent-ink)' },
  버그수정: { bg: 'var(--pn-good-soft)', fg: 'var(--pn-good)' },
  화면개선: { bg: 'var(--pn-warn-soft)', fg: 'var(--pn-warn)' },
};

function TypeChip({ type }: { type: ItemType }) {
  const s = TYPE_STYLE[type];
  return <span className="pn-chip" style={{ background: s.bg, color: s.fg }}>{type}</span>;
}

export default function PatchNotesPage() {
  return (
    <div className="pn-root">
      <style>{`
        .pn-root{
          --pn-bg:#F5F5F9; --pn-surface:#FFFFFF;
          --pn-border:#E4E4EE;
          --pn-text:#1D1E2C; --pn-text-muted:#6C6E85; --pn-text-faint:#9799AC;
          --pn-accent:#5B5BD6; --pn-accent-ink:#3F3FB0; --pn-accent-soft:#EEEEFB;
          --pn-good:#15803D; --pn-good-soft:#E6F5EA;
          --pn-warn:#B45309; --pn-warn-soft:#FDF0DE;
          --pn-shadow: 0 1px 2px rgba(30,31,50,0.04), 0 8px 24px -12px rgba(30,31,50,0.10);
          background:var(--pn-bg); color:var(--pn-text);
          height:100vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
          font-family:"Pretendard",-apple-system,"Malgun Gothic",sans-serif;
          line-height:1.65; -webkit-font-smoothing:antialiased;
        }
        @media (prefers-color-scheme: dark){
          .pn-root:not([data-theme="light"]){
            --pn-bg:#131420; --pn-surface:#191A29;
            --pn-border:#2C2D42;
            --pn-text:#ECECF6; --pn-text-muted:#9A9CB5; --pn-text-faint:#71738C;
            --pn-accent:#8D8DF0; --pn-accent-ink:#B4B4F6; --pn-accent-soft:#24244A;
            --pn-good:#4ADE80; --pn-good-soft:#173225;
            --pn-warn:#FBBF6B; --pn-warn-soft:#332512;
            --pn-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 12px 28px -14px rgba(0,0,0,0.55);
          }
        }
        .pn-wrap{ max-width:640px; margin:0 auto; padding:52px 24px 72px; }
        .pn-brand{ font-size:12.5px; font-weight:600; letter-spacing:.02em; color:var(--pn-accent-ink); margin-bottom:16px; }
        .pn-h1{ font-weight:700; font-size:clamp(28px,5vw,36px); letter-spacing:-0.02em; text-wrap:balance; margin:0 0 12px; color:var(--pn-text); }
        .pn-sub{ font-size:15px; color:var(--pn-text-muted); max-width:52ch; margin:0 0 28px; }

        .pn-legend{ display:flex; flex-wrap:wrap; gap:8px 16px; padding:14px 0 28px; border-bottom:1px solid var(--pn-border); }
        .pn-legend-row{ display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--pn-text-muted); }

        .pn-day{ margin-top:36px; }
        .pn-day-head{ display:flex; align-items:baseline; gap:10px; margin-bottom:14px; }
        .pn-day-head .pn-date{ font-weight:700; font-size:18px; }
        .pn-day-head .pn-rule{ flex:1; height:1px; background:var(--pn-border); align-self:center; }

        .pn-item{ background:var(--pn-surface); border:1px solid var(--pn-border); border-radius:12px; padding:16px 18px; margin-bottom:10px; box-shadow:var(--pn-shadow); }
        .pn-item-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:6px; }
        .pn-item-title{ font-weight:600; font-size:15px; color:var(--pn-text); }
        .pn-chip{ flex-shrink:0; font-size:11.5px; font-weight:600; padding:3px 10px; border-radius:999px; white-space:nowrap; }
        .pn-item-desc{ font-size:13.5px; color:var(--pn-text-muted); max-width:58ch; }
        .pn-item-desc b{ color:var(--pn-text); font-weight:600; }

        .pn-callout{ background:var(--pn-surface); border:1px solid var(--pn-border); border-left:3px solid var(--pn-accent); border-radius:0 12px 12px 0; padding:16px 20px; margin-top:32px; }
        .pn-callout h2{ font-size:15px; font-weight:700; margin:0 0 10px; }
        .pn-callout ul{ margin:0; padding-left:18px; }
        .pn-callout li{ font-size:13px; color:var(--pn-text-muted); margin-bottom:6px; }
        .pn-callout li:last-child{ margin-bottom:0; }

        .pn-verify{ margin-top:24px; font-size:11.5px; color:var(--pn-text-faint); }

        @media (max-width:520px){ .pn-item-top{ flex-direction:column; } }
      `}</style>

      <div className="pn-wrap">
        <div className="pn-brand">PIVOT CREATIVE · 업무관리 시스템 안내</div>
        <h1 className="pn-h1">최근 업데이트 안내</h1>
        <p className="pn-sub">지난 이틀 동안 업무관리 시스템에 반영된 변경사항을 정리했습니다. 모두 이미 적용되어 지금 바로 확인하실 수 있습니다.</p>

        <div className="pn-legend">
          <div className="pn-legend-row"><TypeChip type="새기능" /> 새로 생긴 기능</div>
          <div className="pn-legend-row"><TypeChip type="버그수정" /> 잘못 작동하던 부분 수정</div>
          <div className="pn-legend-row"><TypeChip type="화면개선" /> 화면·사용 방식 개선</div>
        </div>

        {DAYS.map(day => (
          <div className="pn-day" key={day.date}>
            <div className="pn-day-head">
              <span className="pn-date">{day.date}</span>
              <span className="pn-rule" />
            </div>

            {day.items.map(item => (
              <div className="pn-item" key={item.title}>
                <div className="pn-item-top">
                  <div className="pn-item-title">{item.title}</div>
                  <TypeChip type={item.type} />
                </div>
                <div className="pn-item-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        ))}

        <div className="pn-callout">
          <h2>참고해 주세요</h2>
          <ul>
            <li>다른 팀 업무를 대신 확인해주는 지원팀 화면에는 검수 목록 순서 수정이 아직 적용되지 않았습니다.</li>
            <li>삭제 권한 관련 변경은 앞으로 새로 등록되는 업무부터 적용되며, 이미 등록돼 있던 업무에는 적용되지 않습니다.</li>
          </ul>
        </div>

        <p className="pn-verify">내용에 궁금한 점이나 실제 화면과 다른 부분이 있으면 담당자에게 확인해 주세요.</p>
      </div>
    </div>
  );
}
