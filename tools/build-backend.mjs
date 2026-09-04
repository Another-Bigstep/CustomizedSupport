// js/lib.js + backend/Code.gs 를 합쳐 Apps Script 에 한 번에 붙여넣을 파일을 만든다.
import fs from 'node:fs';
const lib = fs.readFileSync('js/lib.js', 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
const code = fs.readFileSync('backend/Code.gs', 'utf8');
fs.mkdirSync('backend/dist', { recursive: true });
fs.writeFileSync('backend/dist/Code.gs', '// ===== 자동 생성 파일: npm run build:backend (js/lib.js + backend/Code.gs) =====\n\n' + lib + '\n\n' + code);
console.log('backend/dist/Code.gs 생성 완료');
