/*
 * 학생맞춤통합지원 관찰관리 — Google Apps Script 백엔드
 *
 * 배포 방법은 docs/배포안내.md 참고.
 * 이 파일은 js/lib.js(SOSLib)와 함께 같은 프로젝트에 있어야 한다.
 * (backend/dist/Code.gs 는 두 파일을 합친 붙여넣기용 파일)
 */

var SHEETS = {
  students: '학생', records: '관찰기록', tags: '태그', phrases: '문장',
  teachers: '교사', views: '열람로그', logs: '로그', settings: '설정', meetings: '회의'
};

var HEADERS = {
  students: ['id', 'dept', 'grade', 'klass', 'number', 'name', 'status', 'memo', 'updatedAt', 'updatedBy'],
  records: ['id', 'studentId', 'date', 'time', 'tags', 'content', 'action', 'place', 'visibility',
    'author', 'authorName', 'authorRole', 'authorRoleLabel', 'createdAt', 'updatedAt', 'version', 'deleted'],
  tags: ['id', 'name', 'color', 'order', 'active'],
  phrases: ['id', 'tagId', 'text', 'order'],
  teachers: ['email', 'name', 'roles', 'homeroom', 'classes', 'field', 'passwordHash', 'pinHash', 'salt',
    'active', 'mustChangePassword', 'createdAt'],
  views: ['at', 'email', 'name', 'action', 'recordId', 'studentId', 'result'],
  logs: ['at', 'email', 'action', 'target', 'detail'],
  settings: ['key', 'value'],
  meetings: ['id', 'date', 'title', 'attendees', 'status', 'studentIds', 'notes', 'decisions', 'createdBy', 'createdByName', 'createdAt', 'updatedAt', 'version', 'deleted']
};

var HEADER_LABELS = {
  students: ['ID', '과', '학년', '반', '번호', '이름', '상태', '메모', '수정일시', '수정자'],
  records: ['ID', '학생ID', '날짜', '시간', '분야', '관찰내용', '조치·후속', '장소', '공개범위',
    '작성자', '작성자이름', '작성자역할', '역할표시', '작성일시', '수정일시', '버전', '삭제'],
  tags: ['ID', '이름', '색상', '순서', '사용'],
  phrases: ['ID', '분야ID', '문장', '순서'],
  teachers: ['이메일', '이름', '역할', '담임반', '수업반', '전담분야', '비밀번호해시', 'PIN해시', '솔트',
    '사용', '비밀번호변경필요', '등록일시'],
  views: ['시각', '이메일', '이름', '동작', '기록ID', '학생ID', '결과'],
  logs: ['시각', '이메일', '동작', '대상', '상세'],
  settings: ['키', '값'],
  meetings: ['ID', '날짜', '제목', '참석자', '상태', '안건학생ID', '회의록', '결정사항(JSON)', '작성자', '작성자이름', '작성일시', '수정일시', '버전', '삭제']
};

var TOKEN_HOURS = 12;
var LOCK_WAIT_MS = 10000;
var MAX_FAILS = 5;
var FAIL_WINDOW_SEC = 600;
var HASH_ROUNDS = 1000;

// =====================================================================
// 최초 설정: Apps Script 편집기에서 setup() 을 한 번 실행한다.
// =====================================================================
function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (key) {
    var name = SHEETS[key];
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[key].length).setValues([HEADER_LABELS[key]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());

  if (readAll('tags').length === 0) {
    SOSLib.DEFAULT_TAGS.forEach(function (t) { appendObject('tags', t); });
  }
  if (readAll('phrases').length === 0) {
    SOSLib.DEFAULT_PHRASES.forEach(function (p) { appendObject('phrases', p); });
  }
  if (readAll('settings').length === 0) {
    Object.keys(SOSLib.DEFAULT_SETTINGS).forEach(function (k) {
      appendObject('settings', { key: k, value: SOSLib.DEFAULT_SETTINGS[k] });
    });
  }
  var teachers = readAll('teachers');
  if (teachers.length === 0) {
    var email = Session.getEffectiveUser().getEmail();
    var salt = Utilities.getUuid();
    var tempPw = 'admin' + String(Math.floor(Math.random() * 9000) + 1000);
    appendObject('teachers', {
      email: email, name: '관리자', roles: 'admin', homeroom: '', classes: '', field: '',
      passwordHash: hashSecret(tempPw, salt), pinHash: '', salt: salt,
      active: 'Y', mustChangePassword: 'Y', createdAt: nowIso()
    });
    Logger.log('관리자 계정이 생성되었습니다. 이메일: ' + email + ' / 임시 비밀번호: ' + tempPw);
    Logger.log('첫 로그인 후 비밀번호를 반드시 변경하세요.');
  }
  Logger.log('설정 완료. 이제 "배포 > 새 배포 > 웹 앱" 으로 배포하세요.');
}

