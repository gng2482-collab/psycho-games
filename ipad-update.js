/* 新しい版が出たら入れ替える（アクセスガイド中は再読み込みができないため）
   - 画面に戻ったとき・開いたとき・30分ごとに、小さなファイル version.json で版を確かめる
   - 一覧や、ゲームのタイトル画面にいるとき（まだ操作していないときも）は自動で入れ替える
   - 遊んでいる途中なら入れ替えず、右上に「新しい版あり・タップで更新」を出す
   - 上の帯の「↻ 更新」は、いつでも押せる予備のボタン */
(function () {
  'use strict';
  var meta = document.querySelector('meta[name="app-version"]');
  var CUR = meta ? meta.getAttribute('content') : '';
  var interacted = false, newer = '', checking = false, badge = null;
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }
  function isOurs(t) { return t && t.closest && t.closest('[data-upd]'); }
  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (!isOurs(e.target)) interacted = true; }, true); });
  // 入れ替えてよい画面か：一覧、まだ操作していない、ゲームのホーム（タイトル）画面。ゲームが window.__ipadIdle を決めていればそれに従う
  function idle() {
    if (document.documentElement.getAttribute('data-page') === 'index') return true;
    if (typeof window.__ipadIdle === 'function') { try { return !!window.__ipadIdle(); } catch (e) {} }
    if (!interacted) return true;
    var b = document.body, h = location.hash;
    return (h === '' || h === '#' || h === '#home') && !!b && (b.dataset.mode === 'home' || b.classList.contains('home'));
  }
  function label(v) { var m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)/.exec(v || ''); return m ? m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] : v; }
  function doUpdate() {
    if (newer) ssSet('ipad-upd-try', newer);
    showBadge('更新しています…', false);
    var go = function () { location.reload(); };
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then(function (reg) { return reg ? reg.update() : null; }).catch(function () {}).then(function () { setTimeout(go, 400); });
    } else go();
  }
  function showBadge(text, tappable) {
    if (!badge) {
      badge = document.createElement('button'); badge.type = 'button'; badge.setAttribute('data-upd', '1');
      badge.style.cssText = 'position:fixed;z-index:2147483000;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));font:700 13px system-ui,-apple-system,"Hiragino Sans",sans-serif;color:#fff;background:#c0404a;border:0;border-radius:999px;padding:8px 14px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer';
      badge.addEventListener('click', function () { if (badge.dataset.tap === '1') doUpdate(); });
      document.body.appendChild(badge);
    }
    // 上の帯（← ゲーム一覧・↻ 更新）に重ならないよう、帯が見えていればそのすぐ下に出す
    var bar = document.querySelector('.ipad-bar'), bb = bar ? bar.getBoundingClientRect().bottom : 0;
    badge.style.top = bb > 0 ? (bb + 6) + 'px' : 'calc(8px + env(safe-area-inset-top,0px))';
    badge.textContent = text; badge.dataset.tap = tappable ? '1' : '0'; badge.hidden = false;
  }
  function check(manual) {
    if (checking || !CUR || location.protocol === 'file:') return; checking = true;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      checking = false;
      var v = j && j.v;
      if (!v || v <= CUR) { newer = ''; if (manual) showBadge('いまの版が最新です（' + label(CUR) + '）', false), setTimeout(function () { if (badge && badge.dataset.tap !== '1') badge.hidden = true; }, 2500); return; }
      newer = v;
      // 入れ替えても古いままだった（保存の都合）ときは、自動でくり返さず、ボタンだけ出す
      var tried = ssGet('ipad-upd-try') === v;
      if (manual || (idle() && !tried)) doUpdate();
      else showBadge('新しい版あり・タップで更新', true);
    }).catch(function () { checking = false; if (manual) { showBadge('ネットにつながっていません', false); setTimeout(function () { if (badge) badge.hidden = true; }, 2500); } });
  }
  window.__ipadCheckUpdate = function () { check(true); };
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-upd="manual"]'); if (b) { e.preventDefault(); check(true); } });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(false); });
  window.addEventListener('pageshow', function () { check(false); });
  setInterval(function () { if (document.visibilityState === 'visible') check(false); }, 30 * 60 * 1000);
  var vl = document.getElementById('ipadVer'); if (vl) vl.textContent = label(CUR);
})();
