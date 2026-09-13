---
title: 搜索
hiddenFromHomePage: true
comment: false
---

<link href="/pagefind/pagefind-ui.css" rel="stylesheet">
<div id="search" class="pf-search"></div>
<script src="/pagefind/pagefind-ui.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', function () {
    const searchRoot = document.querySelector('#search');
    const readQuery = function () {
      return new URLSearchParams(window.location.search).get('q') || '';
    };
    const writeQuery = function (value) {
      const url = new URL(window.location.href);
      const query = value.trim();
      if (query) {
        url.searchParams.set('q', query);
      } else {
        url.searchParams.delete('q');
      }
      const nextURL = url.pathname + url.search + url.hash;
      const currentURL = window.location.pathname + window.location.search + window.location.hash;
      if (nextURL !== currentURL) window.history.replaceState(null, '', nextURL);
    };
    const pagefind = new PagefindUI({
      element: "#search",
      showSubResults: true,
      showImages: false,
      pageSize: 8,
      translations: {
        placeholder: "搜索文章…",
        clear_search: "清除",
        load_more: "加载更多结果",
        search_label: "搜索本站",
        zero_results: "没有找到与「[SEARCH_TERM]」相关的内容",
        many_results: "找到 [COUNT] 条与「[SEARCH_TERM]」相关的结果",
        one_result: "找到 [COUNT] 条与「[SEARCH_TERM]」相关的结果",
        searching: "正在搜索「[SEARCH_TERM]」…"
      }
    });
    const searchbox = searchRoot.querySelector('.pagefind-ui__search-input');
    const restoreQuery = function () {
      const query = readQuery();
      pagefind.triggerSearch(query);
    };
    searchbox.addEventListener('input', function () {
      writeQuery(searchbox.value);
    });
    searchRoot.addEventListener('click', function (event) {
      if (event.target.closest('.pagefind-ui__search-clear')) {
        window.requestAnimationFrame(function () {
          writeQuery(searchbox.value);
        });
      }
    });
    window.addEventListener('popstate', restoreQuery);
    if (readQuery()) restoreQuery();
  });
</script>