// =====================================================================
// HTTP 진입점
// =====================================================================
function doGet() {
  return jsonOut({ ok: true, service: '학생맞춤통합지원 관찰관리', time: nowIso() });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, code: 'BAD_REQUEST', error: '요청 형식이 올바르지 않습니다.' });
  }
  try {
    var result = route(req);
    return jsonOut({ ok: true, data: result });
  } catch (err) {
    if (err && err.code) return jsonOut({ ok: false, code: err.code, error: err.message, data: err.data || null });
    return jsonOut({ ok: false, code: 'SERVER_ERROR', error: String(err && err.message || err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail(code, message, data) {
  var e = new Error(message);
  e.code = code;
  e.data = data;
  return e;
}

function route(req) {
  var action = req.action;
  var data = req.data || {};
  if (action === 'login') return login(data);
  if (action === 'ping') return { time: nowIso() };

  var me = requireAuth(req.token);
  var unlocked = isUnlocked(req.unlockToken, me.email);
  var ctx = { me: me, unlocked: unlocked, unlockToken: req.unlockToken };

  switch (action) {
    case 'me': return bootstrap(ctx);
    case 'changePassword': return changePassword(ctx, data);
    case 'setPin': return setPin(ctx, data);
    case 'unlock': return unlock(ctx, data);
    case 'students.list': return listStudents(ctx);
    case 'students.activity': return studentActivity(ctx);
    case 'students.upsert': return upsertStudent(ctx, data);
    case 'students.bulk': return bulkStudents(ctx, data);
    case 'records.list': return listRecords(ctx, data);
    case 'records.get': return getRecord(ctx, data);
    case 'records.create': return createRecord(ctx, data);
    case 'records.update': return updateRecord(ctx, data);
    case 'records.delete': return deleteRecord(ctx, data);
    case 'records.setVisibility': return setVisibility(ctx, data);
    case 'dashboard': return dashboard(ctx, data);
    case 'teachers.list': return listTeachers(ctx);
    case 'teachers.upsert': return upsertTeacher(ctx, data);
    case 'teachers.resetPassword': return resetPassword(ctx, data);
    case 'tags.save': return saveTags(ctx, data);
    case 'phrases.save': return savePhrases(ctx, data);
    case 'settings.save': return saveSettings(ctx, data);
    case 'views.list': return listViews(ctx, data);
    case 'meetings.list': return listMeetings(ctx);
    case 'meetings.get': return getMeeting(ctx, data);
    case 'meetings.save': return saveMeeting(ctx, data);
    case 'meetings.delete': return deleteMeeting(ctx, data);
    case 'export.log': return logAction(ctx.me.email, 'export', data.scope || '', data.detail || '');
    default: throw fail('UNKNOWN_ACTION', '알 수 없는 요청입니다: ' + action);
  }
}

// =====================================================================
// 인증
// =====================================================================
function secret() { return PropertiesService.getScriptProperties().getProperty('SECRET'); }

function b64url(bytesOrStr) {
  return Utilities.base64EncodeWebSafe(bytesOrStr);
}

function sign(payload) {
  var body = b64url(Utilities.newBlob(JSON.stringify(payload)).getBytes());
  var sig = b64url(Utilities.computeHmacSha256Signature(body, secret()));
  return body + '.' + sig;
}

function verifyToken(token) {
  if (!token || token.indexOf('.') < 0) return null;
  var parts = token.split('.');
  var expect = b64url(Utilities.computeHmacSha256Signature(parts[0], secret()));
  if (expect !== parts[1]) return null;
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (e) { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function hashSecret(value, salt) {
  var cur = salt + ':' + value;
  for (var i = 0; i < HASH_ROUNDS; i++) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cur, Utilities.Charset.UTF_8);
    cur = bytes.map(function (b) { var h = (b & 0xff).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
  }
  return cur;
}

function failKey(kind, email) { return 'fail:' + kind + ':' + email; }

function checkFails(kind, email) {
  var n = Number(CacheService.getScriptCache().get(failKey(kind, email)) || 0);
  if (n >= MAX_FAILS) throw fail('LOCKED', '실패가 반복되어 10분간 잠겼습니다. 잠시 후 다시 시도하세요.');
}

function recordFail(kind, email) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(failKey(kind, email)) || 0) + 1;
  cache.put(failKey(kind, email), String(n), FAIL_WINDOW_SEC);
  return MAX_FAILS - n;
}

function clearFails(kind, email) { CacheService.getScriptCache().remove(failKey(kind, email)); }

function findTeacher(email) {
  email = String(email || '').trim().toLowerCase();
  var rows = readAll('teachers');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].email).toLowerCase() === email) return { row: rows[i], index: i + 2 };
  }
  return null;
}

