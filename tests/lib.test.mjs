// 공용 로직(js/lib.js) 단위 테스트 — node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../js/lib.js');

const students = [
  { id: 'a', dept: '기계과', grade: 3, klass: 2, number: 1, name: '학생A', status: '재학' },
  { id: 'b', dept: '기계과', grade: 3, klass: 2, number: 2, name: '학생B', status: '재학' },
  { id: 'c', dept: '전기과', grade: 2, klass: 1, number: 1, name: '학생C', status: '재학' },
  { id: 'd', dept: '전기과', grade: 2, klass: 1, number: 2, name: '학생D', status: '전출' }
];
const homeroom = L.normalizeTeacher({ email: 'hr@s.kr', name: '담임', roles: 'homeroom,subject', homeroom: '기계과 3-2', classes: '전기과 2-1' });
const counsel = L.normalizeTeacher({ email: 'c@s.kr', name: '상담', roles: 'specialist', field: '상담' });
const subject = L.normalizeTeacher({ email: 'sub@s.kr', name: '교과', roles: 'subject', classes: '기계과 3-2' });
const admin = L.normalizeTeacher({ email: 'adm@s.kr', name: '행정', roles: 'admin' });

function rec(over) {
  return L.normalizeRecord(Object.assign({ id: 'r1', studentId: 'a', date: '2026-09-04', time: '08:40', tags: ['welfare'], content: '내용', visibility: 'restricted', author: 'hr@s.kr', version: 1 }, over));
}

test('역할 판정: 담임반 학생은 담임, 수업반은 교과, 그 외 기본 역할', () => {
  assert.equal(L.roleForStudent(homeroom, students[0]), 'homeroom');
  assert.equal(L.roleForStudent(homeroom, students[2]), 'subject');
  assert.equal(L.roleForStudent(counsel, students[0]), 'specialist');
  assert.equal(L.roleLabel('specialist', counsel), '상담교사');
});

test('잠긴 기록 열람: 작성자·담임·전담만, 교과·행정은 불가', () => {
  const r = rec({ author: 'sub@s.kr' });
  assert.equal(L.canViewRestricted(subject, r, students[0]), true, '작성자');
  assert.equal(L.canViewRestricted(homeroom, r, students[0]), true, '담임');
  assert.equal(L.canViewRestricted(counsel, r, students[0]), true, '전담');
  assert.equal(L.canViewRestricted(admin, r, students[0]), false, '행정');
  assert.equal(L.canViewRestricted(homeroom, r, students[2]), false, '다른 반 담임(교과로만 관여)');
});

test('마스킹: 권한 없거나 잠금 상태면 본문 제거, 작성자는 PIN 없이 열람', () => {
  const r = rec();
  const masked = L.maskRecord(r, true, false, 'c@s.kr');
  assert.equal(masked.locked, true); assert.equal(masked.content, ''); assert.equal(masked.canUnlock, true);
  const noRight = L.maskRecord(r, false, true, 'sub@s.kr');
  assert.equal(noRight.locked, true); assert.equal(noRight.canUnlock, false);
  const open = L.maskRecord(r, true, true, 'c@s.kr');
  assert.equal(open.locked, false); assert.equal(open.content, '내용');
  const own = L.maskRecord(r, true, false, 'hr@s.kr');
  assert.equal(own.locked, false, '작성자 본인');
  const pub = L.maskRecord(rec({ visibility: 'all' }), false, false, 'x');
  assert.equal(pub.locked, false);
});

test('수정·삭제 권한: 수정은 작성자만, 삭제는 작성자 또는 관리자', () => {
  const r = rec();
  assert.equal(L.canEditRecord(homeroom, r), true);
  assert.equal(L.canEditRecord(admin, r), false);
  assert.equal(L.canDeleteRecord(admin, r), true);
  assert.equal(L.canDeleteRecord(counsel, r), false);
});

test('기록 검증', () => {
  assert.equal(L.validateRecord(rec()), null);
  assert.match(L.validateRecord(rec({ tags: [] })), /분야/);
  assert.match(L.validateRecord(rec({ content: '  ' })), /내용/);
  assert.match(L.validateRecord(rec({ date: '2026/09/04' })), /날짜/);
  assert.match(L.validateRecord(rec({ time: '8:40' })), /시간/);
});

test('ISO 주차와 날짜 계산', () => {
  assert.equal(L.isoWeekKey('2026-09-04'), '2026-W36');
  assert.equal(L.isoWeekKey('2026-01-01'), '2026-W01');
  assert.equal(L.isoWeekKey('2027-01-01'), '2026-W53');
  assert.equal(L.addDays('2026-09-04', -7), '2026-08-28');
  assert.equal(L.daysBetween('2026-08-21', '2026-09-04'), 14);
});

