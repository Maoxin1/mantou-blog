(() => {
  const status = document.querySelector('[data-practice-status]');
  if (!status || !navigator.clipboard || !window.isSecureContext) return;
  document.querySelectorAll('[data-copy-practice]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const prompt = document.getElementById(button.dataset.copyPractice);
      if (!prompt) return;
      try {
        await navigator.clipboard.writeText(prompt.textContent.trim());
        status.textContent = status.dataset.success;
      } catch (_) {
        status.textContent = status.dataset.failure;
      }
    });
  });
})();
