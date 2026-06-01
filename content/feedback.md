---
title: 留言
hiddenFromHomePage: true
comment: false
---

欢迎留下你的反馈、建议或想说的话。**这里的留言只有我能看到，不会公开显示**，请放心。

<form id="fb-form" class="fb-form" novalidate>
  <label class="fb-label" for="fb-message">想说的话 <span class="fb-req">*</span></label>
  <textarea id="fb-message" name="message" rows="6" maxlength="5000" required placeholder="写下你的反馈、建议或问题…"></textarea>

  <div class="fb-row">
    <div>
      <label class="fb-label" for="fb-name">称呼（可选）</label>
      <input id="fb-name" name="name" type="text" maxlength="120" placeholder="怎么称呼你">
    </div>
    <div>
      <label class="fb-label" for="fb-contact">联系方式（可选）</label>
      <input id="fb-contact" name="contact" type="text" maxlength="200" placeholder="邮箱 / 微信，方便我回复">
    </div>
  </div>

  <!-- 蜜罐字段：真人看不到，机器人易填 —— 用于挡垃圾留言 -->
  <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="fb-hp">

  <button type="submit" id="fb-submit" class="fb-btn">发送留言</button>
  <p id="fb-status" class="fb-status" role="status" aria-live="polite"></p>
</form>

<script>
(function () {
  var form = document.getElementById('fb-form');
  if (!form) return;
  var status = document.getElementById('fb-status');
  var btn = document.getElementById('fb-submit');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var message = form.message.value.trim();
    if (!message) { status.textContent = '请先写点内容再发送 🙂'; return; }
    btn.disabled = true; status.textContent = '发送中…';
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: message,
        name: form.name.value.trim(),
        contact: form.contact.value.trim(),
        website: form.website.value
      })
    })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      if (d && d.ok) {
        form.reset();
        status.textContent = '已收到，谢谢你的留言！🙏';
      } else {
        status.textContent = (d && d.error) ? ('发送失败：' + d.error) : '发送失败，请稍后再试';
      }
    })
    .catch(function () { status.textContent = '网络异常，请稍后再试'; })
    .finally(function () { btn.disabled = false; });
  });
})();
</script>
