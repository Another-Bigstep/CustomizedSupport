// 데모 모드 브라우저 스모크 테스트 (Playwright + 내장 Chromium)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || 'playwright');
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || 'tests/screens';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const errors = [];
let failures = 0;
function check(cond, msg) { if (cond) console.log('  ✓', msg); else { failures++; console.log('  ✗', msg); } }

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'ko-KR' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page };
}

// ---- 모바일 흐름: 담임 로그인 → 홈 → 학생 → 기록 작성 → 상세 → PIN 해제
{
  const { ctx, page } = await newPage({ width: 402, height: 874 });
  await page.goto(BASE);
  await page.waitForSelector('.login-card');
  await page.screenshot({ path: `${OUT}/m1-login.png` });
  await page.getByRole('button', { name: /이준형/ }).click();
  await page.waitForSelector('.stats');
  await page.waitForSelector('.alert, .glass.card');
  await page.screenshot({ path: `${OUT}/m2-home.png`, fullPage: true, animations: 'disabled' });
  check(await page.locator('.h1').first().textContent() === '기계과 3-2', '홈 제목이 담임 학급');
  const alertText = await page.locator('.glass.card.alert').first().textContent().catch(() => '');
  check(/문제행동 3주 연속/.test(alertText), '문제행동 3주 연속 알림 표시');

  // 학생 찾기
  await page.locator('.tabbar button', { hasText: '학생' }).click();
  await page.waitForSelector('main .search');
  await page.waitForSelector('main .row .avatar');
  await page.screenshot({ path: `${OUT}/m3-students.png`, fullPage: true, animations: 'disabled' });
  const rows = await page.locator('main .row .avatar').count();
  check(rows >= 10, `담임 학급 학생 목록 표시 (${rows}명)`);
  const firstName = (await page.locator('main .row .title').first().textContent()).trim();
  await page.locator('main .row').first().click();
  await page.waitForSelector('.cta');
  const studentUrl = page.url();
  await page.screenshot({ path: `${OUT}/m4-student.png`, fullPage: true });
  check((await page.locator('.h1').first().textContent()).trim() === firstName, '학생 상세 이름 일치: ' + firstName);

  // 기록 작성 (안내 모달 → 폼)
  await page.getByRole('button', { name: /이 학생 기록하기/ }).click();
  await page.waitForSelector('.modal');
  await page.screenshot({ path: `${OUT}/m5-notice.png` });
  await page.locator('.modal input[type=checkbox]').check();
  await page.getByRole('button', { name: /작성 시작/ }).click();
  await page.waitForSelector('textarea');
  await page.getByRole('button', { name: '복지', exact: true }).click();
  await page.getByRole('button', { name: '아침 결식 확인됨' }).click();
  await page.locator('textarea').fill(await page.locator('textarea').inputValue() + '. 1교시 전 보건실에서 우유를 먹고 안정을 찾음.');
  await page.getByRole('button', { name: /담당 교사만/ }).click();
  await page.screenshot({ path: `${OUT}/m6-record-form.png`, fullPage: true });
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForSelector('.toast');
  await page.waitForSelector('.rec-body');
  const bodies = await page.locator('.rec-body').allTextContents();
  check(bodies.some(t => /아침 결식 확인됨/.test(t)), '저장한 기록이 상세 화면에 표시(작성자는 잠금 없이 열람)');
  check((await page.locator('.lockbadge').count()) >= 1, '담당 교사만 배지 표시');

  // 수정 흐름 + 버전 충돌 (같은 version 으로 두 번 저장하면 두 번째는 CONFLICT)
  await page.locator('.rec-actions button', { hasText: '수정' }).first().click();
  await page.waitForSelector('textarea');
  await page.locator('textarea').fill('수정된 내용입니다.');
  await page.getByRole('button', { name: '수정 저장' }).click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.rec-body')).some(e => /수정된 내용입니다/.test(e.textContent)));
  check(true, '기록 수정 저장');
  const conflict = await page.evaluate(async () => {
    const res = await SOSApi.call('records.list', { scope: 'mine', limit: 1 });
    const r = res.records[0];
    const first = await SOSApi.call('records.update', { id: r.id, version: r.version, patch: { content: r.content + ' (1차)' } }).then(() => 'ok', e => e.code);
    const second = await SOSApi.call('records.update', { id: r.id, version: r.version, patch: { content: r.content + ' (2차)' } }).then(() => 'ok', e => e.code);
    const dup = await SOSApi.call('records.create', { record: Object.assign({}, r, { content: '중복 전송' }) });
    return { first, second, duplicate: dup.duplicate };
  });
  check(conflict.first === 'ok' && conflict.second === 'CONFLICT', `버전 검사: 1차 ${conflict.first}, 2차 ${conflict.second}`);
  check(conflict.duplicate === true, '같은 ID 재전송은 중복 저장되지 않음');

  // 다른 사용자(교과교사)로 같은 학생을 보면 잠김
  await ctx.clearCookies();
  await page.evaluate(() => { localStorage.removeItem('sos.token'); localStorage.removeItem('sos.unlock'); sessionStorage.clear(); });
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.login-card');
  await page.getByRole('button', { name: /박지훈/ }).click();
  await page.waitForSelector('.stats');
  await page.goto(studentUrl);
  await page.waitForSelector('.rec-lock, .rec-body');
  const lockCount = await page.locator('.rec-lock').count();
  check(lockCount >= 1, `교과교사에게는 잠긴 기록으로 표시 (${lockCount}건)`);
  const unlockBtn = await page.locator('.rec-lock button', { hasText: '해제' }).count();
  check(unlockBtn === 0, '교과교사에게는 해제 버튼이 없음');
  await page.screenshot({ path: `${OUT}/m7-locked-subject.png`, fullPage: true });

  // 상담교사: 해제 버튼 → PIN 화면
  await page.evaluate(() => { localStorage.removeItem('sos.token'); localStorage.removeItem('sos.unlock'); });
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.login-card');
  await page.getByRole('button', { name: /최수민/ }).click();
  await page.waitForSelector('.stats');
  await page.goto(studentUrl);
  await page.waitForSelector('.rec-lock');
  await page.locator('.rec-lock button', { hasText: '해제' }).first().click();
  await page.waitForSelector('.pin-screen');
  await page.screenshot({ path: `${OUT}/m8-pin.png` });
  for (const d of '111111') await page.locator('.pin-pad button', { hasText: d }).first().click();
  await page.waitForSelector('.pin-screen .err:not(:empty)');
  check(/PIN이 올바르지 않습니다/.test(await page.locator('.pin-screen .err').textContent()), '잘못된 PIN 거부');
  for (const d of '123456') await page.locator('.pin-pad button', { hasText: d }).first().click();
  const unlockedOk = await page.waitForFunction(() => !document.querySelector('.pin-screen') && document.querySelector('.rec-body') && !document.querySelector('.rec-lock'), null, { timeout: 10000 }).then(() => true).catch(() => false);
  check(unlockedOk, 'PIN 해제 후 본문 표시');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/m9-unlocked.png`, fullPage: true, animations: 'disabled' });

  // 설정: 열람 로그에 상담교사 열람이 남았는지
  await page.goto(BASE + '#/settings');
  await page.waitForSelector('.log-line');
  const logs = await page.locator('.log-line').allTextContents();
  check(logs.some(t => /최수민/.test(t) && /(열람|해제)/.test(t)), '열람 로그에 상담교사 열람·해제 기록');
  await page.screenshot({ path: `${OUT}/m10-settings.png`, fullPage: true });
  await ctx.close();
}

// ---- PC 대시보드
{
  const { ctx, page } = await newPage({ width: 1280, height: 820 });
  await page.goto(BASE);
  await page.waitForSelector('.login-card');
  await page.getByRole('button', { name: /이준형/ }).click();
  await page.waitForSelector('.table .tr');
  await page.screenshot({ path: `${OUT}/pc1-dashboard.png`, fullPage: true });
  check((await page.locator('.sidebar .row').count()) >= 6, 'PC 사이드바 메뉴');
  check((await page.locator('.stats .glass').count()) === 4, 'PC 4개 통계 타일');
  await page.goto(BASE + '#/records');
  await page.waitForSelector('.cards .glass.card');
  await page.screenshot({ path: `${OUT}/pc2-records.png`, fullPage: true });
  await page.goto(BASE + '#/stats');
  await page.waitForSelector('.bars');
  await page.screenshot({ path: `${OUT}/pc3-stats.png`, fullPage: true });
  // 통합지원 회의: 담임이 회의 생성 → 안건 학생 추가 → 결정 사항 → 저장
  await page.goto(BASE + '#/meeting');
  await page.waitForSelector('main .h1');
  await page.getByRole('button', { name: /새 회의/ }).click();
  await page.waitForSelector('input[placeholder^="회의 제목"]');
  await page.locator('input[placeholder^="회의 제목"]').fill('9월 통합지원 회의');
  await page.locator('input[placeholder^="참석자"]').fill('담임, 상담교사');
  await page.getByRole('button', { name: /안건 학생 추가/ }).click();
  await page.waitForSelector('.modal .row');
  const agendaName = (await page.locator('.modal .row .title').first().textContent()).trim();
  await page.locator('.modal .row').first().click();
  await page.waitForFunction(() => document.querySelector('.modal') === null);
  await page.locator('textarea[placeholder^="논의 내용"]').fill('복지실 연계와 보호자 상담을 진행하기로 함.');
  await page.getByRole('button', { name: /결정 사항 추가/ }).click();
  await page.locator('input[placeholder="결정 사항"]').first().fill('복지실 연계 신청');
  await page.locator('input[placeholder="담당자"]').first().fill('담임');
  await page.getByRole('button', { name: '회의 만들기' }).click();
  await page.waitForFunction(() => /9월 통합지원 회의/.test(document.querySelector('main .h1')?.textContent || '') && Array.from(document.querySelectorAll('button.cta')).some(b => b.textContent === '저장'));
  await page.screenshot({ path: `${OUT}/pc4-meeting.png`, fullPage: true, animations: 'disabled' });
  await page.goto(BASE + '#/meeting');
  await page.waitForSelector('main .glass.card');
  const meetingsText = await page.locator('main').textContent();
  check(/9월 통합지원 회의/.test(meetingsText) && /미완료 결정 사항 1건/.test(meetingsText) && new RegExp(agendaName).test(meetingsText), '회의 목록에 새 회의와 미완료 결정 사항 표시');
  // 교과교사(박지훈)는 제목만 보이고 내용은 잠김 (안건 학생이 기계과 3-2 라도 담임이 아님)
  await page.evaluate(() => { localStorage.removeItem('sos.token'); });
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.login-card');
  await page.getByRole('button', { name: /박지훈/ }).click();
  await page.waitForSelector('.stats');
  await page.goto(BASE + '#/meeting');
  await page.waitForSelector('main .glass.card');
  check((await page.locator('main .lockbadge').count()) >= 1 && /미완료 결정 사항 0건/.test(await page.locator('main').textContent()), '교과교사에게 회의 내용은 열람 제한');
  await page.locator('main .glass.card', { hasText: '9월 통합지원 회의' }).first().click();
  await page.waitForSelector('.rec-lock');
  check(true, '열람 제한된 회의 상세 안내');

  // 관리자 화면
  await page.evaluate(() => { localStorage.removeItem('sos.token'); });
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.login-card');
  await page.getByRole('button', { name: /오세라/ }).click();
  await page.waitForSelector('.stats');
  await page.goto(BASE + '#/admin/teachers');
  await page.waitForSelector('main .row .title');
  await page.screenshot({ path: `${OUT}/pc4-admin-teachers.png`, fullPage: true });
  // 승인 대기 탭: 데모 대기 2명 → 일괄 승인
  await page.waitForFunction(() => document.querySelector('.lockbadge') !== null);
  const pendingBefore = (await page.locator('main .row').count());
  check(pendingBefore === 2 && /승인 대기 2/.test(await page.locator('main').textContent()), '승인 대기 교사 2명 표시');
  await page.screenshot({ path: `${OUT}/pc4b-pending.png`, fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /일괄 승인/ }).click();
  await page.waitForSelector('.modal');
  await page.locator('.modal').getByRole('button', { name: '승인', exact: true }).click();
  await page.waitForFunction(() => /승인 대기 0/.test(document.querySelector('main')?.textContent || ''));
  check(true, '대기 중 교사 일괄 승인');
  // 회원가입 → 대기 상태 로그인 차단 → 관리자 선택 승인 → 로그인 성공
  await page.evaluate(() => { localStorage.removeItem('sos.token'); });
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.login-card');
  await page.getByRole('button', { name: '교사 회원가입' }).click();
  await page.waitForSelector('.modal');
  await page.locator('.modal input[placeholder^="아이디"]').fill('newteacher');
  await page.locator('.modal input[placeholder="이름"]').fill('신규교사');
  await page.locator('.modal input[placeholder^="비밀번호 (8자"]').fill('password123');
  await page.locator('.modal input[placeholder="비밀번호 확인"]').fill('password123');
  await page.locator('.modal').getByRole('button', { name: '교과교사' }).click();
  await page.locator('.modal input[placeholder^="수업반"]').fill('기계과 3-1');
  await page.locator('.modal').getByRole('button', { name: '가입 신청' }).click();
  await page.waitForFunction(() => /가입 신청 완료/.test(document.body.textContent));
  await page.locator('.modal').getByRole('button', { name: '확인' }).click();
  await page.locator('input[placeholder^="아이디"]').fill('newteacher');
  await page.locator('input[placeholder="비밀번호"]').fill('password123');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForFunction(() => /승인을 기다리는 중/.test(document.body.textContent));
  check(true, '승인 대기 계정은 로그인 차단');
  await page.getByRole('button', { name: /오세라/ }).click();
  await page.waitForSelector('.stats');
  await page.goto(BASE + '#/admin/teachers');
  await page.waitForFunction(() => /신규교사/.test(document.querySelector('main')?.textContent || ''));
  await page.locator('main .row input[type=checkbox]').first().check();
  await page.getByRole('button', { name: '선택 승인' }).click();
  await page.locator('.modal').getByRole('button', { name: '승인', exact: true }).click();
  await page.waitForFunction(() => /승인 대기 0/.test(document.querySelector('main')?.textContent || ''));
  await page.evaluate(() => { localStorage.removeItem('sos.token'); });
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.login-card');
  await page.locator('input[placeholder^="아이디"]').fill('newteacher');
  await page.locator('input[placeholder="비밀번호"]').fill('password123');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForSelector('.stats');
  check(/신규교사/.test(await page.locator('.sidebar .me').textContent()), '승인 후 로그인 성공');
  await page.evaluate(() => { localStorage.removeItem('sos.token'); });
  await page.goto(BASE + '#/home');
  await page.reload();
  await page.waitForSelector('.login-card');
  await page.getByRole('button', { name: /오세라/ }).click();
  await page.waitForSelector('.stats');
  await page.goto(BASE + '#/admin/students');
  await page.waitForSelector('textarea');
  await page.locator('textarea').fill('기계과 3 2 99 테스트학생');
  await page.getByRole('button', { name: '명단 추가' }).click();
  await page.waitForSelector('.modal');
  await page.locator('.modal').getByRole('button', { name: '추가' }).click();
  await page.waitForFunction(() => /추가 1명/.test(document.body.textContent));
  check(true, '관리자 명단 일괄 추가');
  await page.screenshot({ path: `${OUT}/pc5-admin-students.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log('\n오류 로그:', errors.length ? errors : '없음');
if (errors.length) failures++;
console.log(failures ? `실패 ${failures}건` : '모두 통과');
process.exit(failures ? 1 : 0);
