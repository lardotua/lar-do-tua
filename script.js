/* ============================================================
   LAR DO TUA — script.js
   Os quartos são geridos pelo painel em /admin
   ============================================================ */

const WHATSAPP_NUMBER = "351910788449";

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
let rooms = [];

function navigate(page, roomId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (page === 'quarto-detalhe' && roomId) {
    document.getElementById('page-quarto-detalhe').classList.add('active');
    renderRoomDetail(roomId);
  } else {
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
  }

  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  document.getElementById('navLinks').classList.remove('open');
  document.getElementById('mobileToggle').classList.remove('open');
  window.scrollTo(0, 0);
}

/* ============================================================
   LEITURA DOS QUARTOS (ficheiros Markdown gerados pelo CMS)
   ============================================================ */

function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const raw = match[1];
  const obj = {};

  // Extrai listas (details e images)
  const listMatch = raw.match(/^details:\r?\n((?:[ \t]+-[^\r\n]*\r?\n?)*)/m);
  if (listMatch) {
    obj.details = listMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*-\s*/, '').replace(/^item:\s*["']?/, '').replace(/["']?$/, '').trim())
      .filter(Boolean);
  }

  const imagesMatch = raw.match(/^images:\r?\n((?:[ \t]+-[^\r\n]*\r?\n?)*)/m);
  if (imagesMatch) {
    obj.images = imagesMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*-\s*/, '').replace(/^image:\s*["']?/, '').replace(/["']?$/, '').trim())
      .filter(Boolean);
  }

  // Parser linha a linha
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    if (key === 'details' || key === 'images') {
      // salta o bloco inteiro desta chave
      i++;
      while (i < lines.length && (lines[i].startsWith(' ') || lines[i].startsWith('\t') || lines[i].trim() === '')) {
        // mas para se a próxima linha com conteúdo NÃO começa com espaço
        if (lines[i].trim() !== '' && !lines[i].startsWith(' ') && !lines[i].startsWith('\t')) break;
        i++;
      }
      continue;
    }

    let value = line.slice(colonIdx + 1).trim();

    // Bloco multi-linha: >- >  |- |
    if (value === '>' || value === '>-' || value === '|' || value === '|-') {
      const folded = value.startsWith('>');
      // Recolhe todas as linhas até encontrar uma chave nova (palavra: no início sem indentação)
      i++;
      const blockLines = [];
      while (i < lines.length) {
        const l = lines[i];
        // nova chave YAML = linha não indentada com "palavra:" — termina o bloco
        if (l.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*:/)) break;
        blockLines.push(l.trimEnd());
        i++;
      }

      if (folded) {
        // >- : linhas vazias = \n\n, outras linhas juntam com espaço
        // EXCETO linhas que começam com "- " (listas) — preservar com \n
        let result = '';
        let prevEmpty = false;
        for (let j = 0; j < blockLines.length; j++) {
          const bl = blockLines[j].trimStart();
          if (bl === '') {
            if (!prevEmpty) result += '\n';
            prevEmpty = true;
          } else if (bl.startsWith('- ')) {
            // item de lista — nova linha
            result += '\n' + bl;
            prevEmpty = false;
          } else {
            if (prevEmpty || result === '') {
              result += (result === '' ? '' : '\n') + bl;
            } else {
              result += ' ' + bl;
            }
            prevEmpty = false;
          }
        }
        obj[key] = result.trim();
      } else {
        obj[key] = blockLines.map(l => l.trimStart()).join('\n').trim();
      }
      continue;
    }

    // Remove aspas
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    obj[key] = value;
    i++;
  }

  return obj;
}

async function loadRooms() {
  showLoading('A carregar quartos...');

  try {
    // Usa a GitHub API para listar os ficheiros em _quartos/
    const res = await fetch('https://api.github.com/repos/lardotua/lar-do-tua/contents/_quartos');
    if (!res.ok) throw new Error('Erro ao carregar quartos.');
    const files = await res.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md') && f.name !== '.gitkeep');

    if (mdFiles.length === 0) throw new Error('Ainda não há quartos adicionados. Vai a /admin para adicionar.');

    const promises = mdFiles.map(async (file) => {
      const r = await fetch(file.download_url);
      if (!r.ok) return null;
      const text = await r.text();
      const data = parseFrontMatter(text);
      if (!data || !data.id) return null;

      // Fotos: lê a lista "images" gerada pelo CMS
      let imgs = [];
      if (data.images && Array.isArray(data.images)) {
        imgs = data.images.filter(Boolean);
      } else {
        // fallback para campos antigos img1..img6
        imgs = [data.img1, data.img2, data.img3, data.img4, data.img5, data.img6].filter(Boolean);
      }
      data.images = imgs.length ? imgs : [
        'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop'
      ];
      data.img = data.images[0];
      data.detailsList = Array.isArray(data.details) ? data.details :
        (data.details ? data.details.split(';').map(d => d.trim()).filter(Boolean) : []);
      return data;
    });

    rooms = (await Promise.all(promises)).filter(Boolean);
    if (rooms.length === 0) throw new Error('Ainda não há quartos adicionados. Vai a /admin para adicionar.');
    renderRooms();
  } catch (err) {
    showLoading(`❌ ${err.message}`);
    console.error(err);
  }
}