function publicTeacher(row) {
  var t = SOSLib.normalizeTeacher({
    email: row.email, name: row.name, roles: row.roles, homeroom: row.homeroom, classes: row.classes,
    field: row.field, active: isYes(row.active), hasPin: !!row.pinHash, mustChangePassword: isYes(row.mustChangePassword)
  });
  return t;
}

function login(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var password = String(data.password || '');
  if (!email || !password) throw fail('BAD_REQUEST', '이메일과 비밀번호를 입력하세요.');
  checkFails('login', email);
  var found = findTeacher(email);
  if (!found || !isYes(found.row.active) || hashSecret(password, found.row.salt) !== found.row.passwordHash) {
    var left = recordFail('login', email);
    throw fail('AUTH', '이메일 또는 비밀번호가 올바르지 않습니다.' + (left > 0 ? ' (남은 시도 ' + left + '회)' : ''));
  }
  clearFails('login', email);
  var token = sign({ e: email, exp: Date.now() + TOKEN_HOURS * 3600 * 1000, n: Utilities.getUuid().slice(0, 8) });
  logAction(email, 'login', '', '');
  return { token: token, me: publicTeacher(found.row) };
}

function requireAuth(token) {
  var payload = verifyToken(token);
  if (!payload || payload.u) throw fail('AUTH', '로그인이 필요합니다.');
  var found = findTeacher(payload.e);
  if (!found || !isYes(found.row.active)) throw fail('AUTH', '사용할 수 없는 계정입니다.');
  var me = publicTeacher(found.row);
  me._row = found.row;
  me._index = found.index;
  return me;
}

function isUnlocked(unlockToken, email) {
  var p = verifyToken(unlockToken);
  return !!(p && p.u && p.e === email);
}

function changePassword(ctx, data) {
  var row = ctx.me._row;
  if (hashSecret(String(data.oldPassword || ''), row.salt) !== row.passwordHash) throw fail('AUTH', '현재 비밀번호가 올바르지 않습니다.');
  var pw = String(data.newPassword || '');
  if (pw.length < 8) throw fail('BAD_REQUEST', '새 비밀번호는 8자 이상이어야 합니다.');
  updateRowFields('teachers', ctx.me._index, { passwordHash: hashSecret(pw, row.salt), mustChangePassword: 'N' });
  logAction(ctx.me.email, 'changePassword', '', '');
  return { ok: true };
}

function setPin(ctx, data) {
  var row = ctx.me._row;
  if (hashSecret(String(data.password || ''), row.salt) !== row.passwordHash) throw fail('AUTH', '비밀번호가 올바르지 않습니다.');
  var pin = String(data.pin || '');
  if (!/^\d{6}$/.test(pin)) throw fail('BAD_REQUEST', 'PIN은 숫자 6자리여야 합니다.');
  updateRowFields('teachers', ctx.me._index, { pinHash: hashSecret(pin, row.salt) });
  logAction(ctx.me.email, 'setPin', '', '');
  return { ok: true };
}

function unlock(ctx, data) {
  var row = ctx.me._row;
  var me = ctx.me;
  var eligible = !!me.homeroom || SOSLib.hasRole(me, 'specialist') || SOSLib.hasRole(me, 'subject') || SOSLib.hasRole(me, 'homeroom');
  if (!eligible) throw fail('FORBIDDEN', '잠긴 기록을 열람할 수 있는 역할이 아닙니다.');
  if (!row.pinHash) throw fail('NO_PIN', '먼저 설정에서 PIN을 등록하세요.');
  checkFails('pin', me.email);
  if (hashSecret(String(data.pin || ''), row.salt) !== row.pinHash) {
    var left = recordFail('pin', me.email);
    appendObject('views', { at: nowIso(), email: me.email, name: me.name, action: 'unlock', recordId: '', studentId: '', result: '실패' });
    throw fail('AUTH', 'PIN이 올바르지 않습니다.' + (left > 0 ? ' (남은 시도 ' + left + '회)' : ''));
  }
  clearFails('pin', me.email);
  var minutes = Number(getSettings().unlockMinutes) || 12;
  var exp = Date.now() + minutes * 60 * 1000;
  appendObject('views', { at: nowIso(), email: me.email, name: me.name, action: 'unlock', recordId: '', studentId: '', result: '성공' });
  return { unlockToken: sign({ e: me.email, u: 1, exp: exp }), expiresAt: exp };
}

