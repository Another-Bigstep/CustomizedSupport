/*
 * 데모 모드 가상 서버
 * 실제 백엔드(backend/Code.gs)와 같은 동작 규칙(권한·잠금·버전 검사·중복 ID 무시)을 브라우저 안에서 흉내 낸다.
 * 모든 이름·기록은 가상의 예시 데이터이며 localStorage 에 저장된다.
 */
var SOSMock = (function () {
  'use strict';
  var L = SOSLib;
  var KEY = 'sos.demo.db';
  var DEMO_PIN = '123456';
  var db = null;

  var DEPTS = ['기계과', '전기과', '건축과', '화학공업과'];
  var SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
  var GIV = ['서연', '도현', '하윤', '민준', '지우', '은우', '다인', '윤서', '태오', '나윤', '시우', '지호', '수아', '예준', '하린', '준서', '채원', '우진', '지안', '현우', '소율', '건우', '유나', '성민'];

  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }

  function seed() {
    var students = [];
    var used = {};
    DEPTS.forEach(function (dept) {
      for (var g = 1; g <= 3; g++) for (var k = 1; k <= 2; k++) {
        var n = 12 + rnd(6);
        for (var i = 1; i <= n; i++) {
          var name;
          do { name = pick(SUR) + pick(GIV); } while (used[dept + g + k + name]);
          used[dept + g + k + name] = 1;
          students.push({ id: 's-' + dept + '-' + g + '-' + k + '-' + i, dept: dept, grade: g, klass: k, number: i, name: name, status: '재학', memo: '' });
        }
      }
    });
    var teachers = [
      { email: 'teacher@school.kr', name: '이준형', roles: 'homeroom,subject', homeroom: '기계과 3-2', classes: '전기과 2-1;기계과 3-4;기계과 3-2', field: '' },
      { email: 'counsel@school.kr', name: '최수민', roles: 'specialist', homeroom: '', classes: '', field: '상담' },
      { email: 'health@school.kr', name: '한소영', roles: 'specialist', homeroom: '', classes: '', field: '보건' },
      { email: 'subject@school.kr', name: '박지훈', roles: 'subject', homeroom: '', classes: '기계과 3-2;기계과 3-1;건축과 1-1', field: '' },
      { email: 'admin@school.kr', name: '오세라', roles: 'admin', homeroom: '', classes: '', field: '' }
    ].map(function (t) { return Object.assign(L.normalizeTeacher(t), { hasPin: true, active: true }); });

    var today = L.toDateStr(new Date());
    var records = [];
    var samples = {
      welfare: ['아침 결식 확인됨. 1교시 전 보건실에서 우유를 먹고 안정을 찾음.', '준비물 지원 필요. 실습복 미지참 3회째.', '복지실 연계 안내함. 보호자 연락 예정.'],
      counsel: ['교우관계 어려움을 호소함. 점심시간 상담 진행.', '진로 고민으로 상담 요청. 다음 주 재상담 예정.', '상담교사 연계 완료. 정기 상담 시작.'],
      health: ['두통 호소로 보건실 이용. 30분 휴식 후 복귀.', '컨디션 저하. 체육 활동 참여 어려움.', '복약 여부 확인함.'],
      study: ['수학 보충 이후 태도 개선. 과제 제출률 향상.', '수행평가 자료 정리를 스스로 해냄. 발표에는 여전히 부담을 느낌.', '수업 중 집중도 향상. 질문 횟수 늘어남.'],
      behavior: ['수업 중 반복적으로 자리 이탈. 주의 후 착석.', '지각 2회. 등교 시간 확인 필요.', '동급생과 언쟁. 분리 후 각자 면담.'],
      career: ['실습 후 취업처 문의가 늘어남.', '자격증 실기 준비 중. 방과후 참여.', '진로 상담 요청. 관심 기업 목록 정리.'],
      etc: ['보호자 연락함. 가정 상황 확인.', '담임·교과교사 협의 필요.']
    };
    var cls32 = students.filter(function (s) { return L.classKey(s) === '기계과 3-2'; });
    var others = students.filter(function (s) { return L.classKey(s) !== '기계과 3-2'; });
    function addRec(student, teacher, daysAgo, tag, visibility, text, hour) {
      var d = L.addDays(today, -daysAgo);
      var role = L.roleForStudent(teacher, student);
      records.push(L.normalizeRecord({
        id: L.uuid(), studentId: student.id, date: d, time: L.pad2(hour || (8 + rnd(8))) + ':' + L.pad2(rnd(60)),
        tags: [tag], content: text || pick(samples[tag]), action: '', place: '', visibility: visibility || 'all',
        author: teacher.email, authorName: teacher.name, authorRole: role, authorRoleLabel: L.roleLabel(role, teacher),
        createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(), updatedAt: '', version: 1
      }));
    }
    var T = {}; teachers.forEach(function (t) { T[t.email] = t; });
    // 담임 학급 기록 (최근 60일)
    cls32.forEach(function (s, i) {
      if (i % 5 === 4) return; // 일부 학생은 2주 이상 미기록
      var n = 1 + rnd(4);
      for (var j = 0; j < n; j++) addRec(s, T['teacher@school.kr'], rnd(45), pick(['welfare', 'study', 'career', 'health', 'etc']));
    });
    // 오늘 기록
    addRec(cls32[11] || cls32[0], T['teacher@school.kr'], 0, 'welfare', 'restricted', '아침 결식 확인됨. 1교시 전 보건실에서 우유를 먹고 안정을 찾음. 이번 주 3번째로 가정 연락 필요.', 8);
    addRec(cls32[2] || cls32[1], T['subject@school.kr'], 0, 'study', 'all', '수학 보충 이후 태도 개선.', 10);
    addRec(cls32[5] || cls32[1], T['teacher@school.kr'], 0, 'career', 'all', '실습 후 취업처 문의가 늘어남.', 10);
    addRec(cls32[7] || cls32[1], T['counsel@school.kr'], 0, 'counsel', 'restricted', '가정 내 갈등으로 불안 호소. 정기 상담 시작.', 9);
    addRec(cls32[9] || cls32[1], T['health@school.kr'], 0, 'health', 'restricted', '지속적인 두통. 병원 진료 권유.', 11);
    // 문제행동 3주 연속 학생
    var trouble = cls32[3] || cls32[0];
    [1, 8, 15].forEach(function (d) { addRec(trouble, T['teacher@school.kr'], d, 'behavior'); });
    // 다른 학급 기록
    for (var i = 0; i < 60; i++) {
      var s = pick(others);
      var t = pick([T['subject@school.kr'], T['counsel@school.kr'], T['health@school.kr']]);
      var tag = t.field === '상담' ? 'counsel' : t.field === '보건' ? 'health' : pick(['study', 'behavior', 'career', 'etc']);
      addRec(s, t, rnd(60), tag, t.field ? 'restricted' : 'all');
    }
    return {
      students: students, teachers: teachers, records: records,
      tags: L.DEFAULT_TAGS.slice(), phrases: L.DEFAULT_PHRASES.slice(), settings: Object.assign({}, L.DEFAULT_SETTINGS, { schoolName: '(데모) 천안공업고등학교' }),
      views: [], logs: [], meetings: []
    };
  }

  function loadDb() {
    if (db) return db;
    try { var raw = localStorage.getItem(KEY); if (raw) { db = JSON.parse(raw); if (db && db.students) { db.meetings = db.meetings || []; return db; } } } catch (e) { /* 무시 */ }
    db = seed();
    save();
    return db;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 저장소 부족 */ } }
  function reset() { db = null; try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } loadDb(); }

  function fail(code, message, data) { return { ok: false, code: code, error: message, data: data || null }; }
  function ok(data) { return { ok: true, data: data }; }

  function verify(token, isUnlock) {
    if (!token) return null;
    var parts = String(token).split('|');
    if (parts[0] !== 'demo') return null;
    var exp = Number(parts[2]);
    if (!exp || exp < Date.now()) return null;
    if (!!isUnlock !== (parts[3] === 'u')) return null;
    return parts[1];
  }
  function makeToken(email, ms, isUnlock) { return ['demo', email, Date.now() + ms, isUnlock ? 'u' : 'a'].join('|'); }

  function studentMap() { var m = {}; db.students.forEach(function (s) { m[s.id] = s; }); return m; }
  function findTeacher(email) { return db.teachers.filter(function (t) { return t.email === email; })[0]; }
  function now() { return new Date().toISOString(); }
  function logView(me, action, recordId, studentId, result) { db.views.push({ at: now(), email: me.email, name: me.name, action: action, recordId: recordId, studentId: studentId, result: result }); }

  var seenViews = {};

  function handle(body) {
    loadDb();
    var action = body.action, data = body.data || {};
    var res;
    try { res = route(action, data, body); } catch (e) { res = fail('SERVER_ERROR', String(e && e.message || e)); }
    save();
    // 네트워크 지연 흉내
    return new Promise(function (r) { setTimeout(function () { r(res); }, 120 + Math.random() * 200); });
  }

  function route(action, data, body) {
    if (action === 'ping') return ok({ time: now() });
    if (action === 'login') {
      var t = findTeacher(String(data.email || '').toLowerCase());
      if (!t) return fail('AUTH', '이메일 또는 비밀번호가 올바르지 않습니다. (데모: 아래 계정을 선택하세요)');
      db.logs.push({ at: now(), email: t.email, action: 'login' });
      return ok({ token: makeToken(t.email, 12 * 3600 * 1000), me: t });
    }
    var email = verify(body.token);
    if (!email) return fail('AUTH', '로그인이 필요합니다.');
    var me = findTeacher(email);
    if (!me) return fail('AUTH', '사용할 수 없는 계정입니다.');
    var unlocked = verify(body.unlockToken, true) === email;
    var sm = studentMap();
    var live = function () { return db.records.filter(function (r) { return !r.deleted; }); };
    var mask = function (r) { return L.maskRecord(r, L.canViewRestricted(me, r, sm[r.studentId]), unlocked, me.email); };

    switch (action) {
      case 'me': return ok({ me: me, tags: db.tags, phrases: db.phrases, settings: db.settings, students: db.students, unlocked: unlocked, demo: true });
      case 'changePassword': return ok({ ok: true });
      case 'setPin': if (!/^\d{6}$/.test(data.pin || '')) return fail('BAD_REQUEST', 'PIN은 숫자 6자리여야 합니다.'); me.hasPin = true; return ok({ ok: true });
      case 'unlock':
        if (L.isAdmin(me) && !me.homeroom && !L.hasRole(me, 'specialist') && !L.hasRole(me, 'subject')) return fail('FORBIDDEN', '잠긴 기록을 열람할 수 있는 역할이 아닙니다.');
        if (String(data.pin) !== DEMO_PIN) { logView(me, 'unlock', '', '', '실패'); return fail('AUTH', 'PIN이 올바르지 않습니다. (데모 PIN: 123456)'); }
        logView(me, 'unlock', '', '', '성공');
        var exp = Date.now() + (Number(db.settings.unlockMinutes) || 12) * 60000;
        return ok({ unlockToken: makeToken(email, exp - Date.now(), true), expiresAt: exp });
      case 'students.list': return ok(db.students);
      case 'students.activity': return ok({ activity: L.lastRecordDateByStudent(live()) });
      case 'students.upsert': {
        if (!L.isAdmin(me)) return fail('FORBIDDEN', '관리자만 사용할 수 있습니다.');
        var s = data.student || {};
        if (!s.name || !s.dept || !s.grade || !s.klass) return fail('BAD_REQUEST', '과·학년·반·이름은 필수입니다.');
        var row = { id: s.id || L.uuid(), dept: s.dept, grade: Number(s.grade), klass: Number(s.klass), number: Number(s.number) || '', name: s.name, status: s.status || '재학', memo: s.memo || '' };
        var idx = db.students.findIndex(function (x) { return x.id === row.id; });
        if (idx >= 0) db.students[idx] = row; else db.students.push(row);
        return ok({ student: row });
      }
      case 'students.bulk': {
        if (!L.isAdmin(me)) return fail('FORBIDDEN', '관리자만 사용할 수 있습니다.');
        var parsed = L.parseRosterText(data.text || '');
        if (!parsed.rows.length) return fail('BAD_REQUEST', '추가할 학생이 없습니다. ' + parsed.errors.join(' / '));
        var added = 0, updated = 0;
        parsed.rows.forEach(function (r) {
          var ex = db.students.filter(function (x) { return x.dept === r.dept && +x.grade === r.grade && +x.klass === r.klass && +x.number === r.number; })[0];
          if (ex) { if (ex.name !== r.name || ex.status !== r.status) { Object.assign(ex, r); updated++; } }
          else { db.students.push(Object.assign({ id: L.uuid() }, r)); added++; }
        });
        return ok({ added: added, updated: updated, errors: parsed.errors });
      }
      case 'records.list': {
        var list = live();
        if (data.studentId) list = list.filter(function (r) { return r.studentId === data.studentId; });
        if (data.scope === 'mine') list = list.filter(function (r) { return r.author === me.email; });
        if (data.scope === 'today') { var td = L.toDateStr(new Date()); list = list.filter(function (r) { return r.date === td; }); }
        if (data.from) list = list.filter(function (r) { return r.date >= data.from; });
        if (data.to) list = list.filter(function (r) { return r.date <= data.to; });
        list = L.sortRecordsDesc(list);
        if (data.limit) list = list.slice(0, Number(data.limit));
        var out = list.map(function (r) {
          var m = mask(r);
          if (r.visibility === 'restricted' && !m.locked && r.author !== me.email && !seenViews[me.email + r.id]) {
            seenViews[me.email + r.id] = true; logView(me, 'view', r.id, r.studentId, '열람');
          }
          return m;
        });
        return ok({ records: out, unlocked: unlocked });
      }
      case 'records.get': {
        var one = db.records.filter(function (r) { return r.id === data.id && !r.deleted; })[0];
        if (!one) return fail('NOT_FOUND', '기록을 찾을 수 없습니다.');
        return ok({ record: mask(one) });
      }
      case 'records.create': {
        var rec = L.normalizeRecord(data.record || data);
        var err = L.validateRecord(rec);
        if (err) return fail('BAD_REQUEST', err);
        if (!sm[rec.studentId]) return fail('BAD_REQUEST', '학생을 찾을 수 없습니다.');
        if (db.records.some(function (r) { return r.id === rec.id; })) return ok({ record: rec, duplicate: true });
        var role = L.roleForStudent(me, sm[rec.studentId]);
        Object.assign(rec, { author: me.email, authorName: me.name, authorRole: role, authorRoleLabel: L.roleLabel(role, me), createdAt: now(), updatedAt: now(), version: 1, deleted: false });
        db.records.push(rec);
        return ok({ record: rec, duplicate: false });
      }
      case 'records.update': case 'records.setVisibility': {
        var cur = db.records.filter(function (r) { return r.id === data.id; })[0];
        if (!cur || cur.deleted) return fail('NOT_FOUND', '기록을 찾을 수 없습니다.');
        if (!L.canEditRecord(me, cur)) return fail('FORBIDDEN', '작성자만 수정할 수 있습니다.');
        if (Number(data.version) !== cur.version) return fail('CONFLICT', '다른 사용자가 먼저 수정했습니다. 내용을 확인한 뒤 다시 저장하세요.', { record: cur });
        var patch = action === 'records.setVisibility' ? { visibility: data.visibility } : (data.patch || {});
        ['date', 'time', 'content', 'action', 'place', 'visibility'].forEach(function (k) { if (patch[k] !== undefined) cur[k] = patch[k]; });
        if (patch.tags !== undefined) cur.tags = L.splitList(patch.tags);
        var e2 = L.validateRecord(cur);
        if (e2) return fail('BAD_REQUEST', e2);
        cur.version += 1; cur.updatedAt = now();
        return ok({ record: cur });
      }
      case 'records.delete': {
        var del = db.records.filter(function (r) { return r.id === data.id; })[0];
        if (!del) return fail('NOT_FOUND', '기록을 찾을 수 없습니다.');
        if (!L.canDeleteRecord(me, del)) return fail('FORBIDDEN', '작성자 또는 관리자만 삭제할 수 있습니다.');
        if (Number(data.version) !== del.version) return fail('CONFLICT', '다른 사용자가 먼저 수정했습니다.', { record: del });
        del.deleted = true; del.version += 1; del.updatedAt = now();
        return ok({ id: del.id, version: del.version });
      }
      case 'dashboard': {
        var today = L.toDateStr(new Date());
        var recs = live();
        var scopeIds = {};
        L.scopeStudents(me, db.students).forEach(function (s) { scopeIds[s.id] = true; });
        var semStart = today.slice(0, 4) + (today.slice(5, 7) >= '09' ? '-09-01' : '-03-01');
        return ok({
          today: today,
          stats: L.homeStats(recs, db.students, me, today, db.settings),
          alerts: L.computeAlerts(recs, db.students, me, today, db.settings),
          todayRecords: L.sortRecordsDesc(recs.filter(function (r) { return r.date === today && (scopeIds[r.studentId] || r.author === me.email); })).map(mask),
          recent: L.sortRecordsDesc(recs).slice(0, 50).map(mask),
          distribution: L.tagDistribution(recs.filter(function (r) { return r.date >= semStart && (scopeIds[r.studentId] || L.isAdmin(me) || L.hasRole(me, 'specialist')); }), db.tags)
        });
      }
      case 'teachers.list': if (!L.isAdmin(me)) return fail('FORBIDDEN', '관리자만 사용할 수 있습니다.'); return ok(db.teachers);
      case 'teachers.upsert': {
        if (!L.isAdmin(me)) return fail('FORBIDDEN', '관리자만 사용할 수 있습니다.');
        var nt = L.normalizeTeacher(data.teacher || {});
        if (!nt.email || !nt.name) return fail('BAD_REQUEST', '이메일과 이름은 필수입니다.');
        if (!nt.roles.length) return fail('BAD_REQUEST', '역할을 하나 이상 선택하세요.');
        var ti = db.teachers.findIndex(function (x) { return x.email === nt.email; });
        var temp = null;
        if (ti >= 0) { nt.hasPin = db.teachers[ti].hasPin; db.teachers[ti] = nt; } else { temp = 'demo1234'; db.teachers.push(nt); }
        return ok({ teacher: nt, tempPassword: temp });
      }
      case 'teachers.resetPassword': if (!L.isAdmin(me)) return fail('FORBIDDEN', '관리자만 사용할 수 있습니다.'); return ok({ tempPassword: 'demo' + rnd(9000 + 1000) });
      case 'tags.save': if (!L.isAdmin(me)) return fail('FORBIDDEN', '관리자만 사용할 수 있습니다.'); db.tags = (data.tags || []).map(function (t, i) { return { id: t.id, name: t.name, color: t.color || 'etc', order: i + 1, active: t.active !== false }; }); return ok({ tags: db.tags });
      case 'phrases.save': if (!L.isAdmin(me)) return fail('FORBIDDEN', '관리자만 사용할 수 있습니다.'); db.phrases = (data.phrases || []).map(function (p, i) { return { id: p.id || L.uuid(), tagId: p.tagId, text: p.text, order: i + 1 }; }); return ok({ phrases: db.phrases });
      case 'settings.save': if (!L.isAdmin(me)) return fail('FORBIDDEN', '관리자만 사용할 수 있습니다.'); Object.assign(db.settings, data.settings || {}); return ok({ settings: db.settings });
      case 'views.list': {
        var v = db.views.slice().reverse();
        if (!L.isAdmin(me)) { var mine = {}; db.records.forEach(function (r) { if (r.author === me.email) mine[r.id] = true; }); v = v.filter(function (x) { return x.email === me.email || mine[x.recordId]; }); }
        return ok({ views: v.slice(0, Number(data.limit) || 100) });
      }
      case 'meetings.list': return ok({ meetings: db.meetings.filter(function (m) { return !m.deleted; }).map(function (m) { return L.maskMeeting(m, L.canViewMeeting(me, m, sm)); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }) });
      case 'meetings.get': {
        var mg = db.meetings.filter(function (m) { return m.id === data.id && !m.deleted; })[0];
        if (!mg) return fail('NOT_FOUND', '회의를 찾을 수 없습니다.');
        var cv = L.canViewMeeting(me, mg, sm);
        if (cv && mg.createdBy !== me.email && !seenViews[me.email + mg.id]) { seenViews[me.email + mg.id] = true; logView(me, 'meeting', mg.id, '', '열람'); }
        return ok({ meeting: L.maskMeeting(mg, cv), canEdit: L.canEditMeeting(me, mg) });
      }
      case 'meetings.save': {
        var inp = L.normalizeMeeting(data.meeting || {});
        var me1 = L.validateMeeting(inp);
        if (me1) return fail('BAD_REQUEST', me1);
        var curM = db.meetings.filter(function (m) { return m.id === inp.id; })[0];
        if (!curM) {
          Object.assign(inp, { createdBy: me.email, createdByName: me.name, createdAt: now(), updatedAt: now(), version: 1, deleted: false });
          db.meetings.push(inp); return ok({ meeting: inp });
        }
        if (curM.deleted) return fail('NOT_FOUND', '삭제된 회의입니다.');
        if (!L.canEditMeeting(me, curM)) return fail('FORBIDDEN', '작성자·전담·관리자만 수정할 수 있습니다.');
        if (Number(data.meeting.version) !== curM.version) return fail('CONFLICT', '다른 사용자가 먼저 수정했습니다. 최신 내용을 확인한 뒤 다시 저장하세요.', { meeting: curM });
        ['date', 'title', 'attendees', 'status', 'studentIds', 'notes', 'decisions'].forEach(function (k) { curM[k] = inp[k]; });
        curM.version += 1; curM.updatedAt = now();
        return ok({ meeting: curM });
      }
      case 'meetings.delete': {
        var dm = db.meetings.filter(function (m) { return m.id === data.id; })[0];
        if (!dm) return fail('NOT_FOUND', '회의를 찾을 수 없습니다.');
        if (!L.canEditMeeting(me, dm)) return fail('FORBIDDEN', '작성자·전담·관리자만 삭제할 수 있습니다.');
        dm.deleted = true; dm.version += 1; return ok({ id: dm.id });
      }
      case 'export.log': db.logs.push({ at: now(), email: me.email, action: 'export', target: data.scope }); return ok({ ok: true });
      default: return fail('UNKNOWN_ACTION', '알 수 없는 요청입니다: ' + action);
    }
  }

  return { handle: handle, reset: reset, DEMO_PIN: DEMO_PIN, accounts: function () { return loadDb().teachers; } };
})();
