(function () {
  var el = document.getElementById('site-header');
  if (!el) return;
  el.className = 'gnav';
  el.innerHTML =
    '<div class="gnav-inner">' +
      '<a class="gnav-logo" href="/"><img src="/flasqo-logo.png" alt="Flasqo logo" width="28" height="28"> Flasqo</a>' +
      '<nav class="gnav-links" aria-label="Main">' +
        '<a href="/guides/api-testing/">Guides</a>' +
        '<a href="/#faq">FAQ</a>' +
        '<a class="gnav-cta" href="/">Start Testing Free</a>' +
      '</nav>' +
    '</div>';
})();