// =====================================================================
// 조회
// =====================================================================
function bootstrap(ctx) {
  return {
    me: ctx.me,
    tags: readTags(),
    phrases: readAll('phrases').map(function (p) { return { id: p.id, tagId: p.tagId, text: p.text, order: Number(p.order) || 0 }; }),
    settings: getSettings(),
    students: listStudents(ctx),
    unlocked: ctx.unlocked
  };
}

function readTags() {
  return readAll('tags').map(function (t) {
    return { id: t.id, name: t.name, color: t.color || 'etc', order: Number(t.order) || 0, active: isYes(t.active) || t.active === true || t.active === '' };
  }).sort(function (a, b) { return a.order - b.order; });
}

function getSettings() {
  var s = Object.assign({}, SOSLib.DEFAULT_SETTINGS);
  readAll('settings').forEach(function (r) { if (r.key) s[r.key] = r.value; });
  return s;
}

function listStudents(ctx) {
  return readAll('students').filter(function (s) { return s.id; }).map(function (s) {
    return { id: s.id, dept: s.dept, grade: Number(s.grade) || s.grade, klass: Number(s.klass) || s.klass,
      number: Number(s.number) || s.number, name: s.name, status: s.status || '재학', memo: s.memo || '' };
  });
}

// 학생별 마지막 기록일 (명단 화면용, 본문은 보내지 않는다)
function studentActivity(ctx) {
  return { activity: SOSLib.lastRecordDateByStudent(readRecords()) };
}

function studentMap() {
  var m = {};
  listStudents().forEach(function (s) { m[s.id] = s; });
  return m;
}

function readRecords() {
  return readAll('records').filter(function (r) { return r.id; }).map(function (r) {
    var n = SOSLib.normalizeRecord(r);
    n.date = asDateStr(r.date);
    n.time = asTimeStr(r.time);
    return n;
  });
}

function asDateStr(v) {
  if (v instanceof Date) return SOSLib.toDateStr(v);
  return String(v || '').slice(0, 10);
}

function asTimeStr(v) {
  if (v instanceof Date) return SOSLib.toTimeStr(v);
  var s = String(v || '');
  var m = /(\d{1,2}):(\d{2})/.exec(s);
  return m ? SOSLib.pad2(+m[1]) + ':' + m[2] : s;
}

// 기록 목록: studentId / scope(today|mine|recent|all) / from / to / limit
function listRecords(ctx, data) {
  var me = ctx.me;
  var all = readRecords().filter(function (r) { return !r.deleted; });
  var students = studentMap();
  var list = all;
  if (data.studentId) list = list.filter(function (r) { return r.studentId === data.studentId; });
  if (data.scope === 'mine') list = list.filter(function (r) { return r.author === me.email; });
  if (data.scope === 'today') { var today = SOSLib.toDateStr(new Date()); list = list.filter(function (r) { return r.date === today; }); }
  if (data.from) list = list.filter(function (r) { return r.date >= data.from; });
  if (data.to) list = list.filter(function (r) { return r.date <= data.to; });
  list = SOSLib.sortRecordsDesc(list);
  if (data.limit) list = list.slice(0, Number(data.limit));

  var viewLogs = [];
  var cache = CacheService.getScriptCache();
  var out = list.map(function (r) {
    var canView = SOSLib.canViewRestricted(me, r, students[r.studentId]);
    var masked = SOSLib.maskRecord(r, canView, ctx.unlocked, me.email);
    if (r.visibility === 'restricted' && !masked.locked && r.author !== me.email) {
      var key = 'view:' + me.email + ':' + r.id;
      if (!cache.get(key)) {
        cache.put(key, '1', 600);
        viewLogs.push([nowIso(), me.email, me.name, 'view', r.id, r.studentId, '열람']);
      }
    }
    return masked;
  });
  if (viewLogs.length) appendRows('views', viewLogs);
  return { records: out, unlocked: ctx.unlocked };
}

function getRecord(ctx, data) {
  var found = loadRecordRow(data.id);
  var r = found.record;
  if (r.deleted) throw fail('NOT_FOUND', '삭제된 기록입니다.');
  var student = studentMap()[r.studentId];
  return { record: SOSLib.maskRecord(r, SOSLib.canViewRestricted(ctx.me, r, student), ctx.unlocked, ctx.me.email) };
}

