gsap.registerPlugin(ScrollTrigger);

/* ============ SPLIT HERO TITLE INTO LETTERS ============ */
function splitChars(el) {
  const text = el.textContent;
  el.innerHTML = '';
  el.querySelectorAll; // noop keep linters quiet
  const frag = document.createDocumentFragment();
  text.split('').forEach((ch) => {
    if (ch === '\n') return;
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    frag.appendChild(span);
  });
  el.appendChild(frag);
  return el.querySelectorAll('.char');
}

document.querySelectorAll('[data-split]').forEach((el) => {
  // preserve <br> as line breaks by processing per line
  const lines = el.innerHTML.split('<br>');
  el.innerHTML = '';
  const allChars = [];
  lines.forEach((lineHTML, i) => {
    const lineDiv = document.createElement('div');
    lineDiv.textContent = lineHTML;
    const chars = splitChars(lineDiv);
    el.appendChild(lineDiv);
    allChars.push(...chars);
  });
  gsap.set(allChars, { opacity: 0, y: 26 });
  gsap.to(allChars, {
    opacity: 1,
    y: 0,
    duration: 0.7,
    ease: 'power3.out',
    stagger: 0.018,
    delay: 0.3,
  });
});

/* ============ SPLIT HEADLINES INTO LINES, REVEAL ON SCROLL ============ */
document.querySelectorAll('[data-split-lines]').forEach((el) => {
  const words = el.textContent.trim().split(' ');
  el.innerHTML = '';
  // group words into rough lines using wbr-free wrapping via a single inner span per line-break heuristic
  // simplest robust approach: wrap whole text as one line-block, let CSS wrap naturally within .line
  const line = document.createElement('span');
  line.className = 'line';
  const inner = document.createElement('span');
  inner.className = 'line-inner';
  inner.textContent = words.join(' ');
  line.appendChild(inner);
  el.appendChild(line);

  gsap.to(inner, {
    y: '0%',
    duration: 0.9,
    ease: 'power4.out',
    scrollTrigger: {
      trigger: el,
      start: 'top 88%',
    },
  });
});

/* ============ GENERIC REVEALS ============ */
document.querySelectorAll('[data-reveal="fade"]').forEach((el) => {
  gsap.to(el, {
    opacity: 1,
    duration: 0.8,
    ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 90%' },
  });
});

document.querySelectorAll('[data-reveal="up"]').forEach((el, i) => {
  gsap.to(el, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'power3.out',
    delay: (i % 3) * 0.08,
    scrollTrigger: { trigger: el, start: 'top 90%' },
  });
});

/* hero-content items fade in on load (they use data-reveal=fade too, but hero should not wait for scroll) */
gsap.to('.hero-content [data-reveal="fade"]', {
  opacity: 1,
  duration: 0.9,
  ease: 'power2.out',
  stagger: 0.15,
  delay: 0.9,
});
gsap.to('.scroll-cue', { opacity: 1, duration: 1, delay: 1.6 });
gsap.set('.scroll-cue', { opacity: 0 });

/* ============ NAV BACKGROUND ON SCROLL ============ */
const nav = document.getElementById('nav');
ScrollTrigger.create({
  start: 'top -80',
  onUpdate: (self) => {
    nav.style.boxShadow = self.progress > 0 || window.scrollY > 40 ? '0 8px 30px rgba(0,0,0,0.25)' : 'none';
  },
});

/* ============ PHONE MOCKUP SCROLL REVEAL ============ */
gsap.to('#phoneMock', {
  opacity: 1,
  y: 0,
  scale: 1,
  duration: 1,
  ease: 'power3.out',
  scrollTrigger: { trigger: '#phoneMock', start: 'top 85%' },
});

gsap.to('.gauge-arc', {
  strokeDashoffset: 44,
  duration: 1.4,
  ease: 'power2.out',
  scrollTrigger: { trigger: '#phoneMock', start: 'top 80%' },
});

/* ============ HERO CELL FILL SUBTLE PARALLAX ============ */
gsap.to('.hero-cell', {
  y: 30,
  ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
});
gsap.to('.circuit', {
  y: -40,
  ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
});

/* ============ MODALS ============ */
const overlays = {
  login: document.getElementById('loginOverlay'),
  signup: document.getElementById('signupOverlay'),
  success: document.getElementById('successOverlay'),
};

function openModal(name) {
  Object.values(overlays).forEach((o) => o.classList.remove('open'));
  overlays[name].classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAllModals() {
  Object.values(overlays).forEach((o) => o.classList.remove('open'));
  document.body.style.overflow = '';
}

document.getElementById('openLogin').addEventListener('click', () => openModal('login'));
document.getElementById('openSignup').addEventListener('click', () => openModal('signup'));
document.getElementById('heroSignup').addEventListener('click', () => openModal('signup'));
document.getElementById('ctaSignup').addEventListener('click', () => openModal('signup'));

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', closeAllModals);
});
document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAllModals();
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});
document.querySelectorAll('[data-switch-to]').forEach((btn) => {
  btn.addEventListener('click', () => openModal(btn.dataset.switchTo));
});

/* ============ IN-MEMORY "ACCOUNTS" (prototype only, no backend) ============ */
const accounts = [];

document.getElementById('signupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector('input[type="text"]').value.trim();
  const battery = document.getElementById('batteryType').value;
  const purchaseDate = document.getElementById('purchaseDate').value;

  accounts.push({ name, battery, purchaseDate, createdAt: new Date().toISOString() });

  const successSub = document.getElementById('successSub');
  successSub.textContent = name
    ? `Welcome to CellPass, ${name.split(' ')[0]} — your battery's passport starts now.`
    : `Welcome to CellPass — your battery's passport starts now.`;

  form.reset();
  openModal('success');
  animateStamp();
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const successSub = document.getElementById('successSub');
  successSub.textContent = 'Logged in — good to have you back.';
  document.getElementById('successTitle').textContent = 'Welcome back';
  e.target.reset();
  openModal('success');
  animateStamp();
  // restore default copy for next signup
  setTimeout(() => { document.getElementById('successTitle').textContent = 'Account created'; }, 800);
});

function animateStamp() {
  const stamp = document.getElementById('successStamp');
  const checkPath = document.querySelector('.check-path');
  gsap.fromTo(stamp, { scale: 1.6, opacity: 0, rotate: -14 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.5, ease: 'back.out(3)' });
  gsap.fromTo(checkPath, { strokeDashoffset: 90 }, { strokeDashoffset: 0, duration: 0.5, delay: 0.25, ease: 'power2.out' });
}

/* burger placeholder for future mobile nav (links hidden on small screens via CSS) */
