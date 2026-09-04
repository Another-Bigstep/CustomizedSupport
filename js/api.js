/*
 * API 클라이언트
 * - 실제 모드: Apps Script 웹앱에 text/plain POST (CORS 사전요청 없음)
 * - 데모 모드: js/mock.js 의 가상 서버 사용
 * - BUSY/네트워크 오류는 지수 백오프로 재시도
 * - records.create 는 실패 시 보관함(outbox)에 넣고 자동 재전송 (ID 기반 중복 방지)
 */
var SOSApi = (function () {
  'use strict';
  var cfg = window.SOS_CONFIG || {};
  var KEY_TOKEN = 'sos.token', KEY_UNLOCK = 'sos.unlock', KEY_OUTBOX = 'sos.outbox';
  var listeners = [];
  var flushing = false;

  function store(k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장소 사용 불가 */ } }
  function load(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }

  function token() { return load(KEY_TOKEN, null); }
  function setToken(t) { store(KEY_TOKEN, t); }
  function unlockInfo() { var u = load(KEY_UNLOCK, null); if (u && u.expiresAt > Date.now()) return u; if (u) store(KEY_UNLOCK, null); return null; }
  function setUnlock(u) { store(KEY_UNLOCK, u); }

  function isDemo() { return !cfg.apiUrl; }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function transport(body) {
    if (isDemo()) return window.SOSMock.handle(body);
    return fetch(cfg.apiUrl, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw Object.assign(new Error('서버 응답 오류 (' + res.status + ')'), { code: 'HTTP', retry: res.status >= 500 || res.status === 429 });
      return res.json();
    });
  }

  function ApiError(code, message, data) { this.code = code; this.message = message; this.data = data; }
  ApiError.prototype = Object.create(Error.prototype);

  // 재시도: BUSY, 네트워크 오류, 5xx → 최대 5회 (0.6s, 1.2s, 2.4s, 4.8s, 9.6s)
  function call(action, data, opts) {
    opts = opts || {};
    var body = { action: action, data: data || {}, token: token() };
    var u = unlockInfo();
    if (u) body.unlockToken = u.token;
    var attempt = 0;
    function run() {
      return transport(body).then(function (res) {
        if (res && res.ok) return res.data;
        var code = res && res.code || 'SERVER_ERROR';
        if (code === 'BUSY' && attempt < 5) { attempt++; return sleep(600 * Math.pow(2, attempt - 1) + Math.random() * 300).then(run); }
        if (code === 'AUTH' && action !== 'login' && action !== 'unlock' && action !== 'changePassword' && action !== 'setPin') {
          setToken(null); emit('auth');
        }
        throw new ApiError(code, res && res.error || '오류가 발생했습니다.', res && res.data);
      }, function (err) {
        if (err instanceof ApiError) throw err;
        var retry = err && err.retry !== false && attempt < 5;
        if (retry) { attempt++; return sleep(600 * Math.pow(2, attempt - 1) + Math.random() * 300).then(run); }
        throw new ApiError('NETWORK', '서버에 연결할 수 없습니다. 네트워크를 확인하세요.');
      });
    }
    return run();
  }

  // ---------- 보관함 ----------
  function outbox() { return load(KEY_OUTBOX, []); }
  function setOutbox(list) { store(KEY_OUTBOX, list); emit('outbox', list.length); }

  function createRecord(record) {
    return call('records.create', { record: record }).catch(function (err) {
      if (err.code === 'NETWORK' || err.code === 'BUSY' || err.code === 'HTTP') {
        var list = outbox();
        if (!list.some(function (x) { return x.id === record.id; })) list.push(record);
        setOutbox(list);
        return { record: record, queued: true };
      }
      throw err;
    });
  }

  function flushOutbox() {
    var list = outbox();
    if (flushing || !list.length || !token()) return Promise.resolve(0);
    flushing = true;
    var sent = 0;
    return list.reduce(function (p, rec) {
      return p.then(function () {
        return call('records.create', { record: rec }).then(function () {
          sent++;
          setOutbox(outbox().filter(function (x) { return x.id !== rec.id; }));
        }).catch(function (err) {
          // 검증 오류처럼 다시 보내도 실패할 요청은 버린다
          if (err.code === 'BAD_REQUEST' || err.code === 'FORBIDDEN') setOutbox(outbox().filter(function (x) { return x.id !== rec.id; }));
        });
      });
    }, Promise.resolve()).then(function () { flushing = false; if (sent) emit('flushed', sent); return sent; }, function () { flushing = false; });
  }

  function on(fn) { listeners.push(fn); }
  function emit(type, payload) { listeners.forEach(function (fn) { try { fn(type, payload); } catch (e) { /* 무시 */ } }); }

  window.addEventListener('online', function () { flushOutbox(); });
  setInterval(flushOutbox, 30000);

  return {
    isDemo: isDemo, call: call, token: token, setToken: setToken, unlockInfo: unlockInfo, setUnlock: setUnlock,
    createRecord: createRecord, outbox: outbox, flushOutbox: flushOutbox, on: on, ApiError: ApiError
  };
})();
