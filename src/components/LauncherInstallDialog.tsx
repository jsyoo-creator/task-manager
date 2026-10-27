import { useEffect, useState } from 'react';
import { X, Download, Loader2, TriangleAlert } from 'lucide-react';

// ArtCraft 런처 설치 안내 — 커뮤니티 > AI 툴 리스트에서 연다.
// 최신 릴리스를 깃허브에서 읽어 지금 쓰는 운영체제에 맞는 설치 파일을 바로 받게 한다.
// 못 읽으면 릴리스 페이지를 열어 직접 고르게 한다.
const REPO = 'storytold/craft-launcher';
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

type Os = 'mac' | 'windows' | 'other';

interface Pick {
  version: string;
  name: string;
  url: string;
  size: number;
}

// 브라우저가 알려주는 값으로 운영체제를 고른다 (팀은 맥·윈도우만 쓴다).
function currentOs(): Os {
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return 'mac';
  if (/Win/i.test(ua)) return 'windows';
  return 'other';
}

// 운영체제에 맞는 설치 파일 하나. 윈도우는 ARM 기기면 arm64, 아니면 x64.
function pickAsset(assets: { name: string; browser_download_url: string; size: number }[], os: Os) {
  const wants =
    os === 'mac'
      ? (n: string) => n.endsWith('macos-universal.dmg')
      : /arm64|aarch64/i.test(navigator.userAgent)
        ? (n: string) => n.endsWith('windows-arm64.msi')
        : (n: string) => n.endsWith('windows-x64.msi');
  return assets.find(a => wants(a.name));
}

function sizeText(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

export default function LauncherInstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; pick: Pick } | { kind: 'failed' }>({ kind: 'loading' });
  const os = currentOs();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState({ kind: 'loading' });
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(rel => {
        if (!alive) return;
        const asset = os === 'other' ? undefined : pickAsset(rel.assets ?? [], os);
        if (!asset) {
          setState({ kind: 'failed' });
          return;
        }
        setState({
          kind: 'ready',
          pick: { version: String(rel.tag_name ?? '').replace(/^v/, ''), name: asset.name, url: asset.browser_download_url, size: asset.size },
        });
      })
      .catch(() => alive && setState({ kind: 'failed' }));
    return () => {
      alive = false;
    };
  }, [open, os]);

  if (!open) return null;

  const howTo =
    os === 'mac'
      ? '받은 파일을 열고 앱을 응용 프로그램 폴더로 끌어다 놓으세요'
      : '받은 파일을 실행하면 설치가 진행됩니다';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[380px] mx-4 rounded-2xl bg-white border border-black/8 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h2 className="text-sm font-semibold text-gray-900">ArtCraft 런처 설치</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* 본문 — 상태가 바뀌어도 높이는 그대로 */}
        <div className="h-[184px] px-5 flex flex-col items-center justify-center gap-3.5">
          {state.kind === 'loading' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Loader2 size={24} className="text-[#6C63FF] animate-spin" />
              </div>
              <p className="text-sm text-gray-500 break-keep">설치 파일을 찾는 중입니다</p>
            </>
          )}

          {state.kind === 'ready' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Download size={24} className="text-[#6C63FF]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">
                  ArtCraft 런처 {state.pick.version}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {os === 'mac' ? '맥용' : '윈도우용'} · {sizeText(state.pick.size)}
                </p>
                <p className="text-sm text-gray-500 mt-2.5 break-keep">{howTo}</p>
              </div>
            </>
          )}

          {state.kind === 'failed' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                <TriangleAlert size={24} className="text-amber-400" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 break-keep">설치 파일 정보를 불러오지 못했습니다</p>
                <p className="text-xs text-gray-400 mt-1.5 break-keep">릴리스 페이지에서 직접 받아 주세요</p>
              </div>
            </>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
          <a
            href={state.kind === 'ready' ? state.pick.url : RELEASES_URL}
            target={state.kind === 'ready' ? undefined : '_blank'}
            rel="noreferrer"
            onClick={state.kind === 'loading' ? e => e.preventDefault() : undefined}
            aria-disabled={state.kind === 'loading'}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl text-white text-center transition-colors ${
              state.kind === 'loading' ? 'bg-[#6C63FF]/40 cursor-default' : 'bg-[#6C63FF] hover:bg-[#5a52e0]'
            }`}
          >
            {state.kind === 'failed' ? '릴리스 페이지 열기' : '내려받기'}
          </a>
        </div>
      </div>
    </div>
  );
}
