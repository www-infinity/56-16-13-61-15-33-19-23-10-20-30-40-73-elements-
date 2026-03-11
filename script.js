/* ═══════════════════════════════════════════════════════════════
   HEM Recipe Book — script.js
   Interactivity: scroll animations, vote widget, deep-dive panels
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Scroll-in animations ─────────────────────────────────── */
  function initScrollAnimations() {
    const targets = document.querySelectorAll(
      '.element-card, .alien-card, .system-card, .science-card, ' +
      '.property, .ufo-prop, .sandwich-layer, .step'
    );

    targets.forEach(function (el) {
      el.classList.add('fade-up');
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    targets.forEach(function (el) { io.observe(el); });
  }

  /* ─── Vote widget ────────────────────────────────────────────── */
  var votes = { hea: 0, heo: 0 };
  var voted = false;

  window.castVote = function (choice) {
    if (voted) return;
    voted = true;
    votes[choice]++;

    var countHEA = document.getElementById('countHEA');
    var countHEO = document.getElementById('countHEO');
    var voteHEA  = document.getElementById('voteHEA');
    var voteHEO  = document.getElementById('voteHEO');
    var result   = document.getElementById('voteResult');

    if (countHEA) countHEA.textContent = votes.hea;
    if (countHEO) countHEO.textContent = votes.heo;

    if (choice === 'hea' && voteHEA) {
      voteHEA.classList.add('voted');
      voteHEA.disabled = true;
      if (voteHEO) voteHEO.disabled = true;
      if (result) {
        result.textContent = '⚙️ Super-Metal it is! You\'re going to need a nuclear furnace.';
        result.style.color = 'var(--hea)';
      }
    } else if (choice === 'heo' && voteHEO) {
      voteHEO.classList.add('voted');
      voteHEO.disabled = true;
      if (voteHEA) voteHEA.disabled = true;
      if (result) {
        result.textContent = '🔮 Smart Ceramic — the future of sensors and energy storage!';
        result.style.color = 'var(--heo)';
      }
    }
  };

  /* ─── Deep-dive toggle panels ─────────────────────────────── */
  function initDeepDives() {
    var btns = document.querySelectorAll('.deepdive-btn');

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        var panelId  = btn.getAttribute('aria-controls');
        var panel    = panelId ? document.getElementById(panelId) : null;

        if (!panel) return;

        if (expanded) {
          btn.setAttribute('aria-expanded', 'false');
          panel.hidden = true;
          btn.textContent = btn.textContent.replace('↑', '→').replace('Close', '→');
        } else {
          btn.setAttribute('aria-expanded', 'true');
          panel.hidden = false;
          // smooth scroll into view after opening
          setTimeout(function () {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 50);
        }
      });
    });
  }

  /* ─── Nav active highlighting on scroll ─────────────────────── */
  function initNavHighlight() {
    var sections = document.querySelectorAll('section[id], header[id]');
    var navLinks = document.querySelectorAll('.nav__links a');

    if (!navLinks.length || !sections.length) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach(function (link) {
              link.classList.remove('active');
              if (link.getAttribute('href') === '#' + entry.target.id) {
                link.classList.add('active');
              }
            });
          }
        });
      },
      { threshold: 0.3 }
    );

    sections.forEach(function (s) { io.observe(s); });
  }

  /* ─── Element chip tooltip ───────────────────────────────────── */
  function initChipTooltips() {
    var chips = document.querySelectorAll('.element-chip[title]');
    chips.forEach(function (chip) {
      chip.setAttribute('role', 'tooltip');
      chip.setAttribute('tabindex', '0');
    });
  }

  /* ─── Sandwich layer hover glow ─────────────────────────────── */
  function initSandwichHover() {
    var layers = document.querySelectorAll('.sandwich-layer__bar');
    layers.forEach(function (bar) {
      bar.addEventListener('mouseenter', function () {
        var glow = document.querySelector('.sandwich-glow');
        if (glow) glow.style.opacity = '3';
      });
      bar.addEventListener('mouseleave', function () {
        var glow = document.querySelector('.sandwich-glow');
        if (glow) glow.style.opacity = '1';
      });
    });
  }

  /* ─── Smooth scroll polyfill for older Safari ───────────────── */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* ─── Boot ───────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initScrollAnimations();
    initDeepDives();
    initNavHighlight();
    initChipTooltips();
    initSandwichHover();
    initSmoothScroll();
  });

}());
