// ===== 자동 생성 파일: npm run build:backend (js/lib.js + backend/Code.gs) =====

/*
 * 학생맞춤통합지원 관찰관리 — 공용 로직
 * 브라우저(js/lib.js)와 Google Apps Script(backend/dist/Code.gs 앞부분)에서 같은 파일을 사용한다.
 * 이 파일에는 시트·DOM 접근이 없고 순수 함수만 둔다.
 */
var SOSLib = (function () {
  'use strict';

  var ROLES = {
    homeroom: { key: 'homeroom', label: '담임교사', short: '담임', badge: 'hr' },
    specialist: { key: 'specialist', label: '분야 담당', short: '전담', badge: 'field' },
    subject: { key: 'subject', label: '교과교사', short: '교과', badge: 'sub' },
    admin: { key: 'admin', label: '행정담당자', short: '행정', badge: 'adm' }
  };

  var SPECIALIST_FIELDS = ['상담', '복지', '보건'];

  var VISIBILITY = {
    all: { key: 'all', label: '교사 전체' },
    restricted: { key: 'restricted', label: '담당 교사만' }
  };

  var DEFAULT_TAGS = [
    { id: 'welfare', name: '복지', color: 'welfare', order: 1, active: true },
    { id: 'counsel', name: '상담', color: 'counsel', order: 2, active: true },
    { id: 'health', name: '건강', color: 'health', order: 3, active: true },
    { id: 'study', name: '학습', color: 'study', order: 4, active: true },
    { id: 'behavior', name: '문제행동', color: 'behavior', order: 5, active: true },
    { id: 'career', name: '진로', color: 'career', order: 6, active: true },
    { id: 'etc', name: '기타', color: 'etc', order: 7, active: true }
  ];

  var DEFAULT_PHRASES = [
    ['welfare', '아침 결식 확인됨'], ['welfare', '가정 연락 필요'], ['welfare', '준비물 지원'], ['welfare', '복지실 연계'],
    ['counsel', '상담 요청함'], ['counsel', '교우관계 어려움 호소'], ['counsel', '상담교사 연계'], ['counsel', '보호자 상담 필요'],
    ['health', '보건실 이용'], ['health', '컨디션 저하 호소'], ['health', '조퇴 요청'], ['health', '복약 확인'],
    ['study', '과제 미제출'], ['study', '수업 집중도 향상'], ['study', '보충 학습 참여'], ['study', '학습 의욕 저하'],
    ['behavior', '수업 방해 행동'], ['behavior', '지각'], ['behavior', '무단 이석'], ['behavior', '갈등 상황 발생'],
    ['career', '취업처 문의'], ['career', '자격증 준비 중'], ['career', '진로 상담 요청'], ['career', '실습 태도 우수'],
    ['etc', '보호자 연락함'], ['etc', '교사 협의 필요']
  ].map(function (p, i) { return { id: 'p' + (i + 1), tagId: p[0], text: p[1], order: i + 1 }; });

  var DEFAULT_SETTINGS = {
    schoolYear: '2026',
    unlockMinutes: 12,
    noRecordDays: 14,
    alertNoRecordDays: 21,
    alertBehaviorWeeks: 3,
    schoolName: ''
  };

  // ---------- 기본 유틸 ----------
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    var s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return s.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function toTimeStr(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  function parseDate(str) {
    if (!str) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str));
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function daysBetween(a, b) {
    var da = parseDate(a), db = parseDate(b);
    if (!da || !db) return null;
    return Math.round((db - da) / 86400000);
  }

  function addDays(dateStr, n) {
    var d = parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  }

  // ISO 주차 키 (월요일 시작)
  function isoWeekKey(dateStr) {
    var d = parseDate(dateStr);
    if (!d) return '';
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + '-W' + pad2(week);
  }

  function formatDateKo(dateStr, withYear) {
    var d = parseDate(dateStr);
    if (!d) return '';
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    var s = (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    if (withYear) s = d.getFullYear() + '년 ' + s + ' ' + days[d.getDay()] + '요일';
    return s;
  }

  function formatShort(dateStr) {
    var d = parseDate(dateStr);
    return d ? (d.getMonth() + 1) + '/' + d.getDate() : '';
  }

  function splitList(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v === null || v === undefined) return [];
    return String(v).split(/[,;、]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // ---------- 학생·교사 ----------
  function classKey(s) {
    if (!s) return '';
    return (s.dept || '') + ' ' + (s.grade || '') + '-' + (s.klass || '');
  }

  function normalizeTeacher(t) {
    t = t || {};
    return {
      email: String(t.email || '').trim().toLowerCase(),
      name: t.name || '',
      roles: splitList(t.roles),
      homeroom: (t.homeroom || '').trim(),
      classes: splitList(t.classes),
      field: (t.field || '').trim(),
      active: t.active === undefined ? true : !!t.active,
      hasPin: !!t.hasPin,
      mustChangePassword: !!t.mustChangePassword,
      status: t.status === 'pending' || t.status === 'rejected' ? t.status : 'approved',
      requestedAt: t.requestedAt || ''
    };
  }

  var TEACHER_STATUS = { pending: '승인 대기', approved: '승인', rejected: '거절' };

  // 회원가입 입력 검증. 관리자 역할은 가입으로 얻을 수 없다.
  function validateSignup(t, password) {
    if (!t.email || t.email.length < 3) return '아이디를 3자 이상 입력하세요.';
    if (!/^[a-z0-9@._\-]+$/.test(t.email)) return '아이디는 영문 소문자·숫자·@ . _ - 만 쓸 수 있습니다.';
    if (!t.name || !t.name.trim()) return '이름을 입력하세요.';
    if (!password || password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    var roles = t.roles.filter(function (r) { return r !== 'admin' && ROLES[r]; });
    if (!roles.length) return '역할을 하나 이상 선택하세요.';
    if (roles.indexOf('homeroom') >= 0 && !/^.+ \d+-\d+$/.test(t.homeroom || '')) return '담임반을 "기계과 3-2" 형식으로 입력하세요.';
    if (roles.indexOf('specialist') >= 0 && SPECIALIST_FIELDS.indexOf(t.field) < 0) return '전담 분야(상담·복지·보건)를 선택하세요.';
    return null;
  }

  function hasRole(teacher, role) { return !!teacher && (teacher.roles || []).indexOf(role) >= 0; }
  function isAdmin(teacher) { return hasRole(teacher, 'admin'); }

  // 이 학생에 대해 교사가 갖는 역할
  function roleForStudent(teacher, student) {
    if (!teacher) return 'subject';
    var ck = classKey(student);
    if (student && teacher.homeroom && teacher.homeroom === ck) return 'homeroom';
    if (hasRole(teacher, 'specialist')) return 'specialist';
    if (student && (teacher.classes || []).indexOf(ck) >= 0) return 'subject';
    if (hasRole(teacher, 'subject')) return 'subject';
    if (hasRole(teacher, 'homeroom')) return 'homeroom';
    if (isAdmin(teacher)) return 'admin';
    return 'subject';
  }

  function roleLabel(roleKey, teacher) {
    if (roleKey === 'specialist') {
      var f = teacher && teacher.field;
      if (f === '상담') return '상담교사';
      if (f === '보건') return '보건교사';
      if (f === '복지') return '복지담당';
      return '분야 담당';
    }
    return ROLES[roleKey] ? ROLES[roleKey].short : roleKey;
  }

  function primaryRole(teacher) {
    if (!teacher) return 'subject';
    if (teacher.homeroom) return 'homeroom';
    var order = ['specialist', 'subject', 'admin', 'homeroom'];
    for (var i = 0; i < order.length; i++) if (hasRole(teacher, order[i])) return order[i];
    return 'subject';
  }

  // 잠긴(담당 교사만) 기록의 본문을 볼 수 있는 사람
  function canViewRestricted(teacher, record, student) {
    if (!teacher || !record) return false;
    if (record.author && record.author === teacher.email) return true;
    if (student && teacher.homeroom && teacher.homeroom === classKey(student)) return true;
    if (hasRole(teacher, 'specialist')) return true;
    return false;
  }

  function canEditRecord(teacher, record) {
    return !!teacher && !!record && record.author === teacher.email;
  }

  function canDeleteRecord(teacher, record) {
    return canEditRecord(teacher, record) || isAdmin(teacher);
  }

  // 교사가 기록·조회 대상으로 삼는 학생 범위
  function scopeStudents(teacher, students) {
    if (!teacher) return [];
    var active = students.filter(function (s) { return !s.status || s.status === '재학'; });
    if (teacher.homeroom) return active.filter(function (s) { return classKey(s) === teacher.homeroom; });
    if (hasRole(teacher, 'specialist') || isAdmin(teacher)) return active;
    if (teacher.classes && teacher.classes.length) {
      return active.filter(function (s) { return teacher.classes.indexOf(classKey(s)) >= 0; });
    }
    return active;
  }

  function scopeLabel(teacher) {
    if (!teacher) return '';
    if (teacher.homeroom) return teacher.homeroom;
    if (hasRole(teacher, 'specialist')) return (teacher.field ? teacher.field + ' ' : '') + '전담';
    if (teacher.classes && teacher.classes.length) return '담당 ' + teacher.classes.length + '개 반';
    return '전체';
  }

  // ---------- 기록 ----------
  function normalizeRecord(r) {
    r = r || {};
    return {
      id: r.id || '',
      studentId: r.studentId || '',
      date: r.date || '',
      time: r.time || '',
      tags: splitList(r.tags),
      content: r.content || '',
      action: r.action || '',
      place: r.place || '',
      visibility: r.visibility === 'restricted' ? 'restricted' : 'all',
      author: String(r.author || '').toLowerCase(),
      authorName: r.authorName || '',
      authorRole: r.authorRole || '',
      authorRoleLabel: r.authorRoleLabel || '',
      createdAt: r.createdAt || '',
      updatedAt: r.updatedAt || '',
      version: Number(r.version) || 1,
      deleted: r.deleted === true || r.deleted === 'Y' || r.deleted === 'TRUE'
    };
  }

  function validateRecord(r) {
    if (!r.id) return '기록 ID가 없습니다.';
    if (!r.studentId) return '학생이 선택되지 않았습니다.';
    if (!parseDate(r.date)) return '날짜 형식이 올바르지 않습니다.';
    if (!/^\d{2}:\d{2}$/.test(r.time || '')) return '시간 형식이 올바르지 않습니다.';
    if (!r.tags || !r.tags.length) return '분야를 하나 이상 선택해주세요.';
    if (!r.content || !String(r.content).trim()) return '관찰 내용을 입력해주세요.';
    if (String(r.content).length > 4000) return '관찰 내용은 4000자 이내로 입력해주세요.';
    return null;
  }

  // 열람 권한에 따라 본문을 가린 사본을 만든다. 작성자 본인은 PIN 없이 본다.
  function maskRecord(record, canView, unlocked, viewerEmail) {
    var r = Object.assign({}, record);
    if (r.visibility !== 'restricted') { r.locked = false; r.canUnlock = false; return r; }
    if (viewerEmail && r.author === viewerEmail) { r.locked = false; r.canUnlock = true; return r; }
    if (canView && unlocked) { r.locked = false; r.canUnlock = true; return r; }
    r.locked = true;
    r.canUnlock = !!canView;
    r.content = '';
    r.action = '';
    r.place = '';
    return r;
  }

  function lockTitle(record) {
    var role = record.authorRoleLabel || '';
    if (role === '상담교사' || role === '보건교사' || role === '복지담당') return role + ' 전용 기록';
    return '담당 교사만 열람';
  }

  function sortRecordsDesc(list) {
    return list.slice().sort(function (a, b) {
      var ka = a.date + ' ' + a.time, kb = b.date + ' ' + b.time;
      if (ka === kb) return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1;
      return ka < kb ? 1 : -1;
    });
  }

  // ---------- 통계·알림 ----------
  function studentStats(records, today) {
    var live = records.filter(function (r) { return !r.deleted; });
    var byTag = {};
    var last30 = 0;
    live.forEach(function (r) {
      r.tags.forEach(function (t) { byTag[t] = (byTag[t] || 0) + 1; });
      var d = daysBetween(r.date, today);
      if (d !== null && d >= 0 && d <= 30) last30++;
    });
    var top = null, topN = 0;
    Object.keys(byTag).forEach(function (t) { if (byTag[t] > topN) { top = t; topN = byTag[t]; } });
    var last = null;
    live.forEach(function (r) { if (!last || r.date > last) last = r.date; });
    return { total: live.length, last30: last30, byTag: byTag, topTag: top, lastDate: last };
  }

  function lastRecordDateByStudent(records) {
    var m = {};
    records.forEach(function (r) {
      if (r.deleted) return;
      if (!m[r.studentId] || r.date > m[r.studentId]) m[r.studentId] = r.date;
    });
    return m;
  }

  function computeAlerts(records, students, teacher, today, settings) {
    settings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    var scope = scopeStudents(teacher, students);
    var byId = {};
    scope.forEach(function (s) { byId[s.id] = s; });
    var alerts = [];

    // 1) 문제행동 N주 연속
    var weeks = [];
    for (var i = 0; i < settings.alertBehaviorWeeks; i++) weeks.push(isoWeekKey(addDays(today, -7 * i)));
    var behaviorWeeks = {};
    records.forEach(function (r) {
      if (r.deleted || !byId[r.studentId]) return;
      if (r.tags.indexOf('behavior') < 0) return;
      var wk = isoWeekKey(r.date);
      if (weeks.indexOf(wk) < 0) return;
      (behaviorWeeks[r.studentId] = behaviorWeeks[r.studentId] || {})[wk] = true;
    });
    Object.keys(behaviorWeeks).forEach(function (sid) {
      var ok = weeks.every(function (w) { return behaviorWeeks[sid][w]; });
      if (ok) alerts.push({ type: 'behavior', studentId: sid, name: byId[sid].name,
        text: '문제행동 ' + settings.alertBehaviorWeeks + '주 연속 기록' });
    });

    // 2) 담임 학급에서 오래 기록이 없는 학생
    if (teacher && teacher.homeroom) {
      var lastMap = lastRecordDateByStudent(records);
      scope.forEach(function (s) {
        var last = lastMap[s.id];
        var days = last ? daysBetween(last, today) : null;
        if (days === null || days >= settings.alertNoRecordDays) {
          alerts.push({ type: 'noRecord', studentId: s.id, name: s.name,
            text: days === null ? '기록 없음' : '기록 없음 ' + days + '일' });
        }
      });
    }
    return alerts;
  }

  function homeStats(records, students, teacher, today, settings) {
    settings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    var scope = scopeStudents(teacher, students);
    var ids = {};
    scope.forEach(function (s) { ids[s.id] = true; });
    var todayCount = 0, locked = 0, active30 = {};
    records.forEach(function (r) {
      if (r.deleted || !ids[r.studentId]) return;
      if (r.date === today) todayCount++;
      var d = daysBetween(r.date, today);
      if (d !== null && d >= 0 && d <= 30) {
        active30[r.studentId] = true;
        if (r.visibility === 'restricted') locked++;
      }
    });
    var noRecord = 0;
    if (teacher && teacher.homeroom) {
      var lastMap = lastRecordDateByStudent(records);
      scope.forEach(function (s) {
        var last = lastMap[s.id];
        var d = last ? daysBetween(last, today) : null;
        if (d === null || d >= settings.noRecordDays) noRecord++;
      });
    }
    var rate = scope.length ? Math.round(Object.keys(active30).length / scope.length * 100) : 0;
    return { todayCount: todayCount, noRecord: noRecord, locked: locked, rate: rate, scopeSize: scope.length };
  }

  function tagDistribution(records, tags) {
    var m = {};
    records.forEach(function (r) { if (!r.deleted) r.tags.forEach(function (t) { m[t] = (m[t] || 0) + 1; }); });
    return tags.map(function (t) { return { tag: t, count: m[t.id] || 0 }; });
  }

  // ---------- 통합지원 회의 ----------
  var MEETING_STATUS = { planned: '예정', done: '완료' };

  function normalizeMeeting(m) {
    m = m || {};
    var decisions = m.decisions;
    if (typeof decisions === 'string') { try { decisions = JSON.parse(decisions || '[]'); } catch (e) { decisions = []; } }
    return {
      id: m.id || '',
      date: m.date || '',
      title: m.title || '',
      attendees: m.attendees || '',
      status: m.status === 'done' ? 'done' : 'planned',
      studentIds: splitList(m.studentIds),
      notes: m.notes || '',
      decisions: (decisions || []).map(function (d) {
        return { text: d.text || '', owner: d.owner || '', due: d.due || '', done: d.done === true || d.done === 'Y' };
      }).filter(function (d) { return d.text; }),
      createdBy: String(m.createdBy || '').toLowerCase(),
      createdByName: m.createdByName || '',
      createdAt: m.createdAt || '',
      updatedAt: m.updatedAt || '',
      version: Number(m.version) || 1,
      deleted: m.deleted === true || m.deleted === 'Y'
    };
  }

  function validateMeeting(m) {
    if (!m.id) return '회의 ID가 없습니다.';
    if (!parseDate(m.date)) return '회의 날짜를 입력하세요.';
    if (!m.title || !String(m.title).trim()) return '회의 제목을 입력하세요.';
    if (String(m.notes || '').length > 20000) return '회의록은 20000자 이내로 입력하세요.';
    return null;
  }

  // 회의 내용 열람: 작성자, 전담(상담·복지·보건), 행정담당자, 안건 학생의 담임
  function canViewMeeting(teacher, meeting, studentsById) {
    if (!teacher || !meeting) return false;
    if (meeting.createdBy === teacher.email) return true;
    if (hasRole(teacher, 'specialist') || isAdmin(teacher)) return true;
    if (teacher.homeroom) {
      for (var i = 0; i < meeting.studentIds.length; i++) {
        var s = studentsById[meeting.studentIds[i]];
        if (s && classKey(s) === teacher.homeroom) return true;
      }
    }
    return false;
  }

  function canEditMeeting(teacher, meeting) {
    return !!teacher && !!meeting && (meeting.createdBy === teacher.email || hasRole(teacher, 'specialist') || isAdmin(teacher));
  }

  function maskMeeting(meeting, canView) {
    var m = Object.assign({}, meeting);
    m.locked = !canView;
    if (!canView) { m.notes = ''; m.decisions = []; m.attendees = ''; }
    return m;
  }

  function openDecisions(meetings) {
    var out = [];
    meetings.forEach(function (m) {
      if (m.deleted || m.locked) return;
      m.decisions.forEach(function (d, i) { if (!d.done) out.push({ meetingId: m.id, meetingTitle: m.title, date: m.date, index: i, text: d.text, owner: d.owner, due: d.due }); });
    });
    return out.sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : 1; });
  }

  function buildMeetingMarkdown(meeting, studentsById, recordsByStudent, tagsById, today) {
    var out = ['# ' + meeting.title, '', '- 일시: ' + meeting.date, '- 참석: ' + (meeting.attendees || '-'),
      '- 상태: ' + MEETING_STATUS[meeting.status], '- 출력일: ' + (today || toDateStr(new Date())), ''];
    out.push('## 안건 학생', '');
    meeting.studentIds.forEach(function (sid) {
      var s = studentsById[sid];
      if (!s) return;
      var recs = (recordsByStudent[sid] || []).filter(function (r) { return !r.deleted; });
      var st = studentStats(recs, today || toDateStr(new Date()));
      out.push('### ' + s.name + ' (' + classKey(s) + (s.number ? ' ' + s.number + '번' : '') + ')');
      out.push('- 누적 ' + st.total + '건 · 최근 30일 ' + st.last30 + '건' + (st.topTag && tagsById[st.topTag] ? ' · 주요 분야 ' + tagsById[st.topTag].name : ''));
      sortRecordsDesc(recs).slice(0, 5).forEach(function (r) {
        var tags = r.tags.map(function (t) { return tagsById[t] ? tagsById[t].name : t; }).join('·');
        out.push('- ' + r.date + ' [' + tags + '] ' + (r.locked ? '(담당 교사만 열람 가능한 기록)' : r.content.replace(/\n/g, ' ')));
      });
      out.push('');
    });
    out.push('## 회의록', '', meeting.notes || '-', '');
    out.push('## 결정 사항', '');
    if (!meeting.decisions.length) out.push('- 없음');
    meeting.decisions.forEach(function (d) {
      out.push('- [' + (d.done ? 'x' : ' ') + '] ' + d.text + (d.owner ? ' (담당: ' + d.owner + ')' : '') + (d.due ? ' (기한: ' + d.due + ')' : ''));
    });
    out.push('');
    return out.join('\n');
  }

  // ---------- 내보내기 ----------
  function tsvCell(v) { return String(v === undefined || v === null ? '' : v).replace(/[\t\r\n]+/g, ' '); }

  function buildTSV(records, studentsById, tagsById) {
    var head = ['과', '학년', '반', '번호', '이름', '날짜', '시간', '분야', '관찰내용', '조치·후속', '장소', '공개범위', '작성자', '작성일시', '기록ID'];
    var lines = [head.join('\t')];
    sortRecordsDesc(records).forEach(function (r) {
      var s = studentsById[r.studentId] || {};
      lines.push([s.dept, s.grade, s.klass, s.number, s.name, r.date, r.time,
        r.tags.map(function (t) { return tagsById[t] ? tagsById[t].name : t; }).join(', '),
        r.locked ? '(잠김)' : r.content, r.locked ? '' : r.action, r.locked ? '' : r.place,
        VISIBILITY[r.visibility] ? VISIBILITY[r.visibility].label : r.visibility,
        r.authorName, r.createdAt, r.id].map(tsvCell).join('\t'));
    });
    return lines.join('\n');
  }

  function buildMarkdown(student, records, tagsById, today) {
    var out = [];
    out.push('# ' + student.name + ' 관찰 기록');
    out.push('');
    out.push('- 학급: ' + classKey(student) + ' ' + (student.number ? student.number + '번' : ''));
    out.push('- 기록 수: ' + records.filter(function (r) { return !r.deleted; }).length + '건');
    out.push('- 출력일: ' + (today || toDateStr(new Date())));
    out.push('');
    var groups = {};
    sortRecordsDesc(records).forEach(function (r) {
      if (r.deleted) return;
      r.tags.forEach(function (t) { (groups[t] = groups[t] || []).push(r); });
    });
    Object.keys(tagsById).forEach(function (tid) {
      var list = groups[tid];
      if (!list || !list.length) return;
      out.push('## ' + tagsById[tid].name + ' (' + list.length + '건)');
      out.push('');
      list.forEach(function (r) {
        out.push('- **' + r.date + ' ' + r.time + '** · ' + r.authorName + (r.authorRoleLabel ? '(' + r.authorRoleLabel + ')' : ''));
        out.push('  ' + (r.locked ? '_(담당 교사만 열람 가능한 기록)_' : r.content.replace(/\n/g, '\n  ')));
        if (!r.locked && r.action) out.push('  - 조치: ' + r.action);
        if (!r.locked && r.place) out.push('  - 장소: ' + r.place);
      });
      out.push('');
    });
    return out.join('\n');
  }

  // 명단 붙여넣기 파싱: "과 학년 반 번호 이름" 또는 TSV
  function parseRosterText(text) {
    var rows = [];
    var errors = [];
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      var t = line.trim();
      if (!t) return;
      var parts = t.indexOf('\t') >= 0 ? t.split('\t') : t.split(/\s+/);
      parts = parts.map(function (p) { return p.trim(); });
      if (parts[0] === '과' || parts[0] === '학과') return; // 머리글
      if (parts.length < 5) { errors.push((i + 1) + '행: 항목이 부족합니다 (과 학년 반 번호 이름)'); return; }
      var grade = parseInt(parts[1], 10), klass = parseInt(parts[2], 10), number = parseInt(parts[3], 10);
      if (!grade || !klass || !number) { errors.push((i + 1) + '행: 학년·반·번호는 숫자여야 합니다'); return; }
      rows.push({ dept: parts[0], grade: grade, klass: klass, number: number, name: parts[4], memo: parts[5] || '', status: parts[6] || '재학' });
    });
    return { rows: rows, errors: errors };
  }

  function studentSortKey(s) {
    return [s.dept, pad2(+s.grade || 0), pad2(+s.klass || 0), pad2(+s.number || 0)].join('|');
  }

  return {
    ROLES: ROLES, SPECIALIST_FIELDS: SPECIALIST_FIELDS, VISIBILITY: VISIBILITY,
    DEFAULT_TAGS: DEFAULT_TAGS, DEFAULT_PHRASES: DEFAULT_PHRASES, DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    uuid: uuid, pad2: pad2, toDateStr: toDateStr, toTimeStr: toTimeStr, parseDate: parseDate,
    daysBetween: daysBetween, addDays: addDays, isoWeekKey: isoWeekKey,
    formatDateKo: formatDateKo, formatShort: formatShort, splitList: splitList,
    classKey: classKey, normalizeTeacher: normalizeTeacher, hasRole: hasRole, isAdmin: isAdmin,
    TEACHER_STATUS: TEACHER_STATUS, validateSignup: validateSignup,
    roleForStudent: roleForStudent, roleLabel: roleLabel, primaryRole: primaryRole,
    canViewRestricted: canViewRestricted, canEditRecord: canEditRecord, canDeleteRecord: canDeleteRecord,
    scopeStudents: scopeStudents, scopeLabel: scopeLabel,
    normalizeRecord: normalizeRecord, validateRecord: validateRecord, maskRecord: maskRecord, lockTitle: lockTitle,
    sortRecordsDesc: sortRecordsDesc, studentStats: studentStats, lastRecordDateByStudent: lastRecordDateByStudent,
    computeAlerts: computeAlerts, homeStats: homeStats, tagDistribution: tagDistribution,
    buildTSV: buildTSV, buildMarkdown: buildMarkdown, parseRosterText: parseRosterText, studentSortKey: studentSortKey,
    MEETING_STATUS: MEETING_STATUS, normalizeMeeting: normalizeMeeting, validateMeeting: validateMeeting,
    canViewMeeting: canViewMeeting, canEditMeeting: canEditMeeting, maskMeeting: maskMeeting,
    openDecisions: openDecisions, buildMeetingMarkdown: buildMeetingMarkdown
  };
})();



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
    'active', 'mustChangePassword', 'createdAt', 'status', 'requestedAt'],
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
  teachers: ['아이디', '이름', '역할', '담임반', '수업반', '전담분야', '비밀번호해시', 'PIN해시', '솔트',
    '사용', '비밀번호변경필요', '등록일시', '승인상태', '가입신청일시'],
  views: ['시각', '이메일', '이름', '동작', '기록ID', '학생ID', '결과'],
  logs: ['시각', '이메일', '동작', '대상', '상세'],
  settings: ['키', '값'],
  meetings: ['ID', '날짜', '제목', '참석자', '상태', '안건학생ID', '회의록', '결정사항(JSON)', '작성자', '작성자이름', '작성일시', '수정일시', '버전', '삭제']
};

