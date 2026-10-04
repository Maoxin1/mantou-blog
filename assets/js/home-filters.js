// Progressive enhancement: all selected articles remain readable without JavaScript.
(() => {
  const home = document.querySelector('[data-portfolio-home]');
  if (!home) return;
  const controls = home.querySelector('[data-home-filters]');
  const articles = [...home.querySelectorAll('[data-home-topic]')];
  if (!controls || !articles.length) return;
  controls.hidden = false;
  const select = button => {
    const topic = button.dataset.homeFilter;
    controls.querySelectorAll('[data-home-filter]').forEach(control => {
      control.setAttribute('aria-pressed', String(control === button));
    });
    articles.forEach(article => {
      article.hidden = topic !== 'all' && article.dataset.homeTopic !== topic;
    });
  };
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-home-filter]');
    if (button && controls.contains(button)) select(button);
  });
  // A reading shortcut must still reveal its target after another category was selected.
  home.addEventListener('click', event => {
    const link = event.target.closest('a[href="#reading"]');
    if (link && home.querySelector('#reading').hidden) {
      select(controls.querySelector('[data-home-filter="all"]'));
    }
  });
})();
