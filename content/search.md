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
    new PagefindUI({
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
  });
</script>