// 최초 관리자 계정 (setup 실행 시 교사 시트가 비어 있을 때만 생성)
var ADMIN_ID = 'admin';
var ADMIN_PASSWORD = '12341234';

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
    var salt = Utilities.getUuid();
    appendObject('teachers', {
      email: ADMIN_ID, name: '관리자', roles: 'admin', homeroom: '', classes: '', field: '',
      passwordHash: hashSecret(ADMIN_PASSWORD, salt), pinHash: '', salt: salt,
      active: 'Y', mustChangePassword: 'N', createdAt: nowIso(), status: 'approved', requestedAt: ''
    });
    Logger.log('관리자 계정이 생성되었습니다. 아이디: ' + ADMIN_ID + ' / 비밀번호: ' + ADMIN_PASSWORD);
    Logger.log('실제 운영 전에는 설정 화면에서 비밀번호를 꼭 변경하세요.');
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
  if (action === 'signup') return signup(data);
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
    case 'teachers.approve': return approveTeachers(ctx, data);
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
    field: row.field, active: isYes(row.active), hasPin: !!row.pinHash, mustChangePassword: isYes(row.mustChangePassword),
    status: row.status || 'approved', requestedAt: row.requestedAt instanceof Date ? row.requestedAt.toISOString() : String(row.requestedAt || '')
  });
  return t;
}