function dashboard(ctx) {
  var me = ctx.me;
  var today = SOSLib.toDateStr(new Date());
  var records = readRecords().filter(function (r) { return !r.deleted; });
  var students = listStudents();
  var settings = getSettings();
  var stats = SOSLib.homeStats(records, students, me, today, settings);
  var alerts = SOSLib.computeAlerts(records, students, me, today, settings);
  var sm = {};
  students.forEach(function (s) { sm[s.id] = s; });
  var scopeIds = {};
  SOSLib.scopeStudents(me, students).forEach(function (s) { scopeIds[s.id] = true; });
  var todayList = SOSLib.sortRecordsDesc(records.filter(function (r) { return r.date === today && (scopeIds[r.studentId] || r.author === me.email); }))
    .map(function (r) { return SOSLib.maskRecord(r, SOSLib.canViewRestricted(me, r, sm[r.studentId]), ctx.unlocked, me.email); });
  var recent = SOSLib.sortRecordsDesc(records).slice(0, 50)
    .map(function (r) { return SOSLib.maskRecord(r, SOSLib.canViewRestricted(me, r, sm[r.studentId]), ctx.unlocked, me.email); });
  var semesterStart = today.slice(0, 4) + (today.slice(5, 7) >= '09' ? '-09-01' : '-03-01');
  var dist = SOSLib.tagDistribution(records.filter(function (r) { return r.date >= semesterStart && (scopeIds[r.studentId] || SOSLib.isAdmin(me) || SOSLib.hasRole(me, 'specialist')); }), readTags());
  return { today: today, stats: stats, alerts: alerts, todayRecords: todayList, recent: recent, distribution: dist };
}

// =====================================================================
// 기록 쓰기 (잠금 + 버전 검사 + 중복 ID 무시)
// =====================================================================
function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) throw fail('BUSY', '저장 대기 시간이 초과되었습니다. 자동으로 다시 시도합니다.');
  try { return fn(); } finally { lock.releaseLock(); }
}

function createRecord(ctx, data) {
  var me = ctx.me;
  var rec = SOSLib.normalizeRecord(data.record || data);
  var err = SOSLib.validateRecord(rec);
  if (err) throw fail('BAD_REQUEST', err);
  var student = studentMap()[rec.studentId];
  if (!student) throw fail('BAD_REQUEST', '학생을 찾을 수 없습니다.');
  var roleKey = SOSLib.roleForStudent(me, student);
  rec.author = me.email;
  rec.authorName = me.name;
  rec.authorRole = roleKey;
  rec.authorRoleLabel = SOSLib.roleLabel(roleKey, me);
  rec.createdAt = nowIso();
  rec.updatedAt = rec.createdAt;
  rec.version = 1;
  rec.deleted = false;
  return withLock(function () {
    var existing = findRowIndex('records', rec.id);
    if (existing) return { record: rec, duplicate: true };
    appendObject('records', recordToRow(rec));
    return { record: rec, duplicate: false };
  });
}

function recordToRow(rec) {
  return Object.assign({}, rec, { tags: rec.tags.join(','), deleted: rec.deleted ? 'Y' : 'N' });
}

function loadRecordRow(id) {
  var idx = findRowIndex('records', id);
  if (!idx) throw fail('NOT_FOUND', '기록을 찾을 수 없습니다.');
  var sh = sheet('records');
  var values = sh.getRange(idx, 1, 1, HEADERS.records.length).getValues()[0];
  var obj = {};
  HEADERS.records.forEach(function (h, i) { obj[h] = values[i]; });
  var rec = SOSLib.normalizeRecord(obj);
  rec.date = asDateStr(obj.date);
  rec.time = asTimeStr(obj.time);
  return { index: idx, record: rec };
}

function assertVersion(rec, version) {
  if (Number(version) !== rec.version) {
    throw fail('CONFLICT', '다른 사용자가 먼저 수정했습니다. 내용을 확인한 뒤 다시 저장하세요.', { record: rec });
  }
}

function updateRecord(ctx, data) {
  var me = ctx.me;
  return withLock(function () {
    var found = loadRecordRow(data.id);
    var rec = found.record;
    if (rec.deleted) throw fail('NOT_FOUND', '삭제된 기록입니다.');
    if (!SOSLib.canEditRecord(me, rec)) throw fail('FORBIDDEN', '작성자만 수정할 수 있습니다.');
    assertVersion(rec, data.version);
    var patch = data.patch || {};
    ['date', 'time', 'content', 'action', 'place', 'visibility'].forEach(function (k) { if (patch[k] !== undefined) rec[k] = patch[k]; });
    if (patch.tags !== undefined) rec.tags = SOSLib.splitList(patch.tags);
    rec.visibility = rec.visibility === 'restricted' ? 'restricted' : 'all';
    var err = SOSLib.validateRecord(rec);
    if (err) throw fail('BAD_REQUEST', err);
    rec.version += 1;
    rec.updatedAt = nowIso();
    writeObject('records', found.index, recordToRow(rec));
    logAction(me.email, 'update', rec.id, '');
    return { record: rec };
  });
}

