(function () {
  const cdnHost = 'img.wr-travel.com';
  const prefix = '/wr-journeys/';

  document.addEventListener('error', function (event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.dataset.cdnFallback === 'done') return;

    let failedUrl;
    try {
      failedUrl = new URL(image.currentSrc || image.src, window.location.href);
    } catch (_) {
      return;
    }
    if (failedUrl.hostname !== cdnHost || !failedUrl.pathname.startsWith(prefix)) return;

    image.dataset.cdnFallback = 'done';
    image.removeAttribute('srcset');
    const picture = image.closest('picture');
    if (picture) picture.querySelectorAll('source').forEach(function (source) { source.remove(); });
    image.src = '/' + failedUrl.pathname.slice(prefix.length);
  }, true);
}());