// 회원가입: 승인 대기 상태로 저장된다. 관리자 역할은 선택할 수 없다.
function signup(data) {
  var t = SOSLib.normalizeTeacher(data.teacher || data);
  t.roles = t.roles.filter(function (r) { return r !== 'admin'; });
  var password = String(data.password || '');
  var err = SOSLib.validateSignup(t, password);
  if (err) throw fail('BAD_REQUEST', err);
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('signup:count') || 0);
  if (n >= 200) throw fail('LOCKED', '가입 신청이 너무 많습니다. 잠시 후 다시 시도하세요.');
  cache.put('signup:count', String(n + 1), 3600);
  return withLock(function () {
    if (findTeacher(t.email)) throw fail('BAD_REQUEST', '이미 사용 중인 아이디입니다.');
    var salt = Utilities.getUuid();
    appendObject('teachers', { email: t.email, name: t.name.trim(), roles: t.roles.join(','), homeroom: t.homeroom, classes: t.classes.join(';'),
      field: t.field, passwordHash: hashSecret(password, salt), pinHash: '', salt: salt, active: 'Y', mustChangePassword: 'N',
      createdAt: nowIso(), status: 'pending', requestedAt: nowIso() });
    logAction(t.email, 'signup', '', t.name);
    return { status: 'pending' };
  });
}

