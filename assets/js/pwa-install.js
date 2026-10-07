(() => {
  'use strict';
  const buttons = Array.from(document.querySelectorAll('[data-pwa-install]'));
  const dialog = document.getElementById('pwa-install-dialog');
  if (!dialog || !buttons.length) return;
  const english = dialog.dataset.pwaLang === 'en';
  const status = dialog.querySelector('[data-pwa-status]');
  const display = window.matchMedia('(display-mode: standalone)');
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const embedded = /MicroMessenger|QQ\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
  const android = /Android/i.test(navigator.userAgent);
  let installed = display.matches || navigator.standalone === true;
  let deferredPrompt = null;
  let busy = false;
  let lastTrigger = null;
  function updateButtons() {
    for (const button of buttons) {
      button.hidden = installed;
      button.disabled = busy;
    }
  }
  function showGuide(trigger) {
    lastTrigger = trigger;
    status.textContent = '';
    const platform = embedded ? 'embedded' : ios ? 'ios' : android ? 'android' : 'browser';
    for (const guide of dialog.querySelectorAll('[data-pwa-guide]')) {
      guide.hidden = guide.dataset.pwaGuide !== platform;
    }
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }
  function closeGuide() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    if (lastTrigger && !lastTrigger.hidden) lastTrigger.focus();
  }
  window.addEventListener('beforeinstallprompt', event => {
    if (installed || ios || embedded) return;
    event.preventDefault();
    deferredPrompt = event;
    updateButtons();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    updateButtons();
    if (dialog.open) closeGuide();
  });
  if (typeof display.addEventListener === 'function') {
    display.addEventListener('change', event => {
      installed = event.matches || navigator.standalone === true;
      updateButtons();
    });
  }
  for (const button of buttons) {
    button.addEventListener('click', async () => {
      if (busy || installed) return;
      if (!deferredPrompt || ios || embedded) return showGuide(button);
      const event = deferredPrompt;
      deferredPrompt = null;
      busy = true;
      updateButtons();
      try {
        // The browser prompt must be invoked directly from this user gesture.
        const prompting = event.prompt();
        await prompting;
        const choice = await event.userChoice;
        if (choice && choice.outcome === 'accepted') installed = true;
      } catch {
        showGuide(button);
      } finally {
        busy = false;
        updateButtons();
      }
    });
  }
  dialog.querySelector('[data-pwa-close]').addEventListener('click', closeGuide);
  dialog.addEventListener('close', () => {
    if (lastTrigger && !lastTrigger.hidden) lastTrigger.focus();
  });
  dialog.querySelector('[data-pwa-copy]').addEventListener('click', async () => {
    const input = dialog.querySelector('#pwa-install-url');
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = english ? 'Link copied.' : '链接已复制。';
    } catch {
      input.focus();
      input.select();
      status.textContent = english ? 'Select and copy the address above.' : '请选中上方地址并复制。';
    }
  });
  updateButtons();
})();
