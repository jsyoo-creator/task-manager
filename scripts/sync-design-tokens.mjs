#!/usr/bin/env node
// claude.ai/design "Task Manager Design System" 프로젝트의 design-tokens.json 값을
// src/styles/globals.css :root 블록에 반영한다. 사용자가 "토큰 반영해줘"라고 요청할 때
// Claude Code가 DesignSync로 design-tokens.json을 읽어 임시 파일로 저장한 뒤 실행한다.
//
// 사용법: node scripts/sync-design-tokens.mjs <design-tokens.json 경로>

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(__dirname, '..', 'src', 'styles', 'globals.css');

// design-tokens.json 키 → globals.css 안의 CSS 커스텀 프로퍼티 이름 매핑.
// 여기 없는 값(예: --sidebar-active 같은 opacity 기반 파생 색상)은 토큰화 대상이 아니므로 건드리지 않는다.
const VAR_MAP = {
  'font.family': ['--font-family-sans', '--font-sans'],
  'colors.sidebarBg': ['--sidebar-bg'],
  'colors.colorBg': ['--color-bg'],
  'colors.colorSurface': ['--color-surface'],
  'colors.colorBorder': ['--color-border'],
  'colors.colorAccent': ['--color-accent'],
  'colors.colorPink': ['--color-pink'],
  'colors.colorText': ['--color-text'],
  'colors.colorText2': ['--color-text-2'],
  'colors.colorText3': ['--color-text-3'],
};

function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function main() {
  const tokensPath = process.argv[2];
  if (!tokensPath) {
    console.error('사용법: node scripts/sync-design-tokens.mjs <design-tokens.json 경로>');
    process.exit(1);
  }

  const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
  let css = readFileSync(CSS_PATH, 'utf8');
  const changes = [];

  for (const [tokenKey, cssVars] of Object.entries(VAR_MAP)) {
    const value = getPath(tokens, tokenKey);
    if (value == null) continue;

    for (const cssVar of cssVars) {
      // 그룹1: "--var:" + 원래 들여쓰기 공백(정렬 유지용), 그룹2: 값
      const re = new RegExp(`(${cssVar}:\\s*)([^;]+);`);
      const match = css.match(re);
      if (!match) continue;
      const currentValue = match[2].trim();
      if (currentValue === value) continue; // 값이 같으면 공백/포맷은 건드리지 않는다
      css = css.replace(re, `$1${value};`);
      changes.push(`${cssVar}: ${currentValue} → ${value}`);
    }
  }

  if (changes.length === 0) {
    console.log('변경된 토큰 없음 — CSS는 이미 최신 상태.');
    return;
  }

  writeFileSync(CSS_PATH, css);
  console.log(`${changes.length}개 값 반영:`);
  for (const c of changes) console.log(`  - ${c}`);
}

main();
