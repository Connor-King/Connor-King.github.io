// Minimal lightbox for project galleries. Without JS the links simply open the image.
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".gallery a"));
  var dialog = document.getElementById("lightbox");
  if (!links.length || !dialog || typeof dialog.showModal !== "function") return;

  var img = dialog.querySelector("img");
  var count = dialog.querySelector(".lb-count");
  var index = 0;

  function show(i) {
    index = (i + links.length) % links.length;
    var a = links[index];
    img.src = a.getAttribute("href");
    img.alt = a.querySelector("img").alt;
    count.textContent = (index + 1) + " / " + links.length;
  }

  links.forEach(function (a, i) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      show(i);
      dialog.showModal();
    });
  });

  dialog.querySelector(".lb-close").addEventListener("click", function () { dialog.close(); });
  dialog.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
  dialog.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog || e.target.tagName === "FIGURE") dialog.close(); });
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });

  // Basic swipe support on touch screens.
  var startX = null;
  dialog.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
  dialog.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
})();
