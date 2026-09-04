/* 학생맞춤통합지원 관찰관리 — 화면 로직 */
(function () {
  'use strict';
  var L = SOSLib, A = SOSApi;
  var CFG = window.SOS_CONFIG || {};

  var S = {
    me: null, tags: [], phrases: [], settings: {}, students: [], activity: {},
    unlock: null, route: { name: 'home', params: {}, query: {} }, loading: false,
    draft: null, lastDash: null
  };

  // ------------------------------------------------------------------
  // DOM 도우미
  // ------------------------------------------------------------------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  var ICON = {
    back: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M168 40.6 80.6 128 168 215.4a12 12 0 0 1-17 17l-96-96a12 12 0 0 1 0-17l96-96a12 12 0 0 1 17 17Z"/></svg>',
    lock: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M208 80h-32V56a48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16ZM96 56a32 32 0 0 1 64 0v24H96Zm112 152H48V96h160Z"/></svg>',
    unlock: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M208 80h-96V56a32 32 0 0 1 64 0 8 8 0 0 0 16 0 48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16Zm0 128H48V96h160Z"/></svg>',
    search: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M229.7 218.3l-43.3-43.3A92 92 0 1 0 175 186.4l43.3 43.3a8 8 0 0 0 11.4-11.4ZM40 112a72 72 0 1 1 72 72 72.1 72.1 0 0 1-72-72Z"/></svg>',
    home: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M218.8 103.7 133.6 26.4a8 8 0 0 0-10.8 0l-85.6 77.3A16 16 0 0 0 32 115.5V208a16 16 0 0 0 16 16h48a8 8 0 0 0 8-8v-56h48v56a8 8 0 0 0 8 8h48a16 16 0 0 0 16-16v-92.5a16 16 0 0 0-5.2-11.8ZM208 208h-40v-56a8 8 0 0 0-8-8H96a8 8 0 0 0-8 8v56H48v-92.5l80-72.6 80 72.6Z"/></svg>',
    users: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M117.3 157.7a60 60 0 1 0-58.6 0 96 96 0 0 0-53.5 41.2 8 8 0 0 0 13.6 8.4 80 80 0 0 1 138.4 0 8 8 0 0 0 13.6-8.4 96 96 0 0 0-53.5-41.2ZM44 104a44 44 0 1 1 44 44 44 44 0 0 1-44-44Zm206.6 100.1a8 8 0 0 1-11-2.6 80 80 0 0 0-69.6-40 8 8 0 0 1 0-16 44 44 0 1 0-16.3-84.9 8 8 0 1 1-6-14.8 60 60 0 0 1 56.2 104.4 96 96 0 0 1 49.3 42.9 8 8 0 0 1-2.6 11Z"/></svg>',
    list: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M224 128a8 8 0 0 1-8 8H40a8 8 0 0 1 0-16h176a8 8 0 0 1 8 8ZM40 72h176a8 8 0 0 0 0-16H40a8 8 0 0 0 0 16Zm176 112H40a8 8 0 0 0 0 16h176a8 8 0 0 0 0-16Z"/></svg>',
    chart: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M224 200h-8V40a8 8 0 0 0-8-8h-56a8 8 0 0 0-8 8v40H96a8 8 0 0 0-8 8v40H48a8 8 0 0 0-8 8v64h-8a8 8 0 0 0 0 16h192a8 8 0 0 0 0-16ZM160 48h40v152h-40Zm-56 48h40v104h-40Zm-48 48h32v56H56Z"/></svg>',
    gear: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M128 80a48 48 0 1 0 48 48 48 48 0 0 0-48-48Zm0 80a32 32 0 1 1 32-32 32 32 0 0 1-32 32Zm88-29.8v-4.4l14.9-18.6a8 8 0 0 0 1.5-7.1 107.6 107.6 0 0 0-10.9-26.3 8 8 0 0 0-6-3.9l-23.7-2.6-3.1-3.1-2.6-23.7a8 8 0 0 0-3.9-6 107.6 107.6 0 0 0-26.3-10.9 8 8 0 0 0-7.1 1.5L130.2 40h-4.4L107.2 25.1a8 8 0 0 0-7.1-1.5 107.6 107.6 0 0 0-26.3 10.9 8 8 0 0 0-3.9 6l-2.6 23.7-3.1 3.1-23.7 2.6a8 8 0 0 0-6 3.9 107.6 107.6 0 0 0-10.9 26.3 8 8 0 0 0 1.5 7.1L40 125.8v4.4L25.1 148.8a8 8 0 0 0-1.5 7.1 107.6 107.6 0 0 0 10.9 26.3 8 8 0 0 0 6 3.9l23.7 2.6 3.1 3.1 2.6 23.7a8 8 0 0 0 3.9 6 107.6 107.6 0 0 0 26.3 10.9 8 8 0 0 0 7.1-1.5L125.8 216h4.4l18.6 14.9a8 8 0 0 0 7.1 1.5 107.6 107.6 0 0 0 26.3-10.9 8 8 0 0 0 3.9-6l2.6-23.7 3.1-3.1 23.7-2.6a8 8 0 0 0 6-3.9 107.6 107.6 0 0 0 10.9-26.3 8 8 0 0 0-1.5-7.1Zm-16.1-6.5a73.9 73.9 0 0 1 0 8.6 8 8 0 0 0 1.7 5.6l14.1 17.6a92 92 0 0 1-6.2 15l-22.5 2.5a8 8 0 0 0-5.2 2.7 73.9 73.9 0 0 1-6.1 6.1 8 8 0 0 0-2.7 5.2l-2.5 22.5a92 92 0 0 1-15 6.2l-17.6-14.1a8 8 0 0 0-5-1.7h-.6a73.9 73.9 0 0 1-8.6 0 8 8 0 0 0-5.6 1.7l-17.6 14.1a92 92 0 0 1-15-6.2l-2.5-22.5a8 8 0 0 0-2.7-5.2 73.9 73.9 0 0 1-6.1-6.1 8 8 0 0 0-5.2-2.7l-22.5-2.5a92 92 0 0 1-6.2-15l14.1-17.6a8 8 0 0 0 1.7-5.6 73.9 73.9 0 0 1 0-8.6 8 8 0 0 0-1.7-5.6L40.4 106.1a92 92 0 0 1 6.2-15l22.5-2.5a8 8 0 0 0 5.2-2.7 73.9 73.9 0 0 1 6.1-6.1 8 8 0 0 0 2.7-5.2l2.5-22.5a92 92 0 0 1 15-6.2l17.6 14.1a8 8 0 0 0 5.6 1.7 73.9 73.9 0 0 1 8.6 0 8 8 0 0 0 5.6-1.7l17.6-14.1a92 92 0 0 1 15 6.2l2.5 22.5a8 8 0 0 0 2.7 5.2 73.9 73.9 0 0 1 6.1 6.1 8 8 0 0 0 5.2 2.7l22.5 2.5a92 92 0 0 1 6.2 15l-14.1 17.6a8 8 0 0 0-1.7 5.6Z"/></svg>',
    check: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M229.7 77.7l-128 128a8 8 0 0 1-11.4 0l-56-56a8 8 0 0 1 11.4-11.4L96 188.7 218.3 66.3a8 8 0 0 1 11.4 11.4Z"/></svg>',
    plus: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"/></svg>'
  };
  function icon(name, cls) { return h('span', { class: 'ic ' + (cls || ''), html: ICON[name], style: 'display:inline-flex;width:1em;height:1em;vertical-align:-.15em' }); }

  function tagById(id) { for (var i = 0; i < S.tags.length; i++) if (S.tags[i].id === id) return S.tags[i]; return { id: id, name: id, color: 'etc' }; }
  function tagsById() { var m = {}; S.tags.forEach(function (t) { m[t.id] = t; }); return m; }
  function studentById(id) { for (var i = 0; i < S.students.length; i++) if (S.students[i].id === id) return S.students[i]; return null; }
  function activeTags() { return S.tags.filter(function (t) { return t.active !== false; }); }
  function today() { return L.toDateStr(new Date()); }

  function tagChip(id, extra) { var t = tagById(id); return h('span', { class: 'tag ' + (t.color || 'etc') + ' ' + (extra || '') }, t.name); }
  function roleBadge(roleKey) { var r = L.ROLES[roleKey] || L.ROLES.subject; return h('span', { class: 'tb ' + r.badge, title: r.label }, 'T'); }
  function lockBadge(text) { return h('span', { class: 'lockbadge' }, icon('lock'), text); }
  function authorLine(r) { return [r.authorName + (r.authorRoleLabel ? '(' + r.authorRoleLabel + ')' : ''), roleBadge(r.authorRole)]; }

  // ------------------------------------------------------------------
  // 토스트 / 모달
  // ------------------------------------------------------------------
  var toastTimer = null;
  function toast(msg, isErr) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var el = h('div', { class: 'toast glass' + (isErr ? ' err' : '') }, msg);
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, isErr ? 4200 : 2600);
  }

  function modal(content, opts) {
    opts = opts || {};
    var back = h('div', { class: 'modal-back', onclick: function (e) { if (e.target === back && !opts.sticky) close(); } });
    var box = h('div', { class: 'modal glass' }, content);
    back.appendChild(box);
    document.body.appendChild(back);
    function close() { back.remove(); }
    return { close: close, el: box };
  }

  function confirmDialog(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var m = modal([
        h('div', { class: 'h2' }, title),
        h('p', { class: 'muted', style: 'margin-top:8px;font-size:14px;line-height:1.6' }, text),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'cta dim', onclick: function () { m.close(); resolve(false); } }, '취소'),
          h('button', { class: 'cta' + (danger ? ' danger' : ''), onclick: function () { m.close(); resolve(true); } }, okLabel || '확인'))
      ]);
    });
  }

  // 작성 전 안내
  function noticeBeforeWrite() {
    try { if (sessionStorage.getItem('sos.noticeAck') === '1') return Promise.resolve(true); } catch (e) { /* 무시 */ }
    return new Promise(function (resolve) {
      var chk = h('input', { type: 'checkbox' });
      var btn = h('button', { class: 'cta', disabled: true, onclick: function () {
        try { sessionStorage.setItem('sos.noticeAck', '1'); } catch (e) { /* 무시 */ }
        m.close(); resolve(true);
      } }, '확인했습니다 · 작성 시작');
      chk.addEventListener('change', function () { btn.disabled = !chk.checked; });
      var m = modal([
        h('div', { class: 'h2' }, '기록 전 확인해주세요'),
        h('div', { class: 'glass card', style: 'margin-top:14px;font-size:14px;line-height:1.7' },
          h('p', {}, h('strong', {}, '관찰한 사실과 행동 중심'), '으로 적어주세요. 추측이나 평가는 남기지 않습니다.'),
          h('p', { style: 'margin-top:10px' }, '구체적인 병명 · 가족관계 · 경제 상황 등 민감한 정보는 반드시 ', h('strong', {}, '담당 교사만'), '으로 설정해 저장해주세요.')),
        h('label', { class: 'checkbox', style: 'margin-top:16px' }, chk, '안내를 읽었으며, 민감정보는 비공개로 저장하겠습니다.'),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'cta dim', onclick: function () { m.close(); resolve(false); } }, '취소'), btn)
      ], { sticky: true });
    });
  }

  // PIN 해제 화면
  function pinScreen(context) {
    return new Promise(function (resolve) {
      if (!S.me.hasPin) {
        toast('먼저 설정에서 PIN을 등록하세요.', true);
        navigate('settings');
        return resolve(false);
      }
      var digits = '';
      var dots = h('div', { class: 'pin-dots' }, [0, 1, 2, 3, 4, 5].map(function () { return h('span'); }));
      var err = h('div', { class: 'err' });
      var busy = false;
      function paint() { Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i < digits.length ? 'on' : ''; }); }
      function press(d) {
        if (busy || digits.length >= 6) return;
        digits += d; paint(); err.textContent = '';
        if (digits.length === 6) submit();
      }
      function submit() {
        busy = true;
        A.call('unlock', { pin: digits }).then(function (res) {
          A.setUnlock({ token: res.unlockToken, expiresAt: res.expiresAt });
          S.unlock = A.unlockInfo();
          screen.remove();
          toast('열람 권한이 확인되었습니다');
          resolve(true);
        }).catch(function (e) {
          busy = false; digits = ''; paint();
          err.textContent = e.message;
          if (e.code === 'NO_PIN') { screen.remove(); navigate('settings'); resolve(false); }
          if (e.code === 'FORBIDDEN' || e.code === 'LOCKED') { setTimeout(function () { screen.remove(); resolve(false); }, 1500); }
        });
      }
      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '지우기'];
      var pad = h('div', { class: 'pin-pad' }, keys.map(function (k) {
        if (k === '') return h('span');
        if (k === '지우기') return h('button', { class: 'txt', onclick: function () { digits = digits.slice(0, -1); paint(); } }, k);
        return h('button', { onclick: function () { press(k); } }, k);
      }));
      var screen = h('div', { class: 'pin-screen' },
        h('div', { class: 'blob', style: 'width:300px;height:300px;left:-70px;top:60px;background:#5e5ce6;animation:floatA 11s ease-in-out infinite' }),
        h('div', { class: 'blob', style: 'width:260px;height:260px;right:-60px;top:280px;background:#ff2d8a;animation:floatB 13s ease-in-out infinite' }),
        h('button', { class: 'close glass-dark', onclick: function () { screen.remove(); resolve(false); }, 'aria-label': '닫기' }, icon('back')),
        h('div', { style: 'position:relative;z-index:1;width:100%;max-width:360px' },
          h('div', { class: 'icon' }, icon('lock')),
          h('div', { style: 'font-size:22px;font-weight:700' }, '잠긴 관찰 기록'),
          h('div', { style: 'font-size:13.5px;color:rgba(255,255,255,.7);margin-top:6px' }, context || '열람하려면 PIN 6자리를 입력하세요'),
          dots, err, pad,
          h('div', { class: 'note' }, '열람 가능: 담임교사 · 기록 작성자 · 상담/복지/보건 전용', h('br'), '해제 시 열람자·시각이 자동 기록됩니다.' + (A.isDemo() ? ' (데모 PIN 123456)' : ''))));
      document.body.appendChild(screen);
      window.addEventListener('keydown', function onKey(e) {
        if (!document.body.contains(screen)) { window.removeEventListener('keydown', onKey); return; }
        if (/^\d$/.test(e.key)) press(e.key);
        if (e.key === 'Backspace') { digits = digits.slice(0, -1); paint(); }
        if (e.key === 'Escape') { screen.remove(); resolve(false); }
      });
    });
  }

  function unlockRemaining() {
    var u = A.unlockInfo();
    if (!u) return 0;
    return Math.max(1, Math.ceil((u.expiresAt - Date.now()) / 60000));
  }
  function lockAll() { A.setUnlock(null); S.unlock = null; render(); toast('모든 잠긴 기록을 다시 잠갔습니다'); }

  // ------------------------------------------------------------------
  // 라우터
  // ------------------------------------------------------------------
  function parseRoute() {
    var hash = location.hash.replace(/^#\/?/, '');
    var q = {};
    var qi = hash.indexOf('?');
    if (qi >= 0) {
      hash.slice(qi + 1).split('&').forEach(function (p) { var kv = p.split('='); q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
      hash = hash.slice(0, qi);
    }
    var parts = hash.split('/').filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    var name = parts[0] || 'home', params = {};
    if (name === 'student' && parts[1]) params.id = parts[1];
    if (name === 'record') { if (parts[1] === 'new') name = 'record.new'; else if (parts[2] === 'edit') { name = 'record.edit'; params.id = parts[1]; } }
    if (name === 'admin') { name = 'admin.' + (parts[1] || 'students'); }
    if (name === 'meeting' && parts[1]) { name = 'meeting.detail'; params.id = parts[1]; }
    return { name: name, params: params, query: q };
  }
  function navigate(path, query) {
    var qs = query ? '?' + Object.keys(query).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); }).join('&') : '';
    location.hash = '#/' + path + qs;
  }
  window.addEventListener('hashchange', function () { S.route = parseRoute(); render(); });

  // ------------------------------------------------------------------
  // 데이터 로드
  // ------------------------------------------------------------------
  function bootstrap() {
    return A.call('me').then(function (res) {
      S.me = L.normalizeTeacher(res.me);
      S.me.hasPin = !!res.me.hasPin;
      S.me.mustChangePassword = !!res.me.mustChangePassword;
      S.tags = (res.tags || []).slice().sort(function (a, b) { return a.order - b.order; });
      S.phrases = res.phrases || [];
      S.settings = Object.assign({}, L.DEFAULT_SETTINGS, res.settings || {});
      S.students = (res.students || []).slice().sort(function (a, b) { return L.studentSortKey(a) < L.studentSortKey(b) ? -1 : 1; });
      S.unlock = A.unlockInfo();
      A.flushOutbox();
      return refreshPending().then(function () { return true; });
    });
  }

  function loadActivity() {
    return A.call('students.activity').then(function (res) { S.activity = res.activity || {}; return S.activity; }).catch(function () { return S.activity; });
  }

  // ------------------------------------------------------------------
  // 공통 레이아웃
  // ------------------------------------------------------------------
  var root = document.getElementById('app');

  function render() {
    clear(root);
    if (!A.token() || !S.me) { root.appendChild(viewLogin()); return; }
    if (S.me.mustChangePassword && S.route.name !== 'settings') { navigate('settings', { first: '1' }); return; }
    var name = S.route.name;
    var views = {
      'home': viewHome, 'students': viewStudents, 'student': viewStudent, 'record.new': viewRecordForm, 'record.edit': viewRecordForm,
      'records': viewRecords, 'stats': viewStats, 'settings': viewSettings, 'meeting': viewMeetings, 'meeting.detail': viewMeetingDetail,
      'admin.students': viewAdminStudents, 'admin.teachers': viewAdminTeachers, 'admin.tags': viewAdminTags
    };
    var fn = views[name] || viewHome;
    root.appendChild(shell(fn()));
    window.scrollTo(0, 0);
  }

  function shell(content) {
    var nav = [
      ['home', '대시보드', 'home'], ['records', '기록 목록', 'list'], ['students', '학생 명단', 'users']
    ];
    if (L.isAdmin(S.me)) nav.push(['admin/teachers', '교사 명단', 'users']);
    nav.push(['stats', '통계·리포트', 'chart'], ['meeting', '통합지원 회의', 'list'], ['settings', '설정 · 권한', 'gear']);
    var cur = S.route.name.split('.')[0];
    var remaining = unlockRemaining();
    var sidebar = h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, '관찰관리'),
      nav.map(function (n) {
        var on = (n[0] === 'home' && cur === 'home') || (n[0] !== 'home' && (cur === n[0] || (n[0] === 'students' && (cur === 'student' || cur === 'record')) || (n[0] === 'admin/teachers' && cur === 'admin')));
        return h('div', { class: 'row' + (on ? ' on' : ''), onclick: function () { navigate(n[0]); } }, n[1], n[0] === 'admin/teachers' ? [roleBadge('admin'), pendingBadge()] : null);
      }),
      h('div', { class: 'glass legend role-legend' },
        h('div', {}, roleBadge('homeroom'), '담임교사'), h('div', {}, roleBadge('specialist'), '분야 담당(상담·복지·보건)'),
        h('div', {}, roleBadge('subject'), '교과교사'), h('div', {}, roleBadge('admin'), '행정담당자')),
      h('div', { class: 'glass me' },
        h('div', { class: 'name' }, S.me.name, roleBadge(L.primaryRole(S.me))),
        h('div', { class: 'muted' }, describeMe()),
        remaining ? h('div', { class: 'unlock', onclick: lockAll }, icon('unlock'), '잠금 해제됨 · ' + remaining + '분 남음')
          : h('div', { class: 'unlock', onclick: function () { pinScreen().then(function (ok) { if (ok) render(); }); } }, icon('lock'), '잠긴 기록 열람 해제'))
    );
    var tabs = [['home', '홈', 'home'], ['students', '학생', 'users'], ['records', '기록', 'list'], ['settings', '설정', 'gear']];
    var tabbar = h('nav', { class: 'tabbar glass' }, tabs.map(function (t) {
      var on = cur === t[0] || (t[0] === 'students' && (cur === 'student' || cur === 'record')) || (t[0] === 'settings' && (cur === 'admin' || cur === 'stats' || cur === 'meeting'));
      return h('button', { class: on ? 'on' : '', onclick: function () { navigate(t[0]); } }, h('span', { html: ICON[t[2]], style: 'width:22px;height:22px;display:block' }), t[1]);
    }));
    return h('div', { class: 'gs' },
      h('div', { class: 'blob a' }), h('div', { class: 'blob b' }), h('div', { class: 'blob c' }),
      h('div', { class: 'shell' }, sidebar, h('main', { class: 'main' }, h('div', { class: 'page' }, content))),
      tabbar);
  }

  function describeMe() {
    if (S.me.homeroom) return S.me.homeroom + ' 담임';
    if (L.hasRole(S.me, 'specialist')) return (S.me.field || '분야') + ' 전담';
    if (L.isAdmin(S.me)) return '행정담당자';
    return '교과교사' + (S.me.classes.length ? ' · ' + S.me.classes.length + '개 반' : '');
  }

  function syncPill() {
    var n = A.outbox().length;
    if (!n) return null;
    return h('span', { class: 'sync pending' }, h('span', { class: 'dot' }), '재전송 대기 ' + n + '건');
  }

  function loadingBox() { return h('div', { class: 'center' }, h('span', { class: 'spinner' })); }
  function errorBox(e) { return h('div', { class: 'glass card', style: 'color:#8a1046' }, e.message || String(e)); }

  // ------------------------------------------------------------------
  // 로그인
  // ------------------------------------------------------------------
  function signupModal() {
    var t = { email: '', name: '', roles: [], homeroom: '', classes: '', field: '' };
    var idIn = h('input', { class: 'input', placeholder: '아이디 (영문·숫자, 이메일도 가능)', autocapitalize: 'off', autocomplete: 'username', oninput: function (e) { t.email = e.target.value.trim().toLowerCase(); } });
    var nameIn = h('input', { class: 'input', placeholder: '이름', oninput: function (e) { t.name = e.target.value; } });
    var pw1 = h('input', { class: 'input', type: 'password', placeholder: '비밀번호 (8자 이상)', autocomplete: 'new-password' });
    var pw2 = h('input', { class: 'input', type: 'password', placeholder: '비밀번호 확인', autocomplete: 'new-password' });
    var homeroomIn = h('input', { class: 'input', placeholder: '담임반 (예: 기계과 3-2)', hidden: true, oninput: function (e) { t.homeroom = e.target.value.trim(); } });
    var classesIn = h('input', { class: 'input', placeholder: '수업반 (세미콜론 구분, 예: 전기과 2-1;기계과 3-4)', hidden: true, oninput: function (e) { t.classes = e.target.value; } });
    var fieldSel = h('select', { class: 'select', hidden: true, onchange: function (e) { t.field = e.target.value; } }, h('option', { value: '' }, '전담 분야 선택'), L.SPECIALIST_FIELDS.map(function (f) { return h('option', { value: f }, f); }));
    var roleBox = h('div', { class: 'pill-row' }, ['homeroom', 'subject', 'specialist'].map(function (k) {
      var b = h('button', { class: 'pill sm', type: 'button', onclick: function () {
        var on = t.roles.indexOf(k) >= 0;
        t.roles = on ? t.roles.filter(function (x) { return x !== k; }) : t.roles.concat([k]);
        b.className = 'pill sm' + (on ? '' : ' on');
        homeroomIn.hidden = t.roles.indexOf('homeroom') < 0;
        classesIn.hidden = t.roles.indexOf('subject') < 0 && t.roles.indexOf('homeroom') < 0;
        fieldSel.hidden = t.roles.indexOf('specialist') < 0;
      } }, L.ROLES[k].label);
      return b;
    }));
    var msg = h('div', { class: 'small', style: 'min-height:18px;color:#8a1046' });
    var submit = h('button', { class: 'cta', type: 'button', onclick: function () {
      if (pw1.value !== pw2.value) { msg.textContent = '비밀번호 확인이 일치하지 않습니다.'; return; }
      var err = L.validateSignup(L.normalizeTeacher(t), pw1.value);
      if (err) { msg.textContent = err; return; }
      submit.disabled = true; msg.textContent = '';
      A.call('signup', { teacher: t, password: pw1.value }).then(function () {
        m.close();
        modal([h('div', { class: 'h2' }, '가입 신청 완료'), h('p', { class: 'muted', style: 'margin-top:8px;font-size:14px;line-height:1.6' }, '관리자가 승인하면 로그인할 수 있습니다. 승인 여부는 관리자에게 확인하세요.'),
          h('div', { class: 'modal-actions' }, h('button', { class: 'cta', onclick: function () { document.querySelector('.modal-back').remove(); } }, '확인'))]);
      }).catch(function (e) { submit.disabled = false; msg.textContent = e.message; });
    } }, '가입 신청');
    var m = modal([h('div', { class: 'h2' }, '교사 회원가입'),
      h('p', { class: 'small', style: 'margin:4px 0 12px' }, '신청 후 관리자(행정담당자)가 승인하면 사용할 수 있습니다. 역할과 담당 학급은 승인 시 관리자가 조정할 수 있습니다.'),
      h('div', { class: 'form' }, idIn, nameIn, pw1, pw2, h('div', { class: 'kicker' }, '역할 (복수 선택)'), roleBox, homeroomIn, classesIn, fieldSel, msg),
      h('div', { class: 'modal-actions' }, h('button', { class: 'cta dim', onclick: function () { m.close(); } }, '취소'), submit)], { sticky: true });
  }

  function viewLogin() {
    var email = h('input', { class: 'input', type: 'text', placeholder: '아이디 (이메일 또는 ID)', autocomplete: 'username', autocapitalize: 'off' });
    var pw = h('input', { class: 'input', type: 'password', placeholder: '비밀번호', autocomplete: 'current-password' });
    var err = h('div', { class: 'small', style: 'color:#8a1046;min-height:18px' });
    var btn = h('button', { class: 'cta', type: 'submit' }, '로그인');
    function doLogin(e, demoEmail) {
      if (e) e.preventDefault();
      btn.disabled = true; err.textContent = '';
      A.call('login', { email: demoEmail || email.value.trim(), password: demoEmail ? 'demo' : pw.value }).then(function (res) {
        A.setToken(res.token);
        return bootstrap();
      }).then(function () { S.route = parseRoute(); render(); }).catch(function (ex) { err.textContent = ex.message; btn.disabled = false; });
    }
    var form = h('form', { class: 'form', onsubmit: doLogin }, email, pw, err, btn,
      h('div', { style: 'text-align:center;margin-top:4px' }, h('span', { class: 'small' }, '계정이 없으신가요? '), h('button', { class: 'link-btn', type: 'button', onclick: signupModal }, '교사 회원가입')));
    var demo = null;
    if (A.isDemo()) {
      demo = h('div', { style: 'margin-top:18px' },
        h('div', { class: 'kicker', style: 'margin-bottom:8px' }, '데모 계정으로 바로 보기'),
        h('div', { class: 'pill-row' }, window.SOSMock.accounts().map(function (t) {
          return h('button', { class: 'pill sm', type: 'button', onclick: function () { doLogin(null, t.email); } }, t.name, roleBadge(L.primaryRole(t)));
        })),
        h('div', { class: 'small', style: 'margin-top:10px' }, '데모 모드입니다. 모든 학생·교사 이름과 기록은 가상의 예시이며 이 브라우저에만 저장됩니다.'));
    }
    return h('div', { class: 'gs', style: 'min-height:100vh' },
      h('div', { class: 'blob a' }), h('div', { class: 'blob b' }), h('div', { class: 'blob c' }),
      h('div', { class: 'login-wrap' },
        h('div', { class: 'glass login-card' },
          h('div', { class: 'logo' }, icon('check')),
          h('div', { class: 'h1', style: 'font-size:24px' }, CFG.appName || '관찰관리'),
          h('p', { class: 'muted', style: 'margin:6px 0 20px' }, '교사 계정으로 로그인하세요. 학생 기록은 학교 계정 시트에만 저장됩니다.'),
          form, demo)));
  }

  // ------------------------------------------------------------------
  // 홈 / 대시보드
  // ------------------------------------------------------------------
  function viewHome() {
    var box = h('div', {}, loadingBox());
    A.call('dashboard').then(function (d) {
      S.lastDash = d;
      clear(box);
      box.appendChild(homeContent(d));
    }).catch(function (e) { clear(box); box.appendChild(errorBox(e)); });
    return box;
  }

  function statTile(num, label, cls) { return h('div', { class: 'glass' }, h('div', { class: 'num ' + (cls || '') }, num), h('div', { class: 'stat-label' }, label)); }

  function alertCard(alerts, compact) {
    if (!alerts.length) return h('div', { class: 'glass card' }, h('div', { style: 'font-size:13.5px;font-weight:600' }, '위기 알림 없음'), h('div', { class: 'small' }, '문제행동 연속 기록, 장기 미기록 학생이 없습니다.'));
    var shown = compact ? alerts.slice(0, 3) : alerts;
    return h('div', { class: 'glass card alert' },
      h('div', { style: 'display:flex;align-items:center;gap:9px' },
        h('span', { style: 'width:9px;height:9px;border-radius:50%;background:#ff2d8a;box-shadow:0 0 0 4px rgba(255,45,138,.2)' }),
        h('div', { style: 'font-size:13.5px;font-weight:600;color:#8a1046' }, '위기 알림 ' + alerts.length + '건'),
        compact && alerts.length > 3 ? h('span', { class: 'link-btn', style: 'margin-left:auto;font-size:12.5px', onclick: function () { alertsModal(alerts); } }, '모두 보기') : null),
      h('div', { style: 'font-size:13px;line-height:1.6;color:rgba(11,18,32,.72);margin-top:8px' }, shown.map(function (a) {
        return h('div', { style: 'padding:4px 0;cursor:pointer', onclick: function () { navigate('student/' + a.studentId); } }, h('strong', {}, a.name), ' · ' + a.text);
      })));
  }
  function alertsModal(alerts) {
    var m = modal([h('div', { class: 'h2' }, '위기 알림 ' + alerts.length + '건'), h('div', { style: 'margin-top:10px' }, alerts.map(function (a) {
      return h('div', { class: 'row', onclick: function () { m.close(); navigate('student/' + a.studentId); } }, h('div', { class: 'body' }, h('div', { class: 'title' }, a.name), h('div', { class: 'sub' }, a.text)));
    }))]);
  }

  function distributionChart(dist) {
    var max = Math.max.apply(null, dist.map(function (d) { return d.count; }).concat([1]));
    return h('div', { class: 'bars' }, dist.map(function (d) {
      return h('div', { class: 'col' }, h('span', { class: 'val' }, d.count), h('div', { class: 'bar ' + (d.tag.color || 'etc'), style: 'height:' + Math.max(4, Math.round(d.count / max * 84)) + 'px' }), h('span', { class: 'lbl' }, d.tag.name));
    }));
  }

  function homeContent(d) {
    var st = d.stats;
    var head = h('div', { class: 'page-head' },
      h('div', { class: 'grow' }, h('div', { class: 'kicker' }, L.formatDateKo(d.today, true)), h('div', { class: 'h1', style: 'margin-top:6px' }, L.scopeLabel(S.me) || '오늘의 관찰')),
      h('div', { class: 'inline' }, syncPill(), h('button', { class: 'cta auto', onclick: startNewRecord }, '＋ 기록')));
    var stats = h('div', { class: 'stats four' },
      statTile(st.todayCount, '오늘 기록'), statTile(S.me.homeroom ? st.noRecord : d.alerts.length, S.me.homeroom ? '2주 미기록' : '위기 알림', 'pink'),
      statTile(st.locked, '잠금 기록', 'violet'), h('div', { class: 'desktop-only' }, statTile(st.rate + '%', '30일 기록률', 'cyan')));
    var todayRows = d.todayRecords.length ? d.todayRecords.map(function (r) { return recordRow(r); })
      : h('div', { class: 'empty' }, '오늘 작성된 기록이 없습니다.', h('br'), '학생을 골라 첫 기록을 남겨보세요.');
    var recentTable = h('div', { class: 'glass desktop-only', style: 'padding:20px 22px' },
      h('div', { style: 'display:flex;align-items:baseline;gap:10px' }, h('div', { class: 'h2' }, '최근 기록'), h('span', { class: 'link-btn', style: 'margin-left:auto', onclick: function () { navigate('records'); } }, '전체 보기')),
      recordTable(d.recent.slice(0, 8)));
    return h('div', {},
      head,
      h('div', { class: 'section' }, stats),
      h('div', { class: 'section two-col' },
        h('div', { class: 'col-left' },
          h('div', { class: 'kicker', style: 'padding:0 8px 6px' }, '오늘 기록'),
          h('div', { class: 'glass', style: 'padding:6px' }, todayRows),
          h('div', { class: 'section desktop-only' }, recentTable)),
        h('div', { class: 'cards col-right' }, alertCard(d.alerts, true),
          h('div', { class: 'glass card desktop-only' }, h('div', { class: 'h2', style: 'font-size:14.5px' }, '분야별 분포 · 이번 학기'), distributionChart(d.distribution)))),
      h('div', { class: 'section' }, h('button', { class: 'cta', onclick: startNewRecord }, '＋ 새 관찰 기록')));
  }

  function startNewRecord() {
    navigate('students', { pick: '1' });
  }

  function recordRow(r) {
    var s = studentById(r.studentId) || { name: '?', number: '' };
    return h('div', { class: 'row', onclick: function () { navigate('student/' + r.studentId); } },
      h('div', { class: 'avatar' + (r.locked ? ' hot' : '') }, L.pad2(+s.number || 0)),
      h('div', { class: 'body' },
        h('div', { class: 'title' }, s.name, h('span', { class: 'time' }, r.time)),
        r.locked ? h('div', { style: 'margin-top:3px' }, lockBadge(r.tags.map(function (t) { return tagById(t).name; }).join('·') + ' · 잠김'))
          : h('div', { class: 'sub' }, r.tags.map(function (t) { return tagById(t).name; }).join('·') + ' · ' + r.content)),
      h('div', { class: 'right' }, r.authorName, roleBadge(r.authorRole)));
  }

  function recordTable(list) {
    if (!list.length) return h('div', { class: 'empty' }, '기록이 없습니다.');
    return h('div', { class: 'table-wrap' }, h('div', { class: 'table', style: 'min-width:520px' },
      h('div', { class: 'tr th' }, h('div', {}, '일시'), h('div', {}, '학생'), h('div', {}, '내용'), h('div', {}, '작성자')),
      list.map(function (r) {
        var s = studentById(r.studentId) || { name: '?' };
        return h('div', { class: 'tr', onclick: function () { navigate('student/' + r.studentId); } },
          h('div', { class: 'dim' }, L.formatShort(r.date) + ' ' + r.time), h('div', {}, s.name),
          h('div', { class: 'content' }, r.tags.map(function (t) { return tagChip(t); }), r.locked ? lockBadge(L.lockTitle(r) + ' · 잠김') : h('span', { class: 'txt' }, r.content)),
          h('div', { class: 'dim' }, r.authorName, roleBadge(r.authorRole)));
      })));
  }

  // ------------------------------------------------------------------
  // 학생 찾기
  // ------------------------------------------------------------------
  var studentFilter = { dept: '', grade: '', klass: '', q: '' };

  function viewStudents() {
    var picking = S.route.query.pick === '1';
    var active = S.students.filter(function (s) { return !s.status || s.status === '재학'; });
    var depts = [], grades = [], classes = [];
    active.forEach(function (s) { if (depts.indexOf(s.dept) < 0) depts.push(s.dept); if (grades.indexOf(+s.grade) < 0) grades.push(+s.grade); });
    grades.sort();
    var f = studentFilter;
    if (!f.dept && !f.q && S.me.homeroom) { var parts = /^(.*) (\d+)-(\d+)$/.exec(S.me.homeroom); if (parts) { f.dept = parts[1]; f.grade = parts[2]; f.klass = parts[3]; } }
    var listBox = h('div', { class: 'glass', style: 'padding:6px;margin-top:12px' });
    var titleEl = h('div', { class: 'kicker', style: 'margin:16px 8px 0' });
    var search = h('input', { type: 'search', placeholder: '이름·번호로 바로 찾기', value: f.q, oninput: function (e) { f.q = e.target.value.trim(); paintList(); } });

    function classesFor() {
      var c = [];
      active.forEach(function (s) { if ((!f.dept || s.dept === f.dept) && (!f.grade || +s.grade === +f.grade) && c.indexOf(+s.klass) < 0) c.push(+s.klass); });
      return c.sort(function (a, b) { return a - b; });
    }
    var filterBox = h('div');
    function paintFilters() {
      clear(filterBox);
      var mine = [];
      if (S.me.homeroom) mine.push({ key: S.me.homeroom, label: S.me.homeroom + ' · 담임' });
      S.me.classes.forEach(function (c) { if (c !== S.me.homeroom) mine.push({ key: c, label: c }); });
      if (mine.length) filterBox.appendChild(h('div', { class: 'section' }, h('div', { class: 'kicker' }, '내 담당'), h('div', { class: 'pill-row' }, mine.map(function (m) {
        var on = !f.q && f.dept + ' ' + f.grade + '-' + f.klass === m.key;
        return h('button', { class: 'pill' + (on ? ' on' : ''), onclick: function () { var p = /^(.*) (\d+)-(\d+)$/.exec(m.key); f.dept = p[1]; f.grade = p[2]; f.klass = p[3]; f.q = ''; search.value = ''; paintFilters(); paintList(); } }, m.label);
      }))));
      filterBox.appendChild(h('div', { class: 'section' }, h('div', { class: 'kicker' }, '과'), h('div', { class: 'pill-row' }, depts.map(function (d) {
        return h('button', { class: 'pill' + (f.dept === d ? ' on' : ''), onclick: function () { f.dept = f.dept === d ? '' : d; f.klass = ''; paintFilters(); paintList(); } }, d);
      }))));
      filterBox.appendChild(h('div', { class: 'section', style: 'margin-top:12px' }, h('div', { class: 'kicker' }, '학년'), h('div', { class: 'pill-row' }, grades.map(function (g) {
        return h('button', { class: 'pill' + (+f.grade === g ? ' on' : ''), onclick: function () { f.grade = +f.grade === g ? '' : g; f.klass = ''; paintFilters(); paintList(); } }, g + '학년');
      }))));
      filterBox.appendChild(h('div', { class: 'section', style: 'margin-top:12px' }, h('div', { class: 'kicker' }, '반'), h('div', { class: 'pill-row' }, classesFor().map(function (k) {
        return h('button', { class: 'pill' + (+f.klass === k ? ' on' : ''), onclick: function () { f.klass = +f.klass === k ? '' : k; paintFilters(); paintList(); } }, k + '반');
      }))));
    }
    function paintList() {
      clear(listBox);
      var q = f.q.toLowerCase();
      var list = active.filter(function (s) {
        if (q) return s.name.toLowerCase().indexOf(q) >= 0 || String(s.number) === q || L.classKey(s).indexOf(q) >= 0;
        return (!f.dept || s.dept === f.dept) && (!f.grade || +s.grade === +f.grade) && (!f.klass || +s.klass === +f.klass);
      });
      titleEl.textContent = (q ? '검색 결과' : [f.dept, f.grade ? f.grade + (f.klass ? '-' + f.klass : '학년') : ''].filter(Boolean).join(' ') || '전체') + ' · ' + list.length + '명';
      if (!list.length) { listBox.appendChild(h('div', { class: 'empty' }, '해당하는 학생이 없습니다.')); return; }
      if (list.length > 200 && !q) { listBox.appendChild(h('div', { class: 'empty' }, '학생이 ' + list.length + '명입니다. 과·학년·반을 고르거나 이름으로 검색하세요.')); return; }
      list.forEach(function (s) {
        var last = S.activity[s.id];
        listBox.appendChild(h('div', { class: 'row', onclick: function () { picking ? openRecordForm(s.id) : navigate('student/' + s.id); } },
          h('div', { class: 'avatar' }, L.pad2(+s.number || 0)),
          h('div', { class: 'body' }, h('div', { class: 'title' }, s.name), q ? h('div', { class: 'sub' }, L.classKey(s)) : null),
          h('div', { class: 'right' }, last ? L.formatShort(last) : '기록 없음')));
      });
    }
    paintFilters(); paintList();
    if (!Object.keys(S.activity).length) loadActivity().then(paintList);
    return h('div', {},
      h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('div', { class: 'h1' }, picking ? '기록할 학생 선택' : '학생 찾기'), picking ? h('div', { class: 'muted', style: 'margin-top:4px' }, '학생을 누르면 바로 기록 창이 열립니다') : null),
        L.isAdmin(S.me) ? h('button', { class: 'pill', onclick: function () { navigate('admin/students'); } }, '명단 관리') : null),
      h('div', { class: 'glass search' }, icon('search'), search),
      filterBox, titleEl, listBox,
      h('div', { class: 'small', style: 'margin:14px 8px 0;text-align:center' }, '명단 추가·수정은 관리자 계정에서만 가능합니다'));
  }

  // ------------------------------------------------------------------
  // 학생 상세
  // ------------------------------------------------------------------
  function viewStudent() {
    var s = studentById(S.route.params.id);
    if (!s) return h('div', { class: 'empty' }, '학생을 찾을 수 없습니다.');
    var box = h('div', {}, loadingBox());
    var filterTag = '';
    var role = L.roleForStudent(S.me, s);
    var records = [];
    function paint() {
      clear(box);
      var live = records.filter(function (r) { return !r.deleted; });
      var st = L.studentStats(live, today());
      var shown = filterTag ? live.filter(function (r) { return r.tags.indexOf(filterTag) >= 0; }) : live;
      var lockedCount = live.filter(function (r) { return r.locked; }).length;
      box.appendChild(h('div', { class: 'topbar' },
        h('button', { class: 'back glass', onclick: function () { history.length > 1 ? history.back() : navigate('students'); } }, icon('back')),
        h('div', { class: 'grow' }),
        h('span', { class: 'pill sm' }, S.me.name, roleBadge(role), ' · ' + L.roleLabel(role, S.me) + '으로 열람 중')));
      box.appendChild(h('div', {}, h('div', { class: 'kicker' }, L.classKey(s) + (s.number ? ' · ' + s.number + '번' : '')), h('div', { class: 'h1', style: 'font-size:36px;margin-top:6px' }, s.name)));
      box.appendChild(h('div', { class: 'stats', style: 'margin-top:16px' },
        h('div', { class: 'glass' }, h('div', { style: 'font-size:24px;font-weight:700' }, st.total), h('div', { class: 'stat-label' }, '누적')),
        h('div', { class: 'glass' }, h('div', { style: 'font-size:24px;font-weight:700' }, st.last30), h('div', { class: 'stat-label' }, '최근 30일')),
        h('div', { class: 'glass' }, h('div', { style: 'font-size:22px;font-weight:700;color:#0a84ff' }, st.topTag ? tagById(st.topTag).name : '—'), h('div', { class: 'stat-label' }, '주요 분야'))));
      var chips = [h('button', { class: 'pill sm' + (!filterTag ? ' on' : ''), onclick: function () { filterTag = ''; paint(); } }, '전체 ', h('span', { class: 'chip-count' }, st.total))];
      activeTags().forEach(function (t) { if (st.byTag[t.id]) chips.push(h('button', { class: 'pill sm' + (filterTag === t.id ? ' on' : ''), onclick: function () { filterTag = t.id; paint(); } }, t.name + ' ', h('span', { class: 'chip-count' }, st.byTag[t.id]))); });
      box.appendChild(h('div', { class: 'pill-row', style: 'margin-top:16px' }, chips));
      if (lockedCount && !unlockRemaining()) box.appendChild(h('div', { class: 'small', style: 'margin:10px 4px 0' }, '잠긴 기록 ' + lockedCount + '건이 있습니다. 열람 권한이 있으면 해제 버튼으로 열 수 있습니다.'));
      box.appendChild(h('div', { class: 'cards', style: 'margin-top:14px' }, shown.length ? shown.map(function (r) { return recordCard(r, s, reload); }) : h('div', { class: 'empty' }, '기록이 없습니다.')));
      box.appendChild(h('div', { class: 'section' }, h('button', { class: 'cta', onclick: function () { openRecordForm(s.id); } }, '＋ 이 학생 기록하기')));
      box.appendChild(h('div', { style: 'text-align:center;margin-top:10px' }, h('button', { class: 'link-btn', onclick: function () { navigate('meeting/new', { student: s.id }); } }, '이 학생을 안건으로 회의 만들기')));
      if (s.memo) box.appendChild(h('div', { class: 'small', style: 'margin-top:10px' }, '메모: ' + s.memo));
    }
    function reload() {
      return A.call('records.list', { studentId: s.id }).then(function (res) { records = res.records.map(function (r) { return Object.assign(L.normalizeRecord(r), { locked: r.locked, canUnlock: r.canUnlock }); }); paint(); })
        .catch(function (e) { clear(box); box.appendChild(errorBox(e)); });
    }
    reload();
    return box;
  }

  function recordCard(r, s, reload) {
    var head = h('div', { class: 'rec-head' }, r.tags.map(function (t) { return tagChip(t); }), L.formatDateKo(r.date) + ' ' + r.time + ' · ', authorLine(r));
    var body;
    if (r.locked) {
      body = h('div', { class: 'rec-lock' },
        h('div', { class: 'icon' }, icon('lock')),
        h('div', { style: 'flex:1' }, h('div', { class: 't1' }, L.lockTitle(r) + ' — 잠김'), h('div', { class: 't2' }, r.canUnlock ? '작성자·담임·전담 계정만 해제 가능' : '열람 권한이 없는 기록입니다')),
        r.canUnlock ? h('button', { class: 'pill sm', onclick: function () {
          pinScreen((s ? s.name + ' · ' : '') + r.tags.map(function (t) { return tagById(t).name; }).join('·') + ' 분야 기록').then(function (ok) { if (ok) reload(); });
        } }, '해제') : null);
    } else {
      body = h('div', {}, h('p', { class: 'rec-body' }, r.content),
        r.action ? h('div', { class: 'rec-meta' }, '조치·후속: ' + r.action) : null,
        r.place ? h('div', { class: 'rec-meta' }, '장소: ' + r.place) : null);
    }
    var actions = null;
    if (L.canEditRecord(S.me, r) || L.canDeleteRecord(S.me, r)) {
      actions = h('div', { class: 'rec-actions' },
        r.visibility === 'restricted' ? lockBadge('담당 교사만') : h('span', { class: 'pill sm ghost', style: 'cursor:default' }, '교사 전체'),
        L.canEditRecord(S.me, r) ? h('button', { class: 'pill sm', onclick: function () { navigate('record/' + r.id + '/edit'); } }, '수정') : null,
        L.canDeleteRecord(S.me, r) ? h('button', { class: 'pill sm ghost', onclick: function () {
          confirmDialog('기록 삭제', '이 기록을 삭제할까요? 삭제 후에도 시트에는 삭제 표시로 남습니다.', '삭제', true).then(function (ok) {
            if (!ok) return;
            A.call('records.delete', { id: r.id, version: r.version }).then(function () { toast('삭제했습니다'); reload(); }).catch(function (e) { toast(e.message, true); if (e.code === 'CONFLICT') reload(); });
          });
        } }, '삭제') : null);
    }
    if (r.updatedAt && r.updatedAt !== r.createdAt && r.version > 1) head.appendChild(h('span', { class: 'small' }, '(수정됨)'));
    return h('div', { class: 'glass card' }, head, body, actions);
  }

  // ------------------------------------------------------------------
  // 기록 작성 / 수정
  // ------------------------------------------------------------------
  function openRecordForm(studentId) {
    noticeBeforeWrite().then(function (ok) { if (ok) navigate('record/new', { student: studentId }); });
  }

  function viewRecordForm() {
    var editing = S.route.name === 'record.edit';
    var box = h('div', {}, loadingBox());
    if (editing) {
      A.call('records.get', { id: S.route.params.id }).then(function (res) {
        var r = res.record;
        if (r.locked) throw new Error('잠긴 기록은 해제 후 수정할 수 있습니다.');
        clear(box); box.appendChild(recordForm(studentById(r.studentId), L.normalizeRecord(r)));
      }).catch(function (e) { clear(box); box.appendChild(errorBox(e)); });
      return box;
    }
    var s = studentById(S.route.query.student);
    if (!s) return h('div', { class: 'empty' }, '학생을 먼저 선택하세요.', h('div', { style: 'margin-top:12px' }, h('button', { class: 'pill', onclick: function () { navigate('students', { pick: '1' }); } }, '학생 선택')));
    clear(box); box.appendChild(recordForm(s, null));
    return box;
  }

  function recordForm(s, existing) {
    var now = new Date();
    var draftKey = 'sos.draft.' + (existing ? existing.id : s.id);
    var draft = null;
    try { draft = existing ? null : JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch (e) { draft = null; }
    var rec = existing ? Object.assign({}, existing) : Object.assign({
      id: L.uuid(), studentId: s.id, date: L.toDateStr(now), time: L.toTimeStr(now), tags: [], content: '', action: '', place: '', visibility: 'all'
    }, draft || {});
    var role = L.roleForStudent(S.me, s);
    var saving = false;

    var textarea = h('textarea', { class: 'textarea', placeholder: '관찰한 사실과 행동을 적어주세요.', value: rec.content, oninput: function (e) { rec.content = e.target.value; saveDraft(); } });
    var actionIn = h('input', { class: 'input', placeholder: '조치·후속 계획 (선택)', value: rec.action, oninput: function (e) { rec.action = e.target.value; saveDraft(); } });
    var placeIn = h('input', { class: 'input', placeholder: '장소·상황 (선택)', value: rec.place, oninput: function (e) { rec.place = e.target.value; saveDraft(); } });
    var dateIn = h('input', { class: 'input', type: 'date', value: rec.date, oninput: function (e) { rec.date = e.target.value; } });
    var timeIn = h('input', { class: 'input', type: 'time', value: rec.time, oninput: function (e) { rec.time = e.target.value; } });
    var extra = h('div', { class: 'form', hidden: !(rec.action || rec.place), style: 'margin-top:12px' },
      h('div', { class: 'grid-2' }, dateIn, timeIn), actionIn, placeIn);
    var tagBox = h('div', { class: 'pill-row' });
    var phraseBox = h('div', { class: 'pill-row' });
    var visBox = h('div', { style: 'display:flex;gap:8px' });
    var errEl = h('div', { class: 'small', style: 'color:#8a1046;min-height:16px;margin-top:6px' });

    function saveDraft() { if (existing) return; try { localStorage.setItem(draftKey, JSON.stringify({ tags: rec.tags, content: rec.content, action: rec.action, place: rec.place, visibility: rec.visibility })); } catch (e) { /* 무시 */ } }
    function clearDraft() { try { localStorage.removeItem(draftKey); } catch (e) { /* 무시 */ } }

    function paintTags() {
      clear(tagBox);
      activeTags().forEach(function (t) {
        var on = rec.tags.indexOf(t.id) >= 0;
        tagBox.appendChild(h('button', { class: 'pill' + (on ? ' on' : ''), type: 'button', onclick: function () {
          if (on) rec.tags = rec.tags.filter(function (x) { return x !== t.id; }); else rec.tags = rec.tags.concat([t.id]);
          saveDraft(); paintTags(); paintPhrases();
        } }, t.name));
      });
    }
    function paintPhrases() {
      clear(phraseBox);
      var ids = rec.tags.length ? rec.tags : [];
      var list = S.phrases.filter(function (p) { return ids.indexOf(p.tagId) >= 0; });
      if (!list.length) { phraseBox.appendChild(h('span', { class: 'small' }, rec.tags.length ? '등록된 문장이 없습니다' : '분야를 고르면 자주 쓰는 문장이 나타납니다')); return; }
      list.forEach(function (p) {
        phraseBox.appendChild(h('button', { class: 'pill', type: 'button', style: 'font-size:13px', onclick: function () {
          var cur = textarea.value;
          textarea.value = cur + (cur && !/[\s.]$/.test(cur) ? '. ' : cur && !/\s$/.test(cur) ? ' ' : '') + p.text;
          rec.content = textarea.value; saveDraft(); textarea.focus();
        } }, p.text));
      });
    }
    function paintVis() {
      clear(visBox);
      visBox.appendChild(h('button', { class: 'pill' + (rec.visibility === 'all' ? ' on' : ''), type: 'button', style: 'flex:1;justify-content:center;font-size:13px', onclick: function () { rec.visibility = 'all'; saveDraft(); paintVis(); } }, '교사 전체'));
      visBox.appendChild(h('button', { class: 'pill' + (rec.visibility === 'restricted' ? ' lock' : ''), type: 'button', style: 'flex:1;justify-content:center;font-size:13px', onclick: function () { rec.visibility = 'restricted'; saveDraft(); paintVis(); } }, icon('lock'), '담당 교사만'));
    }
    paintTags(); paintPhrases(); paintVis();

    var saveBtn = h('button', { class: 'cta', style: 'flex:1', onclick: save }, existing ? '수정 저장' : '저장');
    function save() {
      if (saving) return;
      rec.content = textarea.value.trim();
      var err = L.validateRecord(rec);
      if (err) { errEl.textContent = err; return; }
      saving = true; saveBtn.disabled = true; errEl.textContent = '';
      var p = existing
        ? A.call('records.update', { id: rec.id, version: rec.version, patch: { date: rec.date, time: rec.time, tags: rec.tags, content: rec.content, action: rec.action, place: rec.place, visibility: rec.visibility } })
        : A.createRecord(rec);
      p.then(function (res) {
        clearDraft();
        S.activity[s.id] = rec.date > (S.activity[s.id] || '') ? rec.date : S.activity[s.id];
        toast(res && res.queued ? '연결이 불안정해 보관함에 저장했습니다. 자동으로 다시 전송합니다.' : (existing ? '수정했습니다' : '저장했습니다'));
        navigate('student/' + s.id);
      }).catch(function (e) {
        saving = false; saveBtn.disabled = false;
        if (e.code === 'CONFLICT') {
          var server = e.data && e.data.record;
          var m = modal([
            h('div', { class: 'h2' }, '다른 사용자가 먼저 수정했습니다'),
            h('p', { class: 'muted', style: 'margin-top:8px;font-size:14px;line-height:1.6' }, '서버의 최신 내용을 확인한 뒤 다시 저장하세요. 아래는 현재 저장된 내용입니다.'),
            server ? h('div', { class: 'glass card', style: 'margin-top:12px;font-size:14px;white-space:pre-wrap' }, server.content) : null,
            h('div', { class: 'modal-actions' },
              h('button', { class: 'cta dim', onclick: function () { m.close(); navigate('student/' + s.id); } }, '내 수정 취소'),
              server ? h('button', { class: 'cta', onclick: function () { rec.version = server.version; m.close(); toast('최신 버전 위에 다시 저장합니다'); } }, '내 내용으로 덮어쓰기') : null)
          ], { sticky: true });
          return;
        }
        errEl.textContent = e.message;
      });
    }

    var notice = null;
    if (role === 'homeroom') notice = h('span', { class: 'notice' }, '내 학급 학생 — ' + S.me.name, roleBadge('homeroom'), ' 담임으로 기록됩니다');
    else notice = h('span', { class: 'notice' }, S.me.name, roleBadge(role), ' ' + L.roleLabel(role, S.me) + '(으)로 기록됩니다');

    return h('div', {},
      h('div', { class: 'crumb' }, s.dept, h('span', {}, '›'), s.grade + '학년', h('span', {}, '›'), s.klass + '반',
        existing ? null : h('span', { class: 'link', onclick: function () { navigate('students', { pick: '1' }); } }, '변경')),
      h('div', { style: 'display:flex;align-items:baseline;gap:10px;margin-top:8px' }, h('div', { class: 'h1', style: 'font-size:30px' }, s.name), h('div', { class: 'muted', style: 'font-size:13px' }, (s.number ? s.number + '번' : ''))),
      h('div', { style: 'margin-top:9px' }, notice),
      h('div', { class: 'section' }, h('div', { class: 'kicker' }, '분야'), tagBox),
      h('div', { class: 'section' }, h('div', { class: 'kicker' }, '자주 쓰는 문장'), phraseBox),
      h('div', { class: 'section' }, h('div', { class: 'glass', style: 'padding:6px' }, textarea), errEl,
        h('button', { class: 'link-btn', style: 'margin-top:6px', onclick: function () { extra.hidden = !extra.hidden; } }, '일시 · 조치 · 장소 입력'), extra),
      h('div', { class: 'section' }, h('div', { class: 'kicker' }, '공개 범위 — 작성자가 선택'), visBox,
        h('div', { class: 'small', style: 'margin-top:8px' }, '담당 교사만 = 담임 · 작성자 · 상담/복지/보건 전용 계정')),
      h('div', { class: 'section', style: 'display:flex;gap:10px;align-items:center' },
        h('button', { class: 'glass', style: 'width:52px;height:52px;border-radius:18px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.7);cursor:pointer', title: '취소', onclick: function () { navigate('student/' + s.id); } }, icon('back')),
        saveBtn));
  }

  // ------------------------------------------------------------------
  // 기록 목록
  // ------------------------------------------------------------------
  var recFilter = { scope: 'all', tag: '', q: '', from: L.addDays(today(), -30), to: today() };

  function viewRecords() {
    var f = recFilter;
    var listBox = h('div', { class: 'cards', style: 'margin-top:14px' }, loadingBox());
    var all = [];
    function paint() {
      clear(listBox);
      var q = f.q.toLowerCase();
      var list = all.filter(function (r) {
        if (f.tag && r.tags.indexOf(f.tag) < 0) return false;
        if (!q) return true;
        var s = studentById(r.studentId) || {};
        return (s.name || '').toLowerCase().indexOf(q) >= 0 || (r.content || '').toLowerCase().indexOf(q) >= 0 || (r.authorName || '').toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) { listBox.appendChild(h('div', { class: 'empty' }, '조건에 맞는 기록이 없습니다.')); return; }
      list.slice(0, 200).forEach(function (r) {
        var s = studentById(r.studentId) || { name: '?' };
        var card = recordCard(r, s, load);
        card.insertBefore(h('div', { style: 'font-size:14px;font-weight:600;margin-bottom:6px;cursor:pointer', onclick: function () { navigate('student/' + r.studentId); } }, s.name + ' ', h('span', { class: 'muted' }, L.classKey(s))), card.firstChild);
        listBox.appendChild(card);
      });
      if (list.length > 200) listBox.appendChild(h('div', { class: 'small', style: 'text-align:center' }, '200건까지만 표시합니다. 기간이나 검색어를 좁혀주세요.'));
    }
    function load() {
      clear(listBox); listBox.appendChild(loadingBox());
      return A.call('records.list', { scope: f.scope === 'mine' ? 'mine' : '', from: f.from, to: f.to }).then(function (res) {
        all = res.records.map(function (r) { return Object.assign(L.normalizeRecord(r), { locked: r.locked, canUnlock: r.canUnlock }); }); paint();
      }).catch(function (e) { clear(listBox); listBox.appendChild(errorBox(e)); });
    }
    var tagRow = h('div', { class: 'pill-row', style: 'margin-top:10px' });
    function paintTags() {
      clear(tagRow);
      tagRow.appendChild(h('button', { class: 'pill sm' + (!f.tag ? ' on' : ''), onclick: function () { f.tag = ''; paintTags(); paint(); } }, '전체'));
      activeTags().forEach(function (t) { tagRow.appendChild(h('button', { class: 'pill sm' + (f.tag === t.id ? ' on' : ''), onclick: function () { f.tag = t.id; paintTags(); paint(); } }, t.name)); });
    }
    paintTags(); load();
    var scopeRow = h('div', { class: 'pill-row' }, [['all', '전체 기록'], ['mine', '내 기록']].map(function (o) {
      return h('button', { class: 'pill sm' + (f.scope === o[0] ? ' on' : ''), onclick: function () { f.scope = o[0]; render(); } }, o[1]);
    }));
    return h('div', {},
      h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('div', { class: 'h1' }, '기록 목록')), h('div', { class: 'inline' }, syncPill(), h('button', { class: 'cta auto', onclick: startNewRecord }, '＋ 기록'))),
      h('div', { class: 'glass search' }, icon('search'), h('input', { type: 'search', placeholder: '학생 이름·내용·작성자 검색', value: f.q, oninput: function (e) { f.q = e.target.value.trim(); paint(); } })),
      h('div', { class: 'section' }, scopeRow, tagRow,
        h('div', { class: 'inline', style: 'margin-top:10px' },
          h('input', { class: 'input', type: 'date', value: f.from, style: 'width:auto', onchange: function (e) { f.from = e.target.value; load(); } }), '~',
          h('input', { class: 'input', type: 'date', value: f.to, style: 'width:auto', onchange: function (e) { f.to = e.target.value; load(); } }))),
      listBox);
  }

  // ------------------------------------------------------------------
  // 통계·리포트 / 내보내기
  // ------------------------------------------------------------------
  function download(name, text, mime) {
    var blob = new Blob(['﻿' + text], { type: mime || 'text/plain;charset=utf-8' });
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function viewStats() {
    var box = h('div', {}, loadingBox());
    var from = L.addDays(today(), -90), to = today();
    var studentSel = h('select', { class: 'select' }, h('option', { value: '' }, '학생 선택'), L.scopeStudents(S.me, S.students).map(function (s) { return h('option', { value: s.id }, L.classKey(s) + ' ' + s.number + '번 ' + s.name); }));
    A.call('records.list', { from: from, to: to }).then(function (res) {
      var recs = res.records.map(function (r) { return Object.assign(L.normalizeRecord(r), { locked: r.locked }); });
      var scopeIds = {}; L.scopeStudents(S.me, S.students).forEach(function (s) { scopeIds[s.id] = true; });
      var inScope = recs.filter(function (r) { return scopeIds[r.studentId]; });
      var per = {};
      inScope.forEach(function (r) { per[r.studentId] = (per[r.studentId] || 0) + 1; });
      var top = Object.keys(per).map(function (id) { return { s: studentById(id), n: per[id] }; }).filter(function (x) { return x.s; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
      var byId = {}; S.students.forEach(function (s) { byId[s.id] = s; });
      function exportTSV(scope) {
        var list = scope === 'mine' ? recs.filter(function (r) { return r.author === S.me.email; }) : inScope;
        download('관찰기록_' + scope + '_' + from + '_' + to + '.tsv', L.buildTSV(list, byId, tagsById()), 'text/tab-separated-values;charset=utf-8');
        A.call('export.log', { scope: scope, detail: list.length + '건' }).catch(function () { /* 무시 */ });
      }
      function exportMD() {
        var s = byId[studentSel.value]; if (!s) { toast('학생을 선택하세요', true); return; }
        A.call('records.list', { studentId: s.id }).then(function (r2) {
          var list = r2.records.map(function (r) { return Object.assign(L.normalizeRecord(r), { locked: r.locked }); });
          download(s.name + '_관찰보고서_' + today() + '.md', L.buildMarkdown(s, list, tagsById(), today()), 'text/markdown;charset=utf-8');
          A.call('export.log', { scope: 'student', detail: s.id }).catch(function () { /* 무시 */ });
        });
      }
      clear(box);
      box.appendChild(h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('div', { class: 'kicker' }, '최근 90일 · ' + L.scopeLabel(S.me)), h('div', { class: 'h1' }, '통계·리포트'))));
      box.appendChild(h('div', { class: 'two-col section' },
        h('div', { class: 'cards' },
          h('div', { class: 'glass card' }, h('div', { class: 'h2', style: 'font-size:14.5px' }, '분야별 분포'), distributionChart(L.tagDistribution(inScope, activeTags()))),
          h('div', { class: 'glass card' }, h('div', { class: 'h2', style: 'font-size:14.5px' }, '기록이 많은 학생'),
            top.length ? top.map(function (x) { return h('div', { class: 'row', onclick: function () { navigate('student/' + x.s.id); } }, h('div', { class: 'avatar' }, L.pad2(+x.s.number || 0)), h('div', { class: 'body' }, h('div', { class: 'title' }, x.s.name), h('div', { class: 'sub' }, L.classKey(x.s))), h('div', { class: 'right' }, x.n + '건')); }) : h('div', { class: 'empty' }, '기록이 없습니다.'))),
        h('div', { class: 'cards' },
          h('div', { class: 'glass card' }, h('div', { class: 'h2', style: 'font-size:14.5px' }, 'TSV 내보내기'),
            h('p', { class: 'small', style: 'margin:6px 0 12px' }, '엑셀·구글 시트에서 바로 열립니다. 잠긴 기록은 본문 대신 (잠김)으로 표시됩니다.'),
            h('div', { class: 'pill-row' }, h('button', { class: 'pill', onclick: function () { exportTSV('mine'); } }, '내 기록'), h('button', { class: 'pill', onclick: function () { exportTSV('scope'); } }, L.scopeLabel(S.me) + ' 전체'))),
          h('div', { class: 'glass card' }, h('div', { class: 'h2', style: 'font-size:14.5px' }, '학생별 관찰 보고서 (Markdown)'),
            h('p', { class: 'small', style: 'margin:6px 0 12px' }, '분야별 소제목, 날짜순 정리. 상담 의뢰·회의 자료로 활용합니다.'),
            h('div', { class: 'form' }, studentSel, h('button', { class: 'cta auto', onclick: exportMD }, '보고서 내려받기'))))));
    }).catch(function (e) { clear(box); box.appendChild(errorBox(e)); });
    return box;
  }

  // ------------------------------------------------------------------
  // 통합지원 회의
  // ------------------------------------------------------------------
  function meetingCard(m) {
    var names = m.studentIds.map(function (id) { var s = studentById(id); return s ? s.name : null; }).filter(Boolean);
    return h('div', { class: 'glass card', style: 'cursor:pointer', onclick: function () { navigate('meeting/' + m.id); } },
      h('div', { class: 'rec-head' }, h('span', { class: 'pill sm ghost', style: 'cursor:default' }, L.MEETING_STATUS[m.status]), L.formatDateKo(m.date) + ' · ' + m.createdByName,
        m.locked ? lockBadge('열람 제한') : null),
      h('div', { style: 'font-size:16px;font-weight:600;margin-top:8px' }, m.title),
      h('div', { class: 'small', style: 'margin-top:4px' }, names.length ? '안건 학생 ' + names.length + '명: ' + names.slice(0, 5).join(', ') + (names.length > 5 ? ' 외' : '') : '안건 학생 없음',
        !m.locked && m.decisions.length ? ' · 결정 ' + m.decisions.filter(function (d) { return d.done; }).length + '/' + m.decisions.length : ''));
  }

  function viewMeetings() {
    var box = h('div', {}, loadingBox());
    A.call('meetings.list').then(function (res) {
      var list = res.meetings.map(function (m) { return Object.assign(L.normalizeMeeting(m), { locked: m.locked }); });
      var planned = list.filter(function (m) { return m.status !== 'done'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var done = list.filter(function (m) { return m.status === 'done'; });
      var open = L.openDecisions(list);
      clear(box);
      box.appendChild(h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('div', { class: 'h1' }, '통합지원 회의'), h('div', { class: 'muted', style: 'margin-top:4px' }, '안건 학생 선정 · 회의록 · 결정 사항 추적')),
        h('button', { class: 'cta auto', onclick: function () { navigate('meeting/new'); } }, '＋ 새 회의')));
      box.appendChild(h('div', { class: 'two-col section' },
        h('div', { class: 'col-left cards' },
          h('div', { class: 'kicker', style: 'padding:0 8px' }, '예정 회의 ' + planned.length + '건'),
          planned.length ? planned.map(meetingCard) : h('div', { class: 'glass card empty' }, '예정된 회의가 없습니다.'),
          done.length ? h('div', { class: 'kicker', style: 'padding:12px 8px 0' }, '완료 회의 ' + done.length + '건') : null,
          done.map(meetingCard)),
        h('div', { class: 'col-right cards' },
          h('div', { class: 'glass card' + (open.length ? ' alert' : '') }, h('div', { class: 'h2', style: 'font-size:14.5px;color:' + (open.length ? '#8a1046' : 'inherit') }, '미완료 결정 사항 ' + open.length + '건'),
            open.length ? open.slice(0, 8).map(function (d) {
              return h('div', { class: 'row', style: 'padding:8px 6px', onclick: function () { navigate('meeting/' + d.meetingId); } },
                h('div', { class: 'body' }, h('div', { style: 'font-size:13.5px' }, d.text), h('div', { class: 'sub' }, [d.owner ? '담당 ' + d.owner : '', d.due ? '기한 ' + d.due : '', d.meetingTitle].filter(Boolean).join(' · '))));
            }) : h('div', { class: 'small', style: 'margin-top:6px' }, '열람 가능한 회의의 결정 사항이 모두 완료되었습니다.')),
          h('div', { class: 'glass card' }, h('div', { class: 'h2', style: 'font-size:14.5px' }, '회의 내용을 볼 수 있는 사람'),
            h('div', { class: 'list-check', style: 'margin-top:6px' }, h('div', { class: 'ok' }, '회의 작성자'), h('div', { class: 'ok' }, '상담·복지·보건 전담, 행정담당자'), h('div', { class: 'ok' }, '안건 학생의 담임교사'), h('div', { class: 'no' }, '그 외 교사는 날짜·제목만'))))));
    }).catch(function (e) { clear(box); box.appendChild(errorBox(e)); });
    return box;
  }

  function viewMeetingDetail() {
    var id = S.route.params.id;
    var box = h('div', {}, loadingBox());
    if (id === 'new') {
      var m = L.normalizeMeeting({ id: L.uuid(), date: today(), title: '', status: 'planned' });
      if (S.route.query.student) m.studentIds = [S.route.query.student];
      clear(box); box.appendChild(meetingForm(m, true, true));
      return box;
    }
    A.call('meetings.get', { id: id }).then(function (res) {
      var m = Object.assign(L.normalizeMeeting(res.meeting), { locked: res.meeting.locked });
      clear(box);
      if (m.locked) {
        box.appendChild(h('div', {}, h('div', { class: 'topbar' }, h('button', { class: 'back glass', onclick: function () { navigate('meeting'); } }, icon('back')), h('div', { class: 'grow h1', style: 'font-size:22px' }, m.title)),
          h('div', { class: 'glass card' }, h('div', { class: 'rec-lock' }, h('div', { class: 'icon' }, icon('lock')), h('div', {}, h('div', { class: 't1' }, '열람 제한된 회의'), h('div', { class: 't2' }, '작성자, 전담·행정 계정, 안건 학생의 담임만 내용을 볼 수 있습니다.'))))));
        return;
      }
      box.appendChild(meetingForm(m, res.canEdit, false));
    }).catch(function (e) { clear(box); box.appendChild(errorBox(e)); });
    return box;
  }

  function meetingForm(m, canEdit, isNew) {
    var saving = false;
    var summaries = {};
    var ro = !canEdit;
    var titleIn = h('input', { class: 'input', placeholder: '회의 제목 (예: 9월 통합지원 회의)', value: m.title, disabled: ro, oninput: function (e) { m.title = e.target.value; } });
    var dateIn = h('input', { class: 'input', type: 'date', value: m.date, disabled: ro, oninput: function (e) { m.date = e.target.value; } });
    var attIn = h('input', { class: 'input', placeholder: '참석자 (예: 담임, 상담교사, 보건교사, 교감)', value: m.attendees, disabled: ro, oninput: function (e) { m.attendees = e.target.value; } });
    var notesIn = h('textarea', { class: 'textarea', style: 'min-height:180px', placeholder: '논의 내용, 학생별 지원 방향, 연계 기관 등', value: m.notes, disabled: ro, oninput: function (e) { m.notes = e.target.value; } });
    var statusBox = h('div', { class: 'pill-row' });
    var studentsBox = h('div', { class: 'cards' });
    var decisionsBox = h('div', { class: 'form' });
    var errEl = h('div', { class: 'small', style: 'color:#8a1046;min-height:16px' });

    function paintStatus() {
      clear(statusBox);
      Object.keys(L.MEETING_STATUS).forEach(function (k) {
        statusBox.appendChild(h('button', { class: 'pill sm' + (m.status === k ? ' on' : ''), disabled: ro, onclick: function () { m.status = k; paintStatus(); } }, L.MEETING_STATUS[k]));
      });
    }

    function studentSummary(s) {
      var card = h('div', { class: 'glass card' });
      var head = h('div', { style: 'display:flex;align-items:center;gap:10px' },
        h('div', { class: 'avatar', style: 'width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px' }, L.pad2(+s.number || 0)),
        h('div', { style: 'flex:1;min-width:0' }, h('div', { style: 'font-weight:600;cursor:pointer', onclick: function () { navigate('student/' + s.id); } }, s.name), h('div', { class: 'small' }, L.classKey(s))),
        ro ? null : h('button', { class: 'pill sm ghost', onclick: function () { m.studentIds = m.studentIds.filter(function (x) { return x !== s.id; }); paintStudents(); } }, '제외'));
      var body = h('div', { class: 'small', style: 'margin-top:8px' }, '기록 불러오는 중…');
      card.appendChild(head); card.appendChild(body);
      var fill = function (recs) {
        clear(body);
        var live = recs.filter(function (r) { return !r.deleted; });
        var st = L.studentStats(live, today());
        body.appendChild(h('div', { class: 'pill-row', style: 'margin-bottom:8px' },
          h('span', { class: 'pill sm ghost', style: 'cursor:default' }, '누적 ' + st.total), h('span', { class: 'pill sm ghost', style: 'cursor:default' }, '30일 ' + st.last30),
          st.topTag ? tagChip(st.topTag) : null));
        L.sortRecordsDesc(live).slice(0, 3).forEach(function (r) {
          body.appendChild(h('div', { style: 'font-size:13px;line-height:1.5;padding:4px 0;border-top:1px solid rgba(11,18,32,.06)' },
            h('span', { class: 'muted' }, L.formatShort(r.date) + ' '), r.tags.map(function (t) { return tagChip(t); }), ' ', r.locked ? lockBadge('잠김') : r.content));
        });
        if (!live.length) body.appendChild(h('div', { class: 'small' }, '기록 없음'));
      };
      if (summaries[s.id]) fill(summaries[s.id]);
      else A.call('records.list', { studentId: s.id, limit: 30 }).then(function (res) { summaries[s.id] = res.records.map(function (r) { return Object.assign(L.normalizeRecord(r), { locked: r.locked }); }); fill(summaries[s.id]); }).catch(function () { body.textContent = '기록을 불러오지 못했습니다.'; });
      return card;
    }

    function paintStudents() {
      clear(studentsBox);
      m.studentIds.forEach(function (id) { var s = studentById(id); if (s) studentsBox.appendChild(studentSummary(s)); });
      if (!m.studentIds.length) studentsBox.appendChild(h('div', { class: 'empty' }, '안건 학생을 추가하세요.'));
      if (!ro) studentsBox.appendChild(h('button', { class: 'pill', onclick: pickStudent }, '＋ 안건 학생 추가'));
    }

    function pickStudent() {
      var q = '';
      var listEl = h('div', { style: 'max-height:50vh;overflow:auto;margin-top:10px' });
      var active = S.students.filter(function (s) { return (!s.status || s.status === '재학') && m.studentIds.indexOf(s.id) < 0; });
      function paint() {
        clear(listEl);
        var list = q ? active.filter(function (s) { return s.name.indexOf(q) >= 0 || L.classKey(s).indexOf(q) >= 0; }) : L.scopeStudents(S.me, active);
        list.slice(0, 60).forEach(function (s) {
          listEl.appendChild(h('div', { class: 'row', onclick: function () { m.studentIds.push(s.id); md.close(); paintStudents(); } },
            h('div', { class: 'avatar' }, L.pad2(+s.number || 0)), h('div', { class: 'body' }, h('div', { class: 'title' }, s.name), h('div', { class: 'sub' }, L.classKey(s)))));
        });
        if (!list.length) listEl.appendChild(h('div', { class: 'empty' }, '검색 결과가 없습니다.'));
      }
      var md = modal([h('div', { class: 'h2' }, '안건 학생 추가'),
        h('div', { class: 'glass search', style: 'margin-top:10px' }, icon('search'), h('input', { type: 'search', placeholder: '이름·학급 검색 (전교생)', oninput: function (e) { q = e.target.value.trim(); paint(); } })), listEl]);
      paint();
    }

    function paintDecisions() {
      clear(decisionsBox);
      m.decisions.forEach(function (d, i) {
        decisionsBox.appendChild(h('div', { class: 'inline', style: 'align-items:flex-start' },
          h('input', { type: 'checkbox', checked: d.done, disabled: ro, style: 'margin-top:14px;width:18px;height:18px', onchange: function (e) { d.done = e.target.checked; } }),
          h('div', { class: 'grow form', style: 'gap:6px' },
            h('input', { class: 'input', placeholder: '결정 사항', value: d.text, disabled: ro, oninput: function (e) { d.text = e.target.value; } }),
            h('div', { class: 'inline' }, h('input', { class: 'input grow', placeholder: '담당자', value: d.owner, disabled: ro, oninput: function (e) { d.owner = e.target.value; } }),
              h('input', { class: 'input', type: 'date', value: d.due, disabled: ro, style: 'width:auto', oninput: function (e) { d.due = e.target.value; } }),
              ro ? null : h('button', { class: 'pill sm ghost', onclick: function () { m.decisions.splice(i, 1); paintDecisions(); } }, '삭제')))));
      });
      if (!m.decisions.length) decisionsBox.appendChild(h('div', { class: 'small' }, '결정 사항이 없습니다.'));
      if (!ro) decisionsBox.appendChild(h('button', { class: 'pill', onclick: function () { m.decisions.push({ text: '', owner: '', due: '', done: false }); paintDecisions(); } }, '＋ 결정 사항 추가'));
    }

    function save() {
      if (saving) return;
      m.decisions = m.decisions.filter(function (d) { return d.text.trim(); });
      var err = L.validateMeeting(m);
      if (err) { errEl.textContent = err; return; }
      saving = true; errEl.textContent = '';
      A.call('meetings.save', { meeting: m }).then(function (res) {
        toast('저장했습니다');
        navigate('meeting/' + res.meeting.id);
        if (!isNew) render();
      }).catch(function (e) {
        saving = false;
        if (e.code === 'CONFLICT') {
          var md = modal([h('div', { class: 'h2' }, '다른 사용자가 먼저 수정했습니다'), h('p', { class: 'muted', style: 'margin-top:8px;font-size:14px;line-height:1.6' }, '최신 내용을 불러와 다시 편집하거나, 내 내용으로 덮어쓸 수 있습니다.'),
            h('div', { class: 'modal-actions' }, h('button', { class: 'cta dim', onclick: function () { md.close(); render(); } }, '최신 내용 불러오기'),
              h('button', { class: 'cta', onclick: function () { m.version = e.data.meeting.version; md.close(); save(); } }, '내 내용으로 덮어쓰기'))], { sticky: true });
          return;
        }
        errEl.textContent = e.message;
      });
    }

    function exportMD() {
      var byId = {}; S.students.forEach(function (s) { byId[s.id] = s; });
      var pending = m.studentIds.filter(function (id) { return !summaries[id]; });
      Promise.all(pending.map(function (id) { return A.call('records.list', { studentId: id, limit: 30 }).then(function (res) { summaries[id] = res.records.map(function (r) { return Object.assign(L.normalizeRecord(r), { locked: r.locked }); }); }); }))
        .then(function () {
          download((m.title || '회의') + '_' + m.date + '.md', L.buildMeetingMarkdown(m, byId, summaries, tagsById(), today()), 'text/markdown;charset=utf-8');
          A.call('export.log', { scope: 'meeting', detail: m.id }).catch(function () { /* 무시 */ });
        });
    }

    paintStatus(); paintStudents(); paintDecisions();
    return h('div', {},
      h('div', { class: 'topbar' }, h('button', { class: 'back glass', onclick: function () { navigate('meeting'); } }, icon('back')),
        h('div', { class: 'grow' }, h('div', { class: 'kicker' }, isNew ? '새 회의' : (ro ? '읽기 전용 · ' : '') + m.createdByName + ' 작성'), h('div', { class: 'h1', style: 'font-size:22px' }, m.title || '통합지원 회의')),
        isNew ? null : h('button', { class: 'pill sm', onclick: exportMD }, '회의 자료')),
      h('div', { class: 'glass card form' }, titleIn, h('div', { class: 'grid-2' }, dateIn, h('div', { style: 'display:flex;align-items:center' }, statusBox)), attIn),
      h('div', { class: 'section' }, h('div', { class: 'kicker' }, '안건 학생 ' + m.studentIds.length + '명'), studentsBox),
      h('div', { class: 'section' }, h('div', { class: 'kicker' }, '회의록'), h('div', { class: 'glass', style: 'padding:6px' }, notesIn)),
      h('div', { class: 'section' }, h('div', { class: 'kicker' }, '결정 사항'), h('div', { class: 'glass card' }, decisionsBox)),
      errEl,
      ro ? null : h('div', { class: 'section', style: 'display:flex;gap:10px' },
        isNew ? null : h('button', { class: 'cta dim', style: 'flex:0 0 auto;width:auto;padding:16px 20px', onclick: function () {
          confirmDialog('회의 삭제', '이 회의를 삭제할까요? 시트에는 삭제 표시로 남습니다.', '삭제', true).then(function (ok) { if (ok) A.call('meetings.delete', { id: m.id }).then(function () { toast('삭제했습니다'); navigate('meeting'); }).catch(function (e) { toast(e.message, true); }); });
        } }, '삭제'),
        h('button', { class: 'cta', onclick: save }, isNew ? '회의 만들기' : '저장')));
  }

  // ------------------------------------------------------------------
  // 설정 · 권한
  // ------------------------------------------------------------------
  function viewSettings() {
    var first = S.route.query.first === '1';
    var box = h('div', {});
    box.appendChild(h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('div', { class: 'h1' }, '권한 · 잠금'), h('div', { class: 'muted', style: 'margin-top:4px' }, S.me.name + ' · ' + describeMe()))));

    if (first) box.appendChild(h('div', { class: 'glass card alert', style: 'margin-bottom:12px' }, h('div', { style: 'font-weight:600;color:#8a1046' }, '첫 로그인입니다. 비밀번호를 먼저 변경해주세요.')));

    // 잠금 상태
    var remaining = unlockRemaining();
    box.appendChild(h('div', { class: 'glass card' },
      h('div', { class: 'h2' }, '잠금은 작성자가 정합니다'),
      h('p', { class: 'muted', style: 'margin-top:6px;font-size:13.5px;line-height:1.65' }, '분야(태그)에 따라 자동으로 잠기지 않습니다. 기록을 쓸 때 작성자가 공개 범위를 직접 고릅니다. 여기서는 이미 저장된 기록의 범위만 확인·변경할 수 있습니다.'),
      h('div', { class: 'inline', style: 'margin-top:12px' },
        remaining ? h('span', { class: 'pill on' }, icon('unlock'), '잠금 해제됨 · ' + remaining + '분 남음') : h('span', { class: 'pill ghost' }, icon('lock'), '잠김'),
        remaining ? h('button', { class: 'pill', onclick: lockAll }, '지금 잠그기') : h('button', { class: 'pill', onclick: function () { pinScreen().then(function (ok) { if (ok) render(); }); } }, 'PIN으로 해제'))));

    // 내가 쓴 기록 공개 범위
    var mineBox = h('div', { class: 'glass card', style: 'margin-top:12px' }, h('div', { class: 'h2' }, '내가 쓴 기록의 공개 범위'), loadingBox());
    box.appendChild(mineBox);
    A.call('records.list', { scope: 'mine', limit: 30 }).then(function (res) {
      clear(mineBox); mineBox.appendChild(h('div', { class: 'h2' }, '내가 쓴 기록의 공개 범위'));
      if (!res.records.length) { mineBox.appendChild(h('div', { class: 'empty' }, '작성한 기록이 없습니다.')); return; }
      res.records.forEach(function (raw) {
        var r = L.normalizeRecord(raw); var s = studentById(r.studentId) || { name: '?' };
        var line = h('div', { class: 'row', style: 'cursor:default' }, h('div', { class: 'body' }, h('div', { class: 'title', style: 'font-size:14px' }, s.name + ' · ' + L.formatShort(r.date) + ' ' + r.time), h('div', { class: 'sub' }, r.tags.map(function (t) { return tagById(t).name; }).join('·'))),
          h('button', { class: 'pill sm' + (r.visibility === 'restricted' ? ' lock' : ''), onclick: function () {
            var nv = r.visibility === 'restricted' ? 'all' : 'restricted';
            A.call('records.setVisibility', { id: r.id, version: r.version, visibility: nv }).then(function () { toast('공개 범위를 변경했습니다'); render(); }).catch(function (e) { toast(e.message, true); });
          } }, r.visibility === 'restricted' ? '담당 교사만' : '교사 전체'));
        mineBox.appendChild(line);
      });
    }).catch(function (e) { clear(mineBox); mineBox.appendChild(errorBox(e)); });

    // 열람 가능한 사람
    box.appendChild(h('div', { class: 'glass card', style: 'margin-top:12px' }, h('div', { class: 'h2' }, '잠긴 기록을 열 수 있는 사람'),
      h('div', { class: 'list-check', style: 'margin-top:6px' }, h('div', { class: 'ok' }, '해당 학생의 담임교사'), h('div', { class: 'ok' }, '그 기록의 작성자'), h('div', { class: 'ok' }, '상담·복지·보건 전용 로그인 계정'), h('div', { class: 'no' }, '교과교사 · 그 외 교직원 · 행정담당자'))));

    // 열람 로그
    var logBox = h('div', { class: 'glass card', style: 'margin-top:12px' }, h('div', { class: 'h2' }, '최근 열람 로그'), loadingBox());
    box.appendChild(logBox);
    A.call('views.list', { limit: 30 }).then(function (res) {
      clear(logBox); logBox.appendChild(h('div', { class: 'h2' }, '최근 열람 로그'));
      if (!res.views.length) { logBox.appendChild(h('div', { class: 'empty' }, '열람 기록이 없습니다.')); return; }
      res.views.forEach(function (v) {
        var s = studentById(v.studentId);
        var what = v.action === 'unlock' ? '잠금 해제 ' + v.result : (s ? s.name + ' 기록 열람' : '기록 열람');
        var at = new Date(v.at);
        logBox.appendChild(h('div', { class: 'log-line' }, h('span', { class: 'when' }, isNaN(at) ? v.at : L.pad2(at.getMonth() + 1) + '/' + L.pad2(at.getDate()) + ' ' + L.toTimeStr(at)), h('span', {}, v.name + ' — ' + what)));
      });
    }).catch(function (e) { clear(logBox); logBox.appendChild(errorBox(e)); });

    // 계정
    box.appendChild(accountCard(first));

    if (L.isAdmin(S.me)) box.appendChild(h('div', { class: 'glass card', style: 'margin-top:12px' }, h('div', { class: 'h2' }, '관리자'),
      h('div', { class: 'pill-row', style: 'margin-top:10px' },
        h('button', { class: 'pill', onclick: function () { navigate('admin/students'); } }, '학생 명단 관리'),
        h('button', { class: 'pill', onclick: function () { navigate('admin/teachers'); } }, '교사 명단 관리', pendingBadge()),
        h('button', { class: 'pill', onclick: function () { navigate('admin/tags'); } }, '분야·문장 관리'))));

    if (A.isDemo()) box.appendChild(h('div', { class: 'glass card', style: 'margin-top:12px' }, h('div', { class: 'h2' }, '데모 모드'),
      h('p', { class: 'small', style: 'margin-top:6px' }, '가상 데이터가 이 브라우저에만 저장됩니다. 실제 배포는 docs/배포안내.md 를 참고하세요.'),
      h('div', { style: 'margin-top:10px' }, h('button', { class: 'pill', onclick: function () { confirmDialog('데모 데이터 초기화', '가상 데이터를 새로 만듭니다.', '초기화', true).then(function (ok) { if (ok) { window.SOSMock.reset(); logout(); } }); } }, '데모 데이터 초기화'))));

    box.appendChild(h('div', { class: 'section' }, h('button', { class: 'cta danger', onclick: function () { logout(); } }, '전체 잠금 (앱 종료)')));
    return box;
  }

  var pendingCount = 0;
  function pendingBadge() { return pendingCount ? h('span', { class: 'lockbadge', style: 'margin-left:6px' }, '대기 ' + pendingCount) : null; }
  function refreshPending() {
    if (!S.me || !L.isAdmin(S.me)) return Promise.resolve(0);
    return A.call('teachers.list').then(function (res) { pendingCount = res.filter(function (t) { return t.status === 'pending'; }).length; return pendingCount; }).catch(function () { return pendingCount; });
  }

  function accountCard(first) {
    var oldPw = h('input', { class: 'input', type: 'password', placeholder: '현재 비밀번호', autocomplete: 'current-password' });
    var newPw = h('input', { class: 'input', type: 'password', placeholder: '새 비밀번호 (8자 이상)', autocomplete: 'new-password' });
    var pwMsg = h('div', { class: 'small', style: 'min-height:16px' });
    var pinPw = h('input', { class: 'input', type: 'password', placeholder: '비밀번호 확인', autocomplete: 'current-password' });
    var pin = h('input', { class: 'input', type: 'password', inputmode: 'numeric', pattern: '\\d{6}', maxlength: '6', placeholder: 'PIN 6자리' });
    var pinMsg = h('div', { class: 'small', style: 'min-height:16px' });
    return h('div', { class: 'glass card', style: 'margin-top:12px' }, h('div', { class: 'h2' }, '내 계정'),
      h('div', { class: 'small', style: 'margin:4px 0 12px' }, S.me.email + ' · ' + S.me.roles.map(function (r) { return L.ROLES[r] ? L.ROLES[r].label : r; }).join(', ') + (S.me.field ? ' (' + S.me.field + ')' : '')),
      h('div', { class: 'form' },
        h('div', { class: 'kicker' }, '비밀번호 변경'), oldPw, newPw, pwMsg,
        h('button', { class: 'cta auto', onclick: function () {
          A.call('changePassword', { oldPassword: oldPw.value, newPassword: newPw.value }).then(function () { pwMsg.textContent = '변경했습니다.'; S.me.mustChangePassword = false; oldPw.value = newPw.value = ''; if (first) navigate('home'); }).catch(function (e) { pwMsg.textContent = e.message; });
        } }, '비밀번호 변경'),
        h('div', { class: 'divider' }),
        h('div', { class: 'kicker' }, (S.me.hasPin ? 'PIN 변경' : 'PIN 등록') + ' — 잠긴 기록 해제용'), pinPw, pin, pinMsg,
        h('button', { class: 'cta auto', onclick: function () {
          A.call('setPin', { password: pinPw.value, pin: pin.value }).then(function () { pinMsg.textContent = 'PIN을 저장했습니다.'; S.me.hasPin = true; pinPw.value = pin.value = ''; }).catch(function (e) { pinMsg.textContent = e.message; });
        } }, 'PIN 저장')));
  }

  function logout() {
    A.setToken(null); A.setUnlock(null); S.me = null; S.unlock = null; S.activity = {};
    try { sessionStorage.removeItem('sos.noticeAck'); } catch (e) { /* 무시 */ }
    navigate('home'); render();
  }

  // ------------------------------------------------------------------
  // 관리자: 학생 명단
  // ------------------------------------------------------------------
  function viewAdminStudents() {
    if (!L.isAdmin(S.me)) return h('div', { class: 'empty' }, '관리자만 사용할 수 있습니다.');
    var ta = h('textarea', { class: 'textarea', placeholder: '과 학년 반 번호 이름 [메모] [상태]\n기계과 3 2 12 홍길동\n(엑셀·시트에서 복사한 표를 그대로 붙여넣어도 됩니다)' });
    var msg = h('div', { class: 'small', style: 'min-height:16px' });
    var listBox = h('div', { class: 'glass', style: 'padding:6px;margin-top:12px' });
    var q = '';
    function paintList() {
      clear(listBox);
      var list = S.students.filter(function (s) { return !q || s.name.indexOf(q) >= 0 || L.classKey(s).indexOf(q) >= 0; }).slice(0, 150);
      list.forEach(function (s) {
        listBox.appendChild(h('div', { class: 'row', onclick: function () { editStudent(s); } },
          h('div', { class: 'avatar' }, L.pad2(+s.number || 0)), h('div', { class: 'body' }, h('div', { class: 'title' }, s.name), h('div', { class: 'sub' }, L.classKey(s) + (s.status && s.status !== '재학' ? ' · ' + s.status : ''))), h('div', { class: 'right' }, '편집')));
      });
      if (!list.length) listBox.appendChild(h('div', { class: 'empty' }, '학생이 없습니다.'));
    }
    function editStudent(s) {
      s = s || { dept: '', grade: '', klass: '', number: '', name: '', memo: '', status: '재학' };
      var f = {
        dept: h('input', { class: 'input', placeholder: '과', value: s.dept }), grade: h('input', { class: 'input', type: 'number', placeholder: '학년', value: s.grade }),
        klass: h('input', { class: 'input', type: 'number', placeholder: '반', value: s.klass }), number: h('input', { class: 'input', type: 'number', placeholder: '번호', value: s.number }),
        name: h('input', { class: 'input', placeholder: '이름', value: s.name }), memo: h('input', { class: 'input', placeholder: '메모', value: s.memo || '' }),
        status: h('select', { class: 'select' }, ['재학', '전출', '졸업', '휴학'].map(function (v) { return h('option', { value: v, selected: (s.status || '재학') === v }, v); }))
      };
      var m = modal([h('div', { class: 'h2' }, s.id ? '학생 수정' : '학생 추가'),
        h('div', { class: 'form', style: 'margin-top:12px' }, h('div', { class: 'grid-2' }, f.dept, f.grade), h('div', { class: 'grid-2' }, f.klass, f.number), f.name, f.memo, f.status),
        h('div', { class: 'modal-actions' }, h('button', { class: 'cta dim', onclick: function () { m.close(); } }, '취소'), h('button', { class: 'cta', onclick: function () {
          A.call('students.upsert', { student: { id: s.id, dept: f.dept.value.trim(), grade: f.grade.value, klass: f.klass.value, number: f.number.value, name: f.name.value.trim(), memo: f.memo.value, status: f.status.value } })
            .then(function () { m.close(); toast('저장했습니다'); return bootstrap(); }).then(render).catch(function (e) { toast(e.message, true); });
        } }, '저장'))]);
    }
    paintList();
    return h('div', {},
      h('div', { class: 'topbar' }, h('button', { class: 'back glass', onclick: function () { navigate('settings'); } }, icon('back')), h('div', { class: 'grow h1', style: 'font-size:24px' }, '학생 명단 관리'), h('button', { class: 'pill', onclick: function () { editStudent(null); } }, '＋ 학생')),
      h('div', { class: 'glass card' }, h('div', { class: 'h2' }, '명단 일괄 추가'), h('p', { class: 'small', style: 'margin:6px 0 10px' }, '같은 과·학년·반·번호가 이미 있으면 이름·상태만 갱신합니다. 학생은 삭제하지 않고 상태(전출·졸업)로 관리합니다.'), ta, msg,
        h('div', { style: 'margin-top:10px' }, h('button', { class: 'cta auto', onclick: function () {
          var parsed = L.parseRosterText(ta.value);
          if (!parsed.rows.length) { msg.textContent = parsed.errors.join(' / ') || '추가할 내용이 없습니다.'; return; }
          confirmDialog('명단 추가', parsed.rows.length + '명을 추가·갱신합니다.' + (parsed.errors.length ? ' 오류 ' + parsed.errors.length + '행은 건너뜁니다.' : ''), '추가').then(function (ok) {
            if (!ok) return;
            A.call('students.bulk', { text: ta.value }).then(function (res) { msg.textContent = '추가 ' + res.added + '명, 갱신 ' + res.updated + '명' + (res.errors.length ? ' / 오류: ' + res.errors.join(', ') : ''); ta.value = ''; return bootstrap(); }).then(paintList).catch(function (e) { msg.textContent = e.message; });
          });
        } }, '명단 추가'))),
      h('div', { class: 'glass search', style: 'margin-top:12px' }, icon('search'), h('input', { type: 'search', placeholder: '이름·학급 검색', oninput: function (e) { q = e.target.value.trim(); paintList(); } })),
      listBox);
  }

  // ------------------------------------------------------------------
  // 관리자: 교사 명단
  // ------------------------------------------------------------------
  function viewAdminTeachers() {
    if (!L.isAdmin(S.me)) return h('div', { class: 'empty' }, '관리자만 사용할 수 있습니다.');
    var listBox = h('div', { class: 'glass', style: 'padding:6px;margin-top:12px' }, loadingBox());
    var tabBox = h('div', { class: 'pill-row', style: 'margin-top:12px' });
    var bulkBox = h('div', { class: 'glass card', style: 'margin-top:12px', hidden: true });
    var teachers = [];
    var tab = S.route.query.tab === 'all' ? 'all' : 'pending';
    var selected = {};
    function load() { A.call('teachers.list').then(function (res) { teachers = res.map(L.normalizeTeacher); if (tab === 'pending' && !pending().length && teachers.length) tab = S.route.query.tab ? tab : 'all'; paint(); }).catch(function (e) { clear(listBox); listBox.appendChild(errorBox(e)); }); }
    function pending() { return teachers.filter(function (t) { return t.status === 'pending'; }); }
    function approve(emails, all, ok) {
      var label = (ok ? '승인' : '거절');
      var n = all ? pending().length : emails.length;
      if (!n) { toast('선택된 교사가 없습니다', true); return; }
      confirmDialog('가입 ' + label, n + '명을 ' + label + '합니다.' + (ok ? ' 승인 후 바로 로그인할 수 있습니다.' : ' 거절된 계정은 로그인할 수 없습니다.'), label, !ok).then(function (yes) {
        if (!yes) return;
        A.call('teachers.approve', { emails: emails, all: !!all, approve: ok }).then(function (res) { toast(res.count + '명 ' + label + '했습니다'); selected = {}; refreshPending(); load(); }).catch(function (e) { toast(e.message, true); });
      });
    }
    function paint() {
      clear(tabBox);
      var pn = pending().length;
      tabBox.appendChild(h('button', { class: 'pill sm' + (tab === 'pending' ? ' on' : ''), onclick: function () { tab = 'pending'; paint(); } }, '승인 대기 ' + pn));
      tabBox.appendChild(h('button', { class: 'pill sm' + (tab === 'all' ? ' on' : ''), onclick: function () { tab = 'all'; paint(); } }, '전체 교사 ' + teachers.length));
      clear(listBox);
      bulkBox.hidden = tab !== 'pending' || !pn;
      if (tab === 'pending') {
        clear(bulkBox);
        var selCount = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
        bulkBox.appendChild(h('div', { class: 'inline' },
          h('label', { class: 'checkbox' }, h('input', { type: 'checkbox', checked: selCount === pn && pn > 0, onchange: function (e) { pending().forEach(function (t) { selected[t.email] = e.target.checked; }); paint(); } }), '전체 선택'),
          h('span', { class: 'small grow' }, selCount + '명 선택'),
          h('button', { class: 'pill sm', onclick: function () { approve(Object.keys(selected).filter(function (k) { return selected[k]; }), false, true); } }, '선택 승인'),
          h('button', { class: 'pill sm ghost', onclick: function () { approve(Object.keys(selected).filter(function (k) { return selected[k]; }), false, false); } }, '선택 거절'),
          h('button', { class: 'cta auto', style: 'padding:9px 16px;font-size:13px', onclick: function () { approve([], true, true); } }, '대기 중 ' + pn + '명 일괄 승인')));
      }
      var list = tab === 'pending' ? pending() : teachers;
      if (!list.length) { listBox.appendChild(h('div', { class: 'empty' }, tab === 'pending' ? '승인을 기다리는 가입 신청이 없습니다.' : '등록된 교사가 없습니다.')); return; }
      list.forEach(function (t) {
        var statusPill = t.status === 'pending' ? h('span', { class: 'lockbadge' }, '승인 대기') : t.status === 'rejected' ? h('span', { class: 'pill sm ghost', style: 'cursor:default' }, '거절') : (t.hasPin ? 'PIN 등록' : 'PIN 없음');
        listBox.appendChild(h('div', { class: 'row', onclick: function () { editTeacher(t); } },
          tab === 'pending' ? h('input', { type: 'checkbox', checked: !!selected[t.email], style: 'width:18px;height:18px', onclick: function (e) { e.stopPropagation(); selected[t.email] = e.target.checked; paint(); } }) : null,
          h('div', { class: 'body' }, h('div', { class: 'title' }, t.name, roleBadge(L.primaryRole(t)), !t.active ? h('span', { class: 'small' }, ' (비활성)') : null),
            h('div', { class: 'sub' }, t.email + ' · ' + t.roles.map(function (r) { return L.ROLES[r] ? L.ROLES[r].label : r; }).join(',') + (t.homeroom ? ' · ' + t.homeroom : '') + (t.classes.length ? ' · 수업 ' + t.classes.length + '반' : '') + (t.field ? ' · ' + t.field : '') + (t.status === 'pending' && t.requestedAt ? ' · 신청 ' + String(t.requestedAt).slice(0, 10) : ''))),
          h('div', { class: 'right' }, statusPill)));
      });
    }
    function editTeacher(t) {
      t = t || L.normalizeTeacher({});
      var email = h('input', { class: 'input', type: 'text', placeholder: '아이디 (이메일 또는 ID)', value: t.email, disabled: !!t.email, autocapitalize: 'off' });
      var name = h('input', { class: 'input', placeholder: '이름', value: t.name });
      var roles = {};
      var roleBox = h('div', { class: 'pill-row' }, Object.keys(L.ROLES).map(function (k) { roles[k] = t.roles.indexOf(k) >= 0; var b = h('button', { class: 'pill sm' + (roles[k] ? ' on' : ''), type: 'button', onclick: function () { roles[k] = !roles[k]; b.className = 'pill sm' + (roles[k] ? ' on' : ''); } }, L.ROLES[k].label); return b; }));
      var homeroom = h('input', { class: 'input', placeholder: '담임반 (예: 기계과 3-2)', value: t.homeroom });
      var classes = h('input', { class: 'input', placeholder: '수업반 (세미콜론 구분, 예: 전기과 2-1;기계과 3-4)', value: t.classes.join(';') });
      var field = h('select', { class: 'select' }, h('option', { value: '' }, '전담 분야 없음'), L.SPECIALIST_FIELDS.map(function (f) { return h('option', { value: f, selected: t.field === f }, f); }));
      var active = h('input', { type: 'checkbox', checked: t.active !== false });
      var out = h('div', { class: 'small', style: 'min-height:16px' });
      function saveTeacher(thenApprove) {
        var teacher = { email: email.value.trim(), name: name.value.trim(), roles: Object.keys(roles).filter(function (k) { return roles[k]; }), homeroom: homeroom.value.trim(), classes: classes.value, field: field.value, active: active.checked };
        return A.call('teachers.upsert', { teacher: teacher }).then(function (res) {
          if (res.tempPassword) { out.textContent = '등록 완료. 임시 비밀번호: ' + res.tempPassword + ' (본인에게 직접 전달하세요)'; email.disabled = true; }
          else if (!thenApprove) { m.close(); toast('저장했습니다'); }
          load();
        }).catch(function (e) { out.textContent = e.message; throw e; });
      }
      var m = modal([h('div', { class: 'h2' }, t.email ? (t.status === 'pending' ? '가입 신청 검토' : '교사 수정') : '교사 추가'),
        t.status === 'pending' ? h('p', { class: 'small', style: 'margin-top:4px' }, '신청자가 입력한 내용입니다. 역할·학급을 고친 뒤 승인할 수 있습니다.') : null,
        h('div', { class: 'form', style: 'margin-top:12px' }, email, name, h('div', { class: 'kicker' }, '역할'), roleBox, homeroom, classes, field, h('label', { class: 'checkbox' }, active, '사용 중'), out),
        h('div', { class: 'modal-actions', style: 'flex-wrap:wrap' }, h('button', { class: 'cta dim', onclick: function () { m.close(); } }, '닫기'),
          t.email && t.status !== 'pending' ? h('button', { class: 'cta dim', onclick: function () {
            confirmDialog('비밀번호 초기화', t.name + ' 선생님의 비밀번호를 임시 비밀번호로 바꿉니다.', '초기화').then(function (ok) { if (ok) A.call('teachers.resetPassword', { email: t.email }).then(function (res) { out.textContent = '임시 비밀번호: ' + res.tempPassword + ' (본인에게 직접 전달하세요)'; }).catch(function (e) { out.textContent = e.message; }); });
          } }, '비밀번호 초기화') : null,
          t.status === 'pending' ? h('button', { class: 'cta dim', onclick: function () { m.close(); approve([t.email], false, false); } }, '거절') : null,
          t.status === 'pending' ? h('button', { class: 'cta', onclick: function () {
            // 저장(역할 조정) 후 승인 — upsert 가 status 를 approved 로 바꾼다
            saveTeacher(true).then(function () { m.close(); toast(t.name + ' 선생님을 승인했습니다'); }).catch(function () { /* 메시지 표시됨 */ });
          } }, '수정 내용으로 승인') : h('button', { class: 'cta', onclick: function () { saveTeacher(false).catch(function () { /* 메시지 표시됨 */ }); } }, '저장'))], { sticky: true });
    }
    load();
    return h('div', {},
      h('div', { class: 'topbar' }, h('button', { class: 'back glass', onclick: function () { navigate('settings'); } }, icon('back')), h('div', { class: 'grow h1', style: 'font-size:24px' }, '교사 명단'), h('button', { class: 'pill', onclick: function () { editTeacher(null); } }, '＋ 직접 추가')),
      h('div', { class: 'glass card role-legend' }, h('div', {}, roleBadge('homeroom'), '담임교사 — 담임반 학생의 잠긴 기록 열람 가능'), h('div', {}, roleBadge('specialist'), '분야 담당(상담·복지·보건) — 모든 잠긴 기록 열람 가능'), h('div', {}, roleBadge('subject'), '교과교사 — 수업반 기록 작성, 잠긴 기록은 본인 것만'), h('div', {}, roleBadge('admin'), '행정담당자 — 명단·계정 관리, 잠긴 기록 본문은 볼 수 없음')),
      tabBox, bulkBox, listBox);
  }

  // ------------------------------------------------------------------
  // 관리자: 분야·문장
  // ------------------------------------------------------------------
  function viewAdminTags() {
    if (!L.isAdmin(S.me)) return h('div', { class: 'empty' }, '관리자만 사용할 수 있습니다.');
    var tags = S.tags.map(function (t) { return Object.assign({}, t); });
    var phrases = S.phrases.map(function (p) { return Object.assign({}, p); });
    var tagBox = h('div', { class: 'form' });
    var phraseBox = h('div', { class: 'form' });
    var colors = ['welfare', 'counsel', 'health', 'study', 'behavior', 'career', 'etc'];
    function paintTags() {
      clear(tagBox);
      tags.forEach(function (t, i) {
        tagBox.appendChild(h('div', { class: 'inline' },
          h('span', { class: 'tag ' + t.color }, t.name || '이름'),
          h('input', { class: 'input grow', value: t.name, oninput: function (e) { t.name = e.target.value; } }),
          h('select', { class: 'select', style: 'width:auto', onchange: function (e) { t.color = e.target.value; paintTags(); } }, colors.map(function (c) { return h('option', { value: c, selected: t.color === c }, c); })),
          h('label', { class: 'checkbox' }, h('input', { type: 'checkbox', checked: t.active !== false, onchange: function (e) { t.active = e.target.checked; } }), '사용'),
          h('button', { class: 'pill sm ghost', disabled: i === 0, onclick: function () { tags.splice(i - 1, 0, tags.splice(i, 1)[0]); paintTags(); } }, '↑')));
      });
      tagBox.appendChild(h('button', { class: 'pill', onclick: function () { tags.push({ id: 't' + Date.now().toString(36), name: '', color: 'etc', active: true }); paintTags(); } }, '＋ 분야 추가'));
    }
    function paintPhrases() {
      clear(phraseBox);
      phrases.forEach(function (p, i) {
        phraseBox.appendChild(h('div', { class: 'inline' },
          h('select', { class: 'select', style: 'width:auto', onchange: function (e) { p.tagId = e.target.value; } }, tags.map(function (t) { return h('option', { value: t.id, selected: p.tagId === t.id }, t.name); })),
          h('input', { class: 'input grow', value: p.text, oninput: function (e) { p.text = e.target.value; } }),
          h('button', { class: 'pill sm ghost', onclick: function () { phrases.splice(i, 1); paintPhrases(); } }, '삭제')));
      });
      phraseBox.appendChild(h('button', { class: 'pill', onclick: function () { phrases.push({ id: '', tagId: tags[0].id, text: '' }); paintPhrases(); } }, '＋ 문장 추가'));
    }
    paintTags(); paintPhrases();
    return h('div', {},
      h('div', { class: 'topbar' }, h('button', { class: 'back glass', onclick: function () { navigate('settings'); } }, icon('back')), h('div', { class: 'grow h1', style: 'font-size:24px' }, '분야·문장 관리')),
      h('div', { class: 'glass card' }, h('div', { class: 'h2' }, '분야(태그)'), h('p', { class: 'small', style: 'margin:4px 0 12px' }, '분야 ID는 유지되므로 이름을 바꿔도 기존 기록과 연결이 끊기지 않습니다. 문제행동 분야는 위기 알림 계산에 쓰이니 ID를 유지하세요.'), tagBox,
        h('div', { style: 'margin-top:12px' }, h('button', { class: 'cta auto', onclick: function () { A.call('tags.save', { tags: tags }).then(function () { toast('저장했습니다'); return bootstrap(); }).then(render).catch(function (e) { toast(e.message, true); }); } }, '분야 저장'))),
      h('div', { class: 'glass card', style: 'margin-top:12px' }, h('div', { class: 'h2' }, '자주 쓰는 문장'), h('div', { style: 'margin-top:12px' }, phraseBox),
        h('div', { style: 'margin-top:12px' }, h('button', { class: 'cta auto', onclick: function () { A.call('phrases.save', { phrases: phrases }).then(function () { toast('저장했습니다'); return bootstrap(); }).then(render).catch(function (e) { toast(e.message, true); }); } }, '문장 저장'))));
  }

  // ------------------------------------------------------------------
  // 시작
  // ------------------------------------------------------------------
  A.on(function (type, payload) {
    if (type === 'auth') { S.me = null; render(); }
    if (type === 'flushed') toast('보관함의 기록 ' + payload + '건을 전송했습니다');
  });
  window.addEventListener('focus', function () { if (S.me) A.flushOutbox(); });
  setInterval(function () { var el = document.querySelector('.sidebar .unlock'); if (el && S.me) { var r = unlockRemaining(); if (!r && S.unlock) { S.unlock = null; render(); } } }, 30000);

  S.route = parseRoute();
  if (A.token()) {
    root.appendChild(h('div', { class: 'gs', style: 'min-height:100vh' }, h('div', { class: 'center', style: 'padding-top:40vh' }, h('span', { class: 'spinner' }))));
    bootstrap().then(render).catch(function () { A.setToken(null); render(); });
  } else render();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 무시 */ });
  }
})();
