/* KSU Engineering Alumni — draft site interactions */
(function () {
  'use strict';

  /* ---------- Mobile nav ---------- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Active nav link on scroll ---------- */
  var links = nav ? Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]')) : [];
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* ---------- Animated stat counters ---------- */
  var counters = Array.prototype.slice.call(document.querySelectorAll('.stat-num[data-count]'));
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;

    if (reduceMotion) {
      el.textContent = formatNumber(target);
      return;
    }

    var duration = 1400;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatNumber(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var counterObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.4 });

      counters.forEach(function (c) { counterObserver.observe(c); });
    } else {
      counters.forEach(runCounter);
    }
  }

  /* ---------- Alumni news type filter chips ---------- */
  var chips = Array.prototype.slice.call(document.querySelectorAll('.feed-filters .chip'));
  var posts = Array.prototype.slice.call(document.querySelectorAll('.post'));

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('is-active'); });
      chip.classList.add('is-active');

      var wanted = chip.textContent.trim();

      posts.forEach(function (post) {
        var typeEl = post.querySelector('.post-type');
        var type = typeEl ? typeEl.textContent.trim() : '';
        var show = wanted === 'ทั้งหมด' || type === wanted;
        post.style.display = show ? '' : 'none';
      });
    });
  });

  /* ---------- Facet checkboxes: demo only ---------- */
  var facetBoxes = Array.prototype.slice.call(document.querySelectorAll('.facets input[type="checkbox"]'));
  var resultCount = document.querySelector('.result-count');

  if (facetBoxes.length && resultCount) {
    var baseTotal = 2847;

    facetBoxes.forEach(function (box) {
      box.addEventListener('change', function () {
        var checked = facetBoxes.filter(function (b) { return b.checked; });

        if (!checked.length) {
          resultCount.innerHTML = 'พบ <strong>' + formatNumber(baseTotal) + '</strong> รายการ';
          return;
        }

        // Demo behaviour: sum the facet counts shown next to each checked filter.
        var sum = checked.reduce(function (acc, b) {
          var countEl = b.parentElement.querySelector('.count');
          var n = countEl ? parseInt(countEl.textContent.replace(/,/g, ''), 10) : 0;
          return acc + (isNaN(n) ? 0 : n);
        }, 0);

        resultCount.innerHTML =
          'พบ <strong>' + formatNumber(Math.min(sum, baseTotal)) + '</strong> รายการ ' +
          '<span style="font-size:.85rem;color:var(--muted);">(ตัวเลขจำลองสำหรับหน้าร่าง)</span>';
      });
    });
  }
})();