function approveTeachers(ctx, data) {
  requireAdmin(ctx);
  var emails = (data.emails || []).map(function (e) { return String(e).trim().toLowerCase(); });
  var status = data.approve === false ? 'rejected' : 'approved';
  return withLock(function () {
    var rows = readAll('teachers');
    var count = 0;
    rows.forEach(function (row, i) {
      var target = data.all ? (row.status === 'pending') : emails.indexOf(String(row.email).toLowerCase()) >= 0;
      if (!target || !row.email) return;
      if (String(row.email).toLowerCase() === ctx.me.email) return;
      updateRowFields('teachers', i + 2, { status: status });
      count++;
    });
    logAction(ctx.me.email, 'teacher.' + status, data.all ? '(전체 대기)' : emails.join(','), count + '명');
    return { count: count, status: status };
  });
}

function login(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var password = String(data.password || '');
  if (!email || !password) throw fail('BAD_REQUEST', '아이디와 비밀번호를 입력하세요.');
  checkFails('login', email);
  var found = findTeacher(email);
  if (!found || !isYes(found.row.active) || hashSecret(password, found.row.salt) !== found.row.passwordHash) {
    var left = recordFail('login', email);
    throw fail('AUTH', '아이디 또는 비밀번호가 올바르지 않습니다.' + (left > 0 ? ' (남은 시도 ' + left + '회)' : ''));
  }
  clearFails('login', email);
  if (found.row.status === 'pending') throw fail('PENDING', '관리자 승인을 기다리는 중입니다. 승인 후 로그인할 수 있습니다.');
  if (found.row.status === 'rejected') throw fail('REJECTED', '가입 신청이 승인되지 않았습니다. 관리자에게 문의하세요.');
  var token = sign({ e: email, exp: Date.now() + TOKEN_HOURS * 3600 * 1000, n: Utilities.getUuid().slice(0, 8) });
  logAction(email, 'login', '', '');
  return { token: token, me: publicTeacher(found.row) };
}