function deleteRecord(ctx, data) {
  var me = ctx.me;
  return withLock(function () {
    var found = loadRecordRow(data.id);
    var rec = found.record;
    if (!SOSLib.canDeleteRecord(me, rec)) throw fail('FORBIDDEN', '작성자 또는 관리자만 삭제할 수 있습니다.');
    assertVersion(rec, data.version);
    rec.deleted = true;
    rec.version += 1;
    rec.updatedAt = nowIso();
    writeObject('records', found.index, recordToRow(rec));
    logAction(me.email, 'delete', rec.id, '');
    return { id: rec.id, version: rec.version };
  });
}

function setVisibility(ctx, data) {
  return updateRecord(ctx, { id: data.id, version: data.version, patch: { visibility: data.visibility } });
}

// =====================================================================
// 통합지원 회의
// =====================================================================
function readMeetings() {
  return readAll('meetings').filter(function (m) { return m.id; }).map(function (m) {
    var n = SOSLib.normalizeMeeting(m);
    n.date = asDateStr(m.date);
    return n;
  });
}

function listMeetings(ctx) {
  var sm = studentMap();
  var list = readMeetings().filter(function (m) { return !m.deleted; })
    .map(function (m) { return SOSLib.maskMeeting(m, SOSLib.canViewMeeting(ctx.me, m, sm)); })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  return { meetings: list };
}

function getMeeting(ctx, data) {
  var m = readMeetings().filter(function (x) { return x.id === data.id && !x.deleted; })[0];
  if (!m) throw fail('NOT_FOUND', '회의를 찾을 수 없습니다.');
  var sm = studentMap();
  var canView = SOSLib.canViewMeeting(ctx.me, m, sm);
  if (canView && m.createdBy !== ctx.me.email) {
    var key = 'mview:' + ctx.me.email + ':' + m.id;
    var cache = CacheService.getScriptCache();
    if (!cache.get(key)) { cache.put(key, '1', 600); appendObject('views', { at: nowIso(), email: ctx.me.email, name: ctx.me.name, action: 'meeting', recordId: m.id, studentId: '', result: '열람' }); }
  }
  return { meeting: SOSLib.maskMeeting(m, canView), canEdit: SOSLib.canEditMeeting(ctx.me, m) };
}

function meetingToRow(m) {
  return Object.assign({}, m, { studentIds: m.studentIds.join(','), decisions: JSON.stringify(m.decisions), deleted: m.deleted ? 'Y' : 'N' });
}

function saveMeeting(ctx, data) {
  var me = ctx.me;
  var input = SOSLib.normalizeMeeting(data.meeting || {});
  var err = SOSLib.validateMeeting(input);
  if (err) throw fail('BAD_REQUEST', err);
  return withLock(function () {
    var idx = findRowIndex('meetings', input.id);
    if (!idx) {
      input.createdBy = me.email; input.createdByName = me.name; input.createdAt = nowIso(); input.updatedAt = input.createdAt; input.version = 1; input.deleted = false;
      appendObject('meetings', meetingToRow(input));
      logAction(me.email, 'meeting.create', input.id, input.title);
      return { meeting: input };
    }
    var cur = readMeetings().filter(function (x) { return x.id === input.id; })[0];
    if (!cur || cur.deleted) throw fail('NOT_FOUND', '삭제된 회의입니다.');
    if (!SOSLib.canEditMeeting(me, cur)) throw fail('FORBIDDEN', '작성자·전담·관리자만 수정할 수 있습니다.');
    if (Number(data.meeting.version) !== cur.version) throw fail('CONFLICT', '다른 사용자가 먼저 수정했습니다. 최신 내용을 확인한 뒤 다시 저장하세요.', { meeting: cur });
    ['date', 'title', 'attendees', 'status', 'studentIds', 'notes', 'decisions'].forEach(function (k) { cur[k] = input[k]; });
    cur.version += 1; cur.updatedAt = nowIso();
    writeObject('meetings', idx, meetingToRow(cur));
    logAction(me.email, 'meeting.update', cur.id, cur.title);
    return { meeting: cur };
  });
}

