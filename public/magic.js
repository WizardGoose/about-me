const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const toggle = document.querySelector('.motion-toggle');
let paused = reducedMotion.matches;
function setPaused(value) {
  paused = value;
  document.body.dataset.paused = String(value);
  document.dispatchEvent(new CustomEvent('portfolio:motion', { detail: { paused: value } }));
  toggle.setAttribute('aria-pressed', String(value));
  toggle.innerHTML = value ? 'Resume magic <span aria-hidden="true">▷</span>' : 'Pause magic <span aria-hidden="true">Ⅱ</span>';
  if (value) document.querySelectorAll('.burst-star').forEach(star => star.remove());
}
setPaused(paused);
toggle.addEventListener('click', () => setPaused(!paused));
reducedMotion.addEventListener('change', event => setPaused(event.matches));
const stars = document.querySelector('#stars');
for (let i = 0; i < 35; i++) {
  const star = document.createElement('span');
  star.className = 'star-particle';
  star.textContent = i % 5 === 0 ? '✧' : '·';
  star.style.cssText = `left:${(i * 37.7) % 100}%;top:${(i * 23.3) % 100}%;--size:${i % 5 === 0 ? 16 : 22}px;--duration:${3 + i % 5}s;--delay:-${i % 7}s`;
  stars.append(star);
}
function sparkle(x, y, count = 9) {
  if (paused || reducedMotion.matches || document.querySelectorAll('.burst-star').length > 75) return;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span');
    star.className = 'burst-star';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = i % 2 ? '✦' : '✧';
    star.style.color = i % 3 === 0 ? 'var(--gold)' : 'var(--cyan)';
    document.body.append(star);
    const angle = Math.random() * Math.PI * 2;
    const distance = 25 + Math.random() * 80;
    const animation = star.animate([
      { transform: `translate(${x - 10}px, ${y - 10}px) scale(.4)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(angle) * distance}px, ${y + Math.sin(angle) * distance}px) rotate(100deg) scale(0)`, opacity: 0 }
    ], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.1,.6,.3,1)' });
    animation.onfinish = () => star.remove();
  }
}
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.motion-toggle')) sparkle(event.clientX, event.clientY);
});
let previousTrail = 0;
document.querySelector('.magic-scene').addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || performance.now() - previousTrail < 100) return;
  previousTrail = performance.now();
  sparkle(event.clientX, event.clientY, 2);
});
document.querySelector('.project').addEventListener('focus', event => {
  const rect = event.target.getBoundingClientRect();
  sparkle(rect.right - 18, rect.top + rect.height / 2, 5);
});

const discordButton = document.querySelector('.discord-copy');
const brotherLink = document.querySelector('.brother-link');
for (const eventName of ['pointerenter', 'focus']) {
  brotherLink.addEventListener(eventName, () => {
    const rect = brotherLink.getBoundingClientRect();
    sparkle(rect.left + 18, rect.top + rect.height / 2, 5);
  });
}
const copyStatus = document.querySelector('.copy-status');
let copyReset;
discordButton.addEventListener('click', async () => {
  clearTimeout(copyReset);
  try {
    await navigator.clipboard.writeText('ghostygoose_');
    copyStatus.textContent = 'Copied ghostygoose_!';
    discordButton.dataset.copied = 'true';
    copyReset = setTimeout(() => {
      copyStatus.textContent = '';
      delete discordButton.dataset.copied;
    }, 3500);
  } catch {
    copyStatus.textContent = 'Copy manually: ghostygoose_';
    delete discordButton.dataset.copied;
  }
});
