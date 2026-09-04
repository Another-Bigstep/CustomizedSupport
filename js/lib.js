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

if (typeof module !== 'undefined' && module.exports) module.exports = SOSLib;