function deleteMeeting(ctx, data) {
  return withLock(function () {
    var idx = findRowIndex('meetings', data.id);
    var cur = readMeetings().filter(function (x) { return x.id === data.id; })[0];
    if (!idx || !cur) throw fail('NOT_FOUND', '회의를 찾을 수 없습니다.');
    if (!SOSLib.canEditMeeting(ctx.me, cur)) throw fail('FORBIDDEN', '작성자·전담·관리자만 삭제할 수 있습니다.');
    cur.deleted = true; cur.version += 1; cur.updatedAt = nowIso();
    writeObject('meetings', idx, meetingToRow(cur));
    logAction(ctx.me.email, 'meeting.delete', cur.id, '');
    return { id: cur.id };
  });
}

// =====================================================================
// 관리자 기능
// =====================================================================
function requireAdmin(ctx) {
  if (!SOSLib.isAdmin(ctx.me)) throw fail('FORBIDDEN', '관리자만 사용할 수 있습니다.');
}

function upsertStudent(ctx, data) {
  requireAdmin(ctx);
  var s = data.student || {};
  if (!s.name || !s.dept || !s.grade || !s.klass) throw fail('BAD_REQUEST', '과·학년·반·이름은 필수입니다.');
  return withLock(function () {
    var row = { id: s.id || SOSLib.uuid(), dept: s.dept, grade: Number(s.grade), klass: Number(s.klass), number: Number(s.number) || '',
      name: s.name, status: s.status || '재학', memo: s.memo || '', updatedAt: nowIso(), updatedBy: ctx.me.email };
    var idx = s.id ? findRowIndex('students', s.id) : 0;
    if (idx) writeObject('students', idx, row); else appendObject('students', row);
    logAction(ctx.me.email, 'student.upsert', row.id, row.name);
    return { student: row };
  });
}

function bulkStudents(ctx, data) {
  requireAdmin(ctx);
  var parsed = SOSLib.parseRosterText(data.text || '');
  if (!parsed.rows.length) throw fail('BAD_REQUEST', '추가할 학생이 없습니다. ' + parsed.errors.join(' / '));
  return withLock(function () {
    var existing = listStudents();
    var key = function (s) { return [s.dept, s.grade, s.klass, s.number].join('|'); };
    var byKey = {};
    existing.forEach(function (s) { byKey[key(s)] = s; });
    var added = 0, updated = 0, rows = [];
    parsed.rows.forEach(function (r) {
      var k = key(r);
      if (byKey[k]) {
        if (byKey[k].name !== r.name || byKey[k].status !== r.status) {
          var idx = findRowIndex('students', byKey[k].id);
          writeObject('students', idx, Object.assign({}, byKey[k], r, { updatedAt: nowIso(), updatedBy: ctx.me.email }));
          updated++;
        }
      } else {
        rows.push(Object.assign({ id: SOSLib.uuid() }, r, { updatedAt: nowIso(), updatedBy: ctx.me.email }));
        added++;
      }
    });
    rows.forEach(function (r) { appendObject('students', r); });
    logAction(ctx.me.email, 'student.bulk', '', '추가 ' + added + ', 갱신 ' + updated);
    return { added: added, updated: updated, errors: parsed.errors };
  });
}

function listTeachers(ctx) {
  requireAdmin(ctx);
  return readAll('teachers').filter(function (t) { return t.email; }).map(publicTeacher);
}

function upsertTeacher(ctx, data) {
  requireAdmin(ctx);
  var t = SOSLib.normalizeTeacher(data.teacher || {});
  if (!t.email || !t.name) throw fail('BAD_REQUEST', '이메일과 이름은 필수입니다.');
  if (!t.roles.length) throw fail('BAD_REQUEST', '역할을 하나 이상 선택하세요.');
  return withLock(function () {
    var found = findTeacher(t.email);
    var fields = { email: t.email, name: t.name, roles: t.roles.join(','), homeroom: t.homeroom, classes: t.classes.join(';'),
      field: t.field, active: t.active ? 'Y' : 'N' };
    var tempPassword = null;
    if (found) {
      updateRowFields('teachers', found.index, fields);
    } else {
      var salt = Utilities.getUuid();
      tempPassword = randomPassword();
      appendObject('teachers', Object.assign(fields, { passwordHash: hashSecret(tempPassword, salt), pinHash: '', salt: salt,
        mustChangePassword: 'Y', createdAt: nowIso() }));
    }
    logAction(ctx.me.email, 'teacher.upsert', t.email, '');
    return { teacher: t, tempPassword: tempPassword };
  });
}

function resetPassword(ctx, data) {
  requireAdmin(ctx);
  var found = findTeacher(data.email);
  if (!found) throw fail('NOT_FOUND', '교사를 찾을 수 없습니다.');
  var pw = randomPassword();
  updateRowFields('teachers', found.index, { passwordHash: hashSecret(pw, found.row.salt), pinHash: data.resetPin ? '' : found.row.pinHash, mustChangePassword: 'Y' });
  logAction(ctx.me.email, 'teacher.resetPassword', found.row.email, '');
  return { tempPassword: pw };
}

