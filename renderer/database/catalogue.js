// database: pictures of Paddock catalogue cars in the lists, loaded when they come into view
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
let slotcarSource = 'local';
const cataloguePages = new Map();
let stopCataloguePictures = () => {};
let cataloguePictureActive = 0,
  cataloguePictureWake = () => {};
const catalogueImage = (marker, cls = '', frame = null) =>
  `<img class="${cls}" data-catalogue-picture="${esc(marker.id)}" alt=""${frame ? ` style="transform:${Widgets.frameTransform(frame)}"` : ''}>`;
function loadCataloguePictures(box, entity, revision, current) {
  let stopped = false;
  const queue = [],
    queued = new Set();
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          enqueue(entry.target);
        }
    },
    { rootMargin: '100px' }
  );
  function enqueue(img) {
    if (queued.has(img)) return;
    queued.add(img);
    queue.push(img);
    pump();
  }
  function pump() {
    while (!stopped && current() && cataloguePictureActive < 4 && queue.length) {
      const img = queue.shift();
      cataloguePictureActive++;
      (typeof CatalogueThumbnails === 'undefined'
        ? api.cataloguePicture(entity, img.dataset.cataloguePicture, revision)
        : CatalogueThumbnails.get(JSON.stringify([entity, img.dataset.cataloguePicture, revision]), () =>
            api.cataloguePicture(entity, img.dataset.cataloguePicture, revision)
          )
      )
        .then(src => {
          if (!stopped && current() && img.isConnected && src) img.src = src;
        })
        .catch(() => {
          /* A stale page never paints a newer image into an older row. Refresh fetches the new revision. */
        })
        .finally(() => {
          cataloguePictureActive--;
          cataloguePictureWake();
        });
    }
  }
  cataloguePictureWake = pump;
  box.querySelectorAll('[data-catalogue-picture]').forEach(img => observer.observe(img));
  return () => {
    stopped = true;
    queue.length = 0;
    observer.disconnect();
    if (cataloguePictureWake === pump) cataloguePictureWake = () => {};
  };
}
