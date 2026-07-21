// Windows ↔ Mac 경로 변환 — 정규식 기반 휴리스틱 변환기 (LLM 아님, 결정적 규칙)
export interface PathConvertResult {
  direction: 'win-to-mac' | 'mac-to-win' | 'none';
  output?: string;
  note?: string;
}

const WIN_UNC = /^\\\\/;
const WIN_DRIVE = /^[A-Za-z]:[\\/]/;
const MAC_HOME = /^~(\/|$)/;
const MAC_ABS = /^\//;
const MAC_SMB = /^smb:\/\//i;

function winToMac(raw: string): PathConvertResult {
  const path = raw.trim();

  if (WIN_UNC.test(path)) {
    const parts = path.replace(/^\\\\/, '').split(/\\+/).filter(Boolean);
    const [server, share, ...rest] = parts;
    if (!server) return { direction: 'win-to-mac', output: 'smb://' };
    if (!share) return { direction: 'win-to-mac', output: `smb://${server}` };
    const restPath = rest.length ? '/' + rest.join('/') : '';
    const smbUrl = `smb://${server}/${share}${restPath}`;
    const volumesPath = `/Volumes/${share}${restPath}`;
    // /Volumes/... 경로는 이미 그 서버에 접속(마운트)되어 있어야만 유효함 — 아직 연결 안 된
    // 상태에서 이 경로만 주면 "서버를 찾을 수 없음" 오류가 남. 처음 접속할 때 쓸 smb:// 주소를
    // 기본값으로 주고, 이미 마운트돼 있다면 쓸 수 있는 경로는 참고용으로 note에 남긴다.
    return {
      direction: 'win-to-mac',
      output: smbUrl,
      note: `Finder에서 Cmd+K(서버에 연결)로 위 주소를 입력해 접속하세요. 이미 연결된 상태라면 ${volumesPath} 로도 접근할 수 있어요.`,
    };
  }

  if (WIN_DRIVE.test(path)) {
    const drive = path[0].toUpperCase();
    const rest = path.slice(2).replace(/^[\\/]/, '');
    const parts = rest.split(/[\\/]+/).filter(Boolean);

    if (drive === 'C' && parts[0]?.toLowerCase() === 'users' && parts.length >= 2) {
      return { direction: 'win-to-mac', output: '/Users/' + parts.slice(1).join('/') };
    }
    if (parts.length === 0) {
      return { direction: 'win-to-mac', output: '/Volumes/' + drive };
    }
    return {
      direction: 'win-to-mac',
      output: '/Volumes/' + parts.join('/'),
      note: '네트워크/외부 드라이브로 추정해 "/Volumes/" 기준으로 변환했어요. 실제 마운트명과 다르면 맨 앞 폴더명만 바꿔주세요.',
    };
  }

  // 드라이브 표시 없는 상대경로 (백슬래시만 슬래시로 치환)
  return { direction: 'win-to-mac', output: path.replace(/\\/g, '/') };
}

function macToWin(raw: string): PathConvertResult {
  const path = raw.trim();

  if (MAC_SMB.test(path)) {
    const parts = path.replace(MAC_SMB, '').split('/').filter(Boolean);
    const [server, share, ...rest] = parts;
    if (!server) return { direction: 'mac-to-win', output: '\\\\' };
    if (!share) return { direction: 'mac-to-win', output: `\\\\${server}` };
    const output = '\\\\' + server + '\\' + share + (rest.length ? '\\' + rest.join('\\') : '');
    // smb:// 주소는 서버 주소를 그대로 담고 있어 추측 없이 UNC 경로로 정확히 변환됨
    return { direction: 'mac-to-win', output };
  }

  if (MAC_HOME.test(path)) {
    const rest = path.slice(1).replace(/^\//, '');
    const output = 'C:\\Users\\<사용자명>' + (rest ? '\\' + rest.replace(/\//g, '\\') : '');
    return { direction: 'mac-to-win', output, note: '<사용자명> 부분은 실제 윈도우 계정명으로 바꿔주세요.' };
  }

  if (path.startsWith('/Users/')) {
    const parts = path.replace(/^\/Users\//, '').split('/').filter(Boolean);
    return { direction: 'mac-to-win', output: 'C:\\Users\\' + parts.join('\\') };
  }

  if (path.startsWith('/Volumes/')) {
    const parts = path.replace(/^\/Volumes\//, '').split('/').filter(Boolean);
    const volume = parts[0] ?? '';
    const rest = parts.slice(1);
    if (!volume) return { direction: 'mac-to-win', output: 'Z:\\' };
    if (volume.length === 1) {
      const output = volume.toUpperCase() + ':' + (rest.length ? '\\' + rest.join('\\') : '\\');
      return { direction: 'mac-to-win', output };
    }
    const output = '\\\\' + volume + (rest.length ? '\\' + rest.join('\\') : '');
    return {
      direction: 'mac-to-win',
      output,
      note: '네트워크 공유 폴더로 추정해 UNC 경로(\\\\서버명\\...) 형태로 변환했어요. 실제 서버명이 다르면 맨 앞 이름만 바꿔주세요.',
    };
  }

  return { direction: 'mac-to-win', output: path.replace(/\//g, '\\') };
}

export function convertPath(raw: string): PathConvertResult {
  const path = raw.trim();
  if (!path) return { direction: 'none' };

  const looksWindows = WIN_UNC.test(path) || WIN_DRIVE.test(path) || (path.includes('\\') && !path.includes('/'));
  const looksMac = MAC_HOME.test(path) || MAC_ABS.test(path) || MAC_SMB.test(path);

  if (looksWindows) return winToMac(path);
  if (looksMac) return macToWin(path);

  if (!path.includes('/') && !path.includes('\\')) {
    return { direction: 'none' };
  }
  // 구분자가 있지만 방향이 불분명한 경우 — 슬래시가 더 많으면 맥, 아니면 윈도우로 간주
  const slashes = (path.match(/\//g) ?? []).length;
  const backslashes = (path.match(/\\/g) ?? []).length;
  return backslashes > slashes ? winToMac(path) : macToWin(path);
}
