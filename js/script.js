
(() => {
  "use strict";

  const CONFIG = {
    weddingDate: "2027-05-05T09:00:00+07:00",
    openDelay: 1500,                          
    rsvpEndpoint: "",                         
    storageKey: "rsvp-jessica-yakup",
  };

  const $  = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const guestName = (new URLSearchParams(location.search).get("to") || "").trim().slice(0, 60);

  function initGuest() {
    if (!guestName) return;
    $("#guestName").textContent = guestName;   // textContent → aman dari XSS
    $("#guestBox").hidden = false;
    const nameInput = $("#rsvpName");
    if (nameInput) nameInput.value = guestName;
  }

  const music = {
    audio: $("#bgm"),
    button: $("#musicBtn"),
    wantPlaying: false,

    setState(isPlaying) {
      this.button.classList.toggle("is-playing", isPlaying);
      this.button.setAttribute("aria-pressed", String(isPlaying));
      $("i", this.button).className = isPlaying ? "bi bi-pause-fill" : "bi bi-play-fill";
    },

    async play() {
      try {
        this.audio.volume = 0.8;
        await this.audio.play();
        this.wantPlaying = true;
        this.setState(true);
      } catch (err) {
        this.wantPlaying = false;
        this.setState(false);
        console.warn("Musik tidak dapat diputar:", err.message);
      }
    },

    pause() {
      this.audio.pause();
      this.wantPlaying = false;
      this.setState(false);
    },

    init() {
      this.button.addEventListener("click", () => (this.audio.paused ? this.play() : this.pause()));

      // Jeda saat tab disembunyikan, lanjut saat kembali
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && !this.audio.paused) {
          this.audio.pause();
          this.resumeOnReturn = true;
        } else if (!document.hidden && this.resumeOnReturn) {
          this.resumeOnReturn = false;
          this.audio.play().catch(() => {});
        }
      });
    },
  };

  function initCover() {
    const cover = $("#cover");
    const envelope = $("#envelope");
    let opened = false;

    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    function openInvitation() {
      if (opened) return;
      opened = true;

      envelope.classList.add("is-open");
      envelope.setAttribute("aria-expanded", "true");
      envelope.disabled = true;

      music.button.hidden = false;
      music.play();

      setTimeout(() => {
        cover.classList.add("is-hidden");
        document.body.classList.remove("is-locked");
        window.scrollTo(0, 0);
        revealVisible();
      }, CONFIG.openDelay);

      setTimeout(() => cover.remove(), CONFIG.openDelay + 1600);
    }

    envelope.addEventListener("click", openInvitation);
  }

  function initCountdown() {
    const target = new Date(CONFIG.weddingDate).getTime();
    const cells = {
      days: $('[data-unit="days"]'),
      hours: $('[data-unit="hours"]'),
      minutes: $('[data-unit="minutes"]'),
      seconds: $('[data-unit="seconds"]'),
    };

    const MS = { day: 86400000, hour: 3600000, minute: 60000, second: 1000 };

    function tick() {
      const diff = Math.max(0, target - Date.now());
      cells.days.textContent    = Math.floor(diff / MS.day);
      cells.hours.textContent   = Math.floor((diff % MS.day) / MS.hour);
      cells.minutes.textContent = Math.floor((diff % MS.hour) / MS.minute);
      cells.seconds.textContent = Math.floor((diff % MS.minute) / MS.second);
      if (diff === 0) clearInterval(timer);
    }

    const timer = setInterval(tick, 1000);
    tick();
  }

  let observer = null;

  function initReveal() {
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });

    // Jeda bertingkat untuk elemen bersaudara
    $$(".gallery__col, .gallery__block").forEach((group) => {
      $$(".reveal", group).forEach((el, i) => el.style.setProperty("--d", `${i * 0.12}s`));
    });

    items.forEach((el) => observer.observe(el));
  }

  function revealVisible() {
    $$(".reveal").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) el.classList.add("is-visible");
    });
  }

  function initLightbox() {
    const modal = $("#lightbox");
    const image = $("#lightboxImg");
    modal.addEventListener("show.bs.modal", (event) => {
      const trigger = event.relatedTarget;
      if (!trigger) return;
      image.src = trigger.dataset.full;
      image.alt = $("img", trigger)?.alt || "";
    });
    modal.addEventListener("hidden.bs.modal", () => { image.removeAttribute("src"); });
  }

  function initRsvp() {
    const form = $("#rsvpForm");
    const submitBtn = $("#rsvpSubmit");
    const feedback = $("#rsvpFeedback");
    const attError = $("#attError");

    function showFeedback(type, text) {
      feedback.className = `rsvp-feedback is-${type}`;
      feedback.textContent = text;
    }

    function setLoading(isLoading) {
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading ? "Mengirim..." : "Konfirmasi";
    }

    async function save(data) {
      if (CONFIG.rsvpEndpoint) {
        await fetch(CONFIG.rsvpEndpoint, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data),
        });
        return;
      }
      try {
        const list = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "[]");
        list.push(data);
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(list));
      } catch { /* penyimpanan lokal tidak tersedia — abaikan */ }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const attendance = form.elements.attendance.value;
      attError.hidden = Boolean(attendance);
      form.classList.add("was-validated");
      if (!form.checkValidity() || !attendance) return;

      const data = {
        name: form.elements.name.value.trim(),
        attendance,
        message: form.elements.message.value.trim(),
        createdAt: new Date().toISOString(),
      };

      setLoading(true);
      try {
        await save(data);
        showFeedback(
          "success",
          attendance === "Hadir"
            ? "Terima kasih! Konfirmasi kehadiran Anda telah kami terima."
            : "Terima kasih atas ucapan dan doa Anda."
        );
        form.reset();
        form.classList.remove("was-validated");
        if (guestName) form.elements.name.value = guestName;
      } catch {
        showFeedback("error", "Konfirmasi belum terkirim. Periksa koneksi internet lalu coba lagi.");
      } finally {
        setLoading(false);
      }
    });

    $$('input[name="attendance"]', form).forEach((radio) =>
      radio.addEventListener("change", () => { attError.hidden = true; })
    );
  }

  function initImageFallback() {
    $$("img.js-photo").forEach((img) => {
      const markMissing = () => img.classList.add("is-missing");
      img.addEventListener("error", markMissing);
      if (img.complete && img.naturalWidth === 0) markMissing();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initGuest();
    initImageFallback();
    music.init();
    initCover();
    initCountdown();
    initReveal();
    initLightbox();
    initRsvp();
  });
})();