function randomPassword() {
  var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  var s = '';
  for (var i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function saveTags(ctx, data) {
  requireAdmin(ctx);
  var tags = (data.tags || []).filter(function (t) { return t.id && t.name; });
  if (!tags.length) throw fail('BAD_REQUEST', '태그가 비어 있습니다.');
  return withLock(function () {
    replaceAll('tags', tags.map(function (t, i) { return { id: t.id, name: t.name, color: t.color || 'etc', order: i + 1, active: t.active === false ? 'N' : 'Y' }; }));
    logAction(ctx.me.email, 'tags.save', '', tags.length + '개');
    return { tags: readTags() };
  });
}

function savePhrases(ctx, data) {
  requireAdmin(ctx);
  var list = (data.phrases || []).filter(function (p) { return p.tagId && p.text; });
  return withLock(function () {
    replaceAll('phrases', list.map(function (p, i) { return { id: p.id || SOSLib.uuid(), tagId: p.tagId, text: p.text, order: i + 1 }; }));
    logAction(ctx.me.email, 'phrases.save', '', list.length + '개');
    return { phrases: readAll('phrases') };
  });
}

function saveSettings(ctx, data) {
  requireAdmin(ctx);
  var s = Object.assign(getSettings(), data.settings || {});
  return withLock(function () {
    replaceAll('settings', Object.keys(s).map(function (k) { return { key: k, value: s[k] }; }));
    logAction(ctx.me.email, 'settings.save', '', '');
    return { settings: getSettings() };
  });
}

function listViews(ctx, data) {
  var rows = readAll('views').filter(function (v) { return v.at; });
  if (!SOSLib.isAdmin(ctx.me)) {
    // 일반 교사: 본인 활동과 본인이 쓴 잠긴 기록의 열람 내역만
    var myRecordIds = {};
    readRecords().forEach(function (r) { if (r.author === ctx.me.email) myRecordIds[r.id] = true; });
    rows = rows.filter(function (v) { return v.email === ctx.me.email || myRecordIds[v.recordId]; });
  }
  rows.reverse();
  return { views: rows.slice(0, Number(data.limit) || 100).map(function (v) {
    return { at: v.at instanceof Date ? v.at.toISOString() : String(v.at), email: v.email, name: v.name, action: v.action, recordId: v.recordId, studentId: v.studentId, result: v.result };
  }) };
}

// =====================================================================
// 시트 접근 도우미
// =====================================================================
function sheet(key) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS[key]);
  if (!sh) throw fail('SERVER_ERROR', '시트가 없습니다: ' + SHEETS[key] + ' (setup 을 실행하세요)');
  return sh;
}

function readAll(key) {
  var sh = sheet(key);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HEADERS[key].length).getValues();
  var heads = HEADERS[key];
  return values.map(function (row) {
    var o = {};
    heads.forEach(function (h, i) { o[h] = row[i]; });
    return o;
  });
}

function toRow(key, obj) {
  return HEADERS[key].map(function (h) {
    var v = obj[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'Y' : 'N';
    return v;
  });
}

function appendObject(key, obj) {
  sheet(key).appendRow(toRow(key, obj));
}

function appendRows(key, rows) {
  var sh = sheet(key);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function writeObject(key, rowIndex, obj) {
  sheet(key).getRange(rowIndex, 1, 1, HEADERS[key].length).setValues([toRow(key, obj)]);
}

function updateRowFields(key, rowIndex, fields) {
  var sh = sheet(key);
  Object.keys(fields).forEach(function (h) {
    var col = HEADERS[key].indexOf(h) + 1;
    if (col > 0) sh.getRange(rowIndex, col).setValue(fields[h]);
  });
}

function findRowIndex(key, id) {
  if (!id) return 0;
  var sh = sheet(key);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function replaceAll(key, objects) {
  var sh = sheet(key);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, HEADERS[key].length).clearContent();
  if (objects.length) sh.getRange(2, 1, objects.length, HEADERS[key].length).setValues(objects.map(function (o) { return toRow(key, o); }));
}

function logAction(email, action, target, detail) {
  appendObject('logs', { at: nowIso(), email: email, action: action, target: target, detail: detail });
  return { ok: true };
}

function isYes(v) { return v === true || v === 'Y' || v === 'TRUE' || v === 'true' || v === 'y'; }
function nowIso() { return new Date().toISOString(); }
