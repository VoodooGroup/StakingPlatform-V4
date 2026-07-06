window.VoodooActiveSince = (function () {
  function start(sinceIso) {
    const el = document.getElementById('activeSince');
    if (!el) return;
    const startDate = new Date(sinceIso);

    function tick() {
      const now = new Date();
      let diff = Math.floor((now - startDate) / 1000);
      const days = Math.floor(diff / 86400);
      diff %= 86400;
      const hours = Math.floor(diff / 3600);
      diff %= 3600;
      const mins = Math.floor(diff / 60);
      el.textContent = `Active Since: ${days} days, ${hours} hours, ${mins} mins`;
    }

    tick();
    setInterval(tick, 60000);
  }

  return { start };
})();