(() => {
  const dialog = document.querySelector('[data-follow-dialog]');

  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-follow-open]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        if (!dialog.open) dialog.showModal();
        const email = dialog.querySelector('input[type="email"]');
        if (email) email.focus();
      });
    });

    dialog.querySelector('[data-follow-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  document.querySelectorAll('[data-copy-feed]').forEach((button) => {
    button.addEventListener('click', async () => {
      const label = button.querySelector('[data-copy-feed-label]');
      const original = label?.textContent;
      try {
        await navigator.clipboard.writeText(button.dataset.feedUrl);
        if (label) label.textContent = '已复制 RSS 地址';
      } catch (_) {
        window.prompt('复制下面的 RSS 地址', button.dataset.feedUrl);
      }
      if (label && original) window.setTimeout(() => { label.textContent = original; }, 2000);
    });
  });
})();