/* ============================================================
   DETAIL PAGE, LIGHTBOX, CAROUSEL — reescrito do zero
   ============================================================ */

let _currentRoomImages = [];
let _currentImgIndex = 0;
let _lbOpen = false;

function renderRoomDetail(id) {
  const room = rooms.find(r => r.id === id);
  if (!room) return;

  const whatsappMsg = encodeURIComponent(
    `Olá! Tenho interesse no quarto "${room.title}" (${room.price}). Podem dar-me mais informações?`
  );

  _currentRoomImages = room.images;
  _currentImgIndex = 0;

  const thumbsHTML = room.images.map((img, i) => `
    <button class="thumb-btn ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="goToSlide(${i})">
      <img src="${img}" alt="foto ${i+1}" onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop'" />
    </button>`).join('');

  const detailsHTML = room.detailsList && room.detailsList.length ? `
    <div class="detail-includes">
      <h2 style="font-size:1.1rem;margin-bottom:0.75rem">O que inclui</h2>
      <ul>${room.detailsList.map(d => `<li>${d}</li>`).join('')}</ul>
    </div>` : '';

  const linkHTML = room.link ? `
    <a href="${room.link}" target="_blank" rel="noopener"
       class="btn" style="width:100%;text-align:center;display:block;background:var(--secondary);color:var(--secondary-fg);margin-top:0.75rem">
      Ver anúncio original
    </a>` : '';

  document.getElementById('quartoDetalheContent').innerHTML = `
    <a href="#" class="back-link" onclick="navigate('home');return false">← Voltar ao início</a>

    <div class="detail-grid">

      <!-- COLUNA ESQUERDA: galeria -->
      <div class="gallery-col">
        <div class="gallery-main-wrap">
          <img id="mainSlideImg"
               src="${room.images[0]}"
               alt="${room.title}"
               onclick="openLightbox(_currentImgIndex)"
               onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop'" />
          <span class="zoom-hint">🔍 Clica para ampliar</span>
          ${room.images.length > 1 ? `
          <button class="slide-arrow slide-prev" onclick="slideNav(-1)">&#8249;</button>
          <button class="slide-arrow slide-next" onclick="slideNav(1)">&#8250;</button>
          <span class="slide-counter" id="slideCounter">1 / ${room.images.length}</span>` : ''}
        </div>
        ${room.images.length > 1 ? `<div class="gallery-thumbs">${thumbsHTML}</div>` : ''}
      </div>

      <!-- COLUNA DIREITA: info -->
      <div class="detail-info-col">
        <h1 style="font-size:1.75rem;margin-bottom:0.4rem">${room.title}</h1>
        <p class="room-location" style="margin-bottom:0.2rem">📍 ${room.location}</p>
        <p class="room-location" style="margin-bottom:1rem">👤 ${room.contact}</p>

        <div class="detail-badges">
          <span class="badge badge-accent">${room.price}</span>
          <span class="badge badge-secondary">📅 ${room.available}</span>
        </div>

        <div class="desc-block" id="descBlock">
          <p class="desc-text" id="descText" style="white-space:pre-line;line-height:1.8;color:rgba(13,31,53,0.85)">${room.desc || ''}</p>
          <button class="ver-mais-btn" id="verMaisBtn" onclick="toggleDesc()" style="display:none">Ver mais ↓</button>
        </div>

        ${detailsHTML}

        <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}" target="_blank" rel="noopener"
           class="btn btn-whatsapp" style="width:100%;text-align:center;display:block;margin-top:1rem">
          💬 Tenho Interesse — WhatsApp
        </a>
        ${linkHTML}
      </div>
    </div>

    <!-- LIGHTBOX -->
    <div id="lightboxOverlay" class="lightbox-overlay" onclick="closeLightbox()">
      <button class="lb-close" onclick="closeLightbox()">✕</button>
      <button class="lb-arrow lb-prev" onclick="event.stopPropagation();lbNav(-1)">&#8249;</button>
      <img id="lbImg" src="" alt="" onclick="event.stopPropagation()" />
      <button class="lb-arrow lb-next" onclick="event.stopPropagation();lbNav(1)">&#8250;</button>
      <p id="lbCounter" class="lb-counter"></p>
    </div>`;

  // Inicializa "Ver mais" se necessário
  requestAnimationFrame(() => {
    const el = document.getElementById('descText');
    const btn = document.getElementById('verMaisBtn');
    if (el && btn) {
      if (el.scrollHeight > 160) {
        el.classList.add('desc-collapsed');
        btn.style.display = 'block';
      }
    }
  });

  // Swipe/drag no mobile e desktop
  initSwipe();
}