function requireAuth(token) {
  var payload = verifyToken(token);
  if (!payload || payload.u) throw fail('AUTH', '로그인이 필요합니다.');
  var found = findTeacher(payload.e);
  if (!found || !isYes(found.row.active) || (found.row.status && found.row.status !== 'approved')) throw fail('AUTH', '사용할 수 없는 계정입니다.');
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
  if (!t.email || !t.name) throw fail('BAD_REQUEST', '아이디와 이름은 필수입니다.');
  if (!t.roles.length) throw fail('BAD_REQUEST', '역할을 하나 이상 선택하세요.');
  return withLock(function () {
    var found = findTeacher(t.email);
    var fields = { email: t.email, name: t.name, roles: t.roles.join(','), homeroom: t.homeroom, classes: t.classes.join(';'),
      field: t.field, active: t.active ? 'Y' : 'N', status: 'approved' };
    var tempPassword = null;
    if (found) {
      updateRowFields('teachers', found.index, fields);
    } else {
      var salt = Utilities.getUuid();
      tempPassword = randomPassword();
      appendObject('teachers', Object.assign(fields, { passwordHash: hashSecret(tempPassword, salt), pinHash: '', salt: salt,
        mustChangePassword: 'Y', createdAt: nowIso(), requestedAt: '' }));
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
