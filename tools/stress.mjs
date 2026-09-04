// 동시 저장 부하 테스트 — 배포된 Apps Script 웹앱에 같은 학생 기록을 동시에 보내 유실·중복이 없는지 확인한다.
// 사용법: node tools/stress.mjs <API_URL> <이메일> <비밀번호> <학생ID> [동시요청수=30] [재전송횟수=2]
const [apiUrl, email, password, studentId, nStr = '30', dupStr = '2'] = process.argv.slice(2);
if (!apiUrl || !email || !password || !studentId) {
  console.log('사용법: node tools/stress.mjs <API_URL> <이메일> <비밀번호> <학생ID> [동시요청수] [재전송횟수]');
  process.exit(1);
}
const N = Number(nStr), DUP = Number(dupStr);

async function call(action, data, token) {
  let attempt = 0;
  for (;;) {
    const res = await fetch(apiUrl, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, data, token }) });
    const json = await res.json();
    if (json.ok) return { data: json.data, attempts: attempt + 1 };
    if (json.code === 'BUSY' && attempt < 6) { attempt++; await new Promise(r => setTimeout(r, 500 * 2 ** attempt)); continue; }
    throw new Error(json.code + ': ' + json.error);
  }
}

const login = await call('login', { email, password });
const token = login.data.token;
const today = new Date().toISOString().slice(0, 10);
const marker = 'stress-' + Date.now();
const records = Array.from({ length: N }, (_, i) => ({
  id: crypto.randomUUID(), studentId, date: today, time: '09:00', tags: ['etc'], content: `${marker} #${i}`, visibility: 'all'
}));

console.log(`동시 요청 ${N}건 × 재전송 ${DUP}회 전송 중...`);
const t0 = Date.now();
const jobs = [];
for (let k = 0; k <= DUP; k++) for (const r of records) jobs.push(call('records.create', { record: r }, token).catch(e => ({ error: e.message })));
const results = await Promise.all(jobs);
const ms = Date.now() - t0;
const errors = results.filter(r => r.error);
const retried = results.filter(r => r.attempts > 1).length;

const list = await call('records.list', { studentId }, token);
const saved = list.data.records.filter(r => r.content.startsWith(marker));
const ids = new Set(saved.map(r => r.id));

console.log(`소요 ${ms}ms · 오류 ${errors.length}건 · BUSY 재시도 ${retried}건`);
console.log(`저장된 기록 ${saved.length}건 / 기대 ${N}건 · 고유 ID ${ids.size}개`);
if (errors.length) console.log('오류 예시:', errors.slice(0, 3));
const ok = saved.length === N && ids.size === N;
console.log(ok ? '✓ 유실 0건, 중복 0건' : '✗ 유실 또는 중복 발생');
console.log('테스트 기록은 앱에서 삭제하거나 시트에서 "' + marker + '" 로 찾아 정리하세요.');
process.exit(ok ? 0 : 1);