function toggleDesc() {
  const el = document.getElementById('descText');
  const btn = document.getElementById('verMaisBtn');
  if (!el || !btn) return;
  if (el.classList.contains('desc-collapsed')) {
    el.classList.remove('desc-collapsed');
    btn.textContent = 'Ver menos ↑';
  } else {
    el.classList.add('desc-collapsed');
    btn.textContent = 'Ver mais ↓';
    document.getElementById('descBlock').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function goToSlide(index) {
  _currentImgIndex = index;
  const img = document.getElementById('mainSlideImg');
  const counter = document.getElementById('slideCounter');
  if (img) img.src = _currentRoomImages[index];
  if (counter) counter.textContent = `${index + 1} / ${_currentRoomImages.length}`;
  document.querySelectorAll('.thumb-btn').forEach((b, i) => {
    b.classList.toggle('active', i === index);
  });
}

function slideNav(dir) {
  const next = (_currentImgIndex + dir + _currentRoomImages.length) % _currentRoomImages.length;
  goToSlide(next);
}

function openLightbox(index) {
  _lbOpen = true;
  _currentImgIndex = index;
  const overlay = document.getElementById('lightboxOverlay');
  const img = document.getElementById('lbImg');
  const counter = document.getElementById('lbCounter');
  if (!overlay || !img) return;
  img.src = _currentRoomImages[index];
  if (counter) counter.textContent = `${index + 1} / ${_currentRoomImages.length}`;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  _lbOpen = false;
  const overlay = document.getElementById('lightboxOverlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

function lbNav(dir) {
  _currentImgIndex = (_currentImgIndex + dir + _currentRoomImages.length) % _currentRoomImages.length;
  const img = document.getElementById('lbImg');
  const counter = document.getElementById('lbCounter');
  if (img) img.src = _currentRoomImages[_currentImgIndex];
  if (counter) counter.textContent = `${_currentImgIndex + 1} / ${_currentRoomImages.length}`;
}

// ESC fecha lightbox
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
  if (_lbOpen && e.key === 'ArrowLeft') lbNav(-1);
  if (_lbOpen && e.key === 'ArrowRight') lbNav(1);
});

// Swipe touch e drag mouse
function initSwipe() {
  const el = document.getElementById('mainSlideImg');
  if (!el) return;
  let startX = 0;
  const onStart = e => { startX = (e.touches ? e.touches[0].clientX : e.clientX); };
  const onEnd = e => {
    const endX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
    const diff = startX - endX;
    if (Math.abs(diff) > 40) slideNav(diff > 0 ? 1 : -1);
  };
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });
  el.addEventListener('mousedown', onStart);
  el.addEventListener('mouseup', onEnd);
}

function roomCard(room, showDesc) {
  return `
    <div class="room-card">
      <img src="${room.img}" alt="${room.title}" loading="lazy"
           onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop'" />
      <div class="room-card-body">
        <div class="room-card-header">
          <h3>${room.title}</h3>
          <span class="room-price">${room.price}</span>
        </div>
        <p class="room-location">📍 ${room.location}</p>
        ${showDesc ? `<p class="room-desc">${room.desc}</p>` : ''}
        <a href="#" onclick="navigate('quarto-detalhe','${room.id}');return false"
           class="btn" style="background:${showDesc ? 'var(--accent)' : 'var(--primary)'};color:#fff;text-align:center">
          ${showDesc ? 'Tenho Interesse' : 'Ver Detalhes'}
        </a>
      </div>
    </div>`;
}

function renderRooms() {
  document.getElementById('featuredRooms').innerHTML = rooms.slice(0, 3).map(r => roomCard(r, false)).join('');
  document.getElementById('allRooms').innerHTML = rooms.map(r => roomCard(r, true)).join('');
}

function showLoading(msg) {
  const html = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted)">${msg}</div>`;
  document.getElementById('featuredRooms').innerHTML = html;
  document.getElementById('allRooms').innerHTML = html;
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadRooms();

  document.getElementById('mobileToggle').addEventListener('click', function () {
    this.classList.toggle('open');
    document.getElementById('navLinks').classList.toggle('open');
  });

  document.getElementById('contactForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const contact = document.getElementById('contact').value;
    const msg = encodeURIComponent(`Olá! O meu nome é ${name}. O meu contacto é: ${contact}. Gostava de saber mais sobre os quartos disponíveis.`);
    document.getElementById('formSuccess').style.display = 'block';
    this.style.display = 'none';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  });
});