test('위기 알림: 문제행동 3주 연속, 담임 학급 장기 미기록', () => {
  const today = '2026-09-04';
  const records = [
    rec({ id: '1', studentId: 'a', date: '2026-09-02', tags: ['behavior'], visibility: 'all' }),
    rec({ id: '2', studentId: 'a', date: '2026-08-26', tags: ['behavior'], visibility: 'all' }),
    rec({ id: '3', studentId: 'a', date: '2026-08-19', tags: ['behavior'], visibility: 'all' }),
    rec({ id: '4', studentId: 'b', date: '2026-08-01', tags: ['study'], visibility: 'all' }),
    rec({ id: '5', studentId: 'c', date: '2026-09-02', tags: ['behavior'], visibility: 'all' })
  ];
  const alerts = L.computeAlerts(records, students, homeroom, today);
  assert.deepEqual(alerts.map(a => a.type + ':' + a.studentId).sort(), ['behavior:a', 'noRecord:b']);
  assert.match(alerts.find(a => a.studentId === 'b').text, /34일/);
  // 문제행동 2주만 있으면 알림 없음
  const two = L.computeAlerts(records.slice(0, 2).concat(records[3]), students, homeroom, today);
  assert.equal(two.some(a => a.type === 'behavior'), false);
  // 상담교사는 전교생 범위, 미기록 알림은 없음
  const c = L.computeAlerts(records, students, counsel, today);
  assert.equal(c.some(a => a.type === 'noRecord'), false);
  assert.equal(c.some(a => a.type === 'behavior' && a.studentId === 'a'), true);
});

test('홈 통계: 오늘 기록·2주 미기록·잠금·기록률', () => {
  const today = '2026-09-04';
  const records = [
    rec({ id: '1', studentId: 'a', date: today, visibility: 'restricted' }),
    rec({ id: '2', studentId: 'b', date: '2026-08-01', visibility: 'all' }),
    rec({ id: '3', studentId: 'c', date: today, visibility: 'all' })
  ];
  const st = L.homeStats(records, students, homeroom, today);
  assert.equal(st.todayCount, 1); assert.equal(st.noRecord, 1); assert.equal(st.locked, 1); assert.equal(st.rate, 50); assert.equal(st.scopeSize, 2);
});

test('명단 붙여넣기 파싱: 공백·탭 구분, 머리글 무시, 오류 행 보고', () => {
  const p = L.parseRosterText('과\t학년\t반\t번호\t이름\n기계과\t3\t2\t12\t홍길동\n전기과 2 1 3 김철수 메모\n건축과 x 1 1 오류');
  assert.equal(p.rows.length, 2);
  assert.deepEqual(p.rows[0], { dept: '기계과', grade: 3, klass: 2, number: 12, name: '홍길동', memo: '', status: '재학' });
  assert.equal(p.rows[1].memo, '메모');
  assert.equal(p.errors.length, 1);
});

test('TSV·Markdown 내보내기: 잠긴 기록은 본문 대신 (잠김)', () => {
  const byId = { a: students[0] };
  const tags = { welfare: { id: 'welfare', name: '복지' } };
  const locked = Object.assign(rec({ content: '비밀\t내용' }), { locked: true, content: '' });
  const open = Object.assign(rec({ id: 'r2', visibility: 'all', content: '공개 내용', authorName: '담임' }), { locked: false });
  const tsv = L.buildTSV([locked, open], byId, tags);
  const lines = tsv.split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines.some(l => l.includes('(잠김)')));
  assert.ok(lines.some(l => l.includes('공개 내용')));
  const md = L.buildMarkdown(students[0], [locked, open], tags, '2026-09-04');
  assert.match(md, /^# 학생A 관찰 기록/);
  assert.match(md, /## 복지 \(2건\)/);
  assert.match(md, /담당 교사만 열람 가능한 기록/);
});

test('학생 범위: 담임은 담임반, 교과는 수업반, 전담·관리자는 전체 재학생', () => {
  assert.deepEqual(L.scopeStudents(homeroom, students).map(s => s.id), ['a', 'b']);
  assert.deepEqual(L.scopeStudents(subject, students).map(s => s.id), ['a', 'b']);
  assert.deepEqual(L.scopeStudents(counsel, students).map(s => s.id), ['a', 'b', 'c']);
  assert.deepEqual(L.scopeStudents(admin, students).map(s => s.id), ['a', 'b', 'c']);
});
