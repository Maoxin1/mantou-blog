/* Both pinned CMS versions expose the same Immutable preSave/newRecord contract. */
(function () {
  'use strict';
  var registered = new WeakSet();

  window.registerPostAliases = function (cms) {
    if (!cms || typeof cms.registerEventListener !== 'function') {
      throw new Error('CMS preSave hooks are unavailable; aliases cannot be generated safely.');
    }
    if (registered.has(cms)) return;
    cms.registerEventListener({
      name: 'preSave',
      handler: function ({ entry }) {
        var data = entry && entry.get('data');
        // Never rewrite old aliases when editing a published entry or another collection.
        if (!data || entry.get('collection') !== 'posts' || entry.get('newRecord') !== true) return data;
        var date = String(data.get('date') || '').match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
        var slug = String(data.get('slug') || '').trim();
        if (!date || !/^(?=.{1,32}$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          throw new Error('新文章需要有效日期与 1–32 位英文短链接，才能生成旧地址。');
        }
        var existing = data.get('aliases');
        var aliases = existing && typeof existing.toJS === 'function' ? existing.toJS() : existing;
        aliases = Array.isArray(aliases) ? aliases.slice() : [];
        var alias = '/posts/' + date[1] + '-' + slug + '/';
        if (aliases.indexOf(alias) === -1) aliases.push(alias);
        return data.set('aliases', aliases);
      },
    });
    registered.add(cms);
  };
})();
