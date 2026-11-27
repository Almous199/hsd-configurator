// Онлайн-режим (Zoho Catalyst): window.HSD — рабочая папка в облаке вместо папки на ПК.
// Подключается обычным <script> до кода страницы во всех онлайн-страницах (SDA и секционные).
// Страницы обращаются к тем же путям, что в папке Door calculation tool (forms/…, calcs/…, catalog.json, orders.json);
// функция api (catalyst/functions/api) проверяет вход и роль. Без этого скрипта страницы работают с папкой, как раньше.
(function () {
  'use strict';
  var API = '/server/api';
  var LOGIN = '/__catalyst/auth/login';
  var ROLE = { admin: 'admin', manager: 'manager', warehouse: 'warehouse' };

  function enc(path) { return String(path).split('/').map(encodeURIComponent).join('/'); }

  function toLogin() {
    var back = location.pathname + location.search;
    location.href = LOGIN + '?redirect=' + encodeURIComponent(back);
  }

  async function call(method, path, body) {
    var r = await fetch(API + path, {
      method: method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 401) { toLogin(); throw new Error('Sign-in required'); }
    if (r.status === 404 && method === 'GET') return null;
    var txt = await r.text();
    var data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { error: txt.slice(0, 300) }; }
    if (!r.ok) {
      var err = new Error((data && data.error) || (r.status + ' ' + r.statusText));
      err.status = r.status;
      throw err;
    }
    return data;
  }

  var HSD = {
    online: true,
    me: null,
    /** Заполнить объект FS страницы: вход проверен, «папка» = облако. */
    init: async function (FS) {
      var me = await call('GET', '/me');
      HSD.me = me;
      FS.server = true; FS.user = me; FS.role = me.role; FS.dir = null; FS.state = 'ok';
      FS.name = me.email + ' · ' + (ROLE[me.role] || me.role);
      try { document.documentElement.setAttribute('data-role', me.role); } catch (e) { /* */ }
      return me;
    },
    get: function (path) { return call('GET', '/fs/' + enc(path)); },
    put: function (path, obj) { return call('PUT', '/fs/' + enc(path), obj).then(function () { return 'online'; }); },
    del: function (path) { return call('DELETE', '/fs/' + enc(path)).then(function () { return undefined; }); },
    label: function () { return HSD.me ? HSD.me.email + ' · ' + (ROLE[HSD.me.role] || HSD.me.role) : ''; },
    signOut: function () {
      if (!confirm('Sign out' + (HSD.me ? ' ' + HSD.me.email : '') + '?')) return;
      var c = window.catalyst;
      if (c && c.auth && typeof c.auth.signOut === 'function') c.auth.signOut('/app/');
      else location.href = '/__catalyst/auth/logout';
    },
  };
  window.HSD = HSD;
})();
