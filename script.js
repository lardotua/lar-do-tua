/* ============================================================
   LAR DO TUA — script.js
   ============================================================ */

const WHATSAPP_NUMBER = "351910788449";

let rooms = [];

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
function navigate(page, roomId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (page === 'quarto-detalhe' && roomId) {
    openRoomModal(roomId);
    // Volta à página de quartos como base activa
    const base = document.getElementById('page-quartos');
    if (base) base.classList.add('active');
    return;
  }

  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  document.getElementById('navLinks').classList.remove('open');
  document.getElementById('mobileToggle').classList.remove('open');
  window.scrollTo(0, 0);
}

/* ============================================================
   PARSE DO FRONT-MATTER YAML DOS FICHEIROS MARKDOWN
   ============================================================ */
function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const raw = match[1];
  const obj = {};

  const listMatch = raw.match(/^details:\n((?:[ \t]+-[^\n]*\n?)*)/m);
  if (listMatch) {
    obj.details = listMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*-\s*/, '').replace(/^item:\s*["']?/, '').replace(/["']?$/, '').trim())
      .filter(Boolean);
  }

  const imagesMatch = raw.match(/^images:\n((?:[ \t]+-[^\n]*\n?)*)/m);
  if (imagesMatch) {
    obj.images = imagesMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*-\s*/, '').replace(/^image:\s*["']?/, '').replace(/["']?$/, '').trim())
      .filter(Boolean);
  }

  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    if (key === 'details' || key === 'images') { i++; continue; }
    let value = line.slice(colonIdx + 1).trim();

    if (value === '>' || value === '>-' || value === '|' || value === '|-') {
      const foldedMode = value.startsWith('>');
      let block = [];
      i++;
      while (i < lines.length && (lines[i].startsWith(' ') || lines[i].startsWith('\t'))) {
        block.push(lines[i].trim());
        i++;
      }
      if (foldedMode) {
        let result = '';
        for (let j = 0; j < block.length; j++) {
          if (block[j] === '') {
            result += '\n\n';
          } else if (j > 0 && block[j-1] !== '' && !result.endsWith('\n\n')) {
            result += ' ' + block[j];
          } else {
            result += block[j];
          }
        }
        obj[key] = result.trim();
      } else {
        obj[key] = block.join('\n').trim();
      }
      continue;
    }

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    obj[key] = value;
    i++;
  }

  return obj;
}

/* ============================================================
   CARREGAR QUARTOS DA API GITHUB
   ============================================================ */
async function loadRooms() {
  showLoading('A carregar quartos...');
  try {
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

      let imgs = [];
      if (data.images && Array.isArray(data.images)) {
        imgs = data.images.filter(Boolean);
      } else {
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
   RENDERIZAÇÃO DOS CARDS
   ============================================================ */
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
        <a href="#" onclick="openRoomModal('${room.id}');return false"
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
   MODAL DE DETALHE — ESTADO
   ============================================================ */
let modalState = {
  room: null,
  currentIndex: 0,
  descExpanded: false,
  touchStartX: 0,
  touchStartY: 0,
};

/* ============================================================
   MODAL DE DETALHE — ABRIR / FECHAR
   ============================================================ */
function openRoomModal(id) {
  const room = rooms.find(r => r.id === id);
  if (!room) return;

  modalState.room = room;
  modalState.currentIndex = 0;
  modalState.descExpanded = false;

  const modal = document.getElementById('roomModal');
  modal.innerHTML = buildModalHTML(room);
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Bind de eventos após injectar o HTML
  bindModalEvents();
}

function closeRoomModal() {
  const modal = document.getElementById('roomModal');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  // Fecha também o zoom se estiver aberto
  const zoom = document.getElementById('photoZoom');
  if (zoom) zoom.classList.remove('open');
}

/* ============================================================
   MODAL DE DETALHE — CONSTRUÇÃO DO HTML
   ============================================================ */
function buildModalHTML(room) {
  const whatsappMsg = encodeURIComponent(`Olá! Tenho interesse no quarto "${room.title}" (${room.price}). Podem dar-me mais informações?`);
  const descLines = (room.desc || '').split('\n');
  const DESC_LIMIT = 4; // linhas visíveis antes de "Ver mais"
  const needsExpand = descLines.length > DESC_LIMIT;

  const descShort = needsExpand
    ? descLines.slice(0, DESC_LIMIT).join('\n')
    : room.desc;

  return `
    <div class="rm-backdrop" id="rmBackdrop"></div>
    <div class="rm-dialog" role="dialog" aria-modal="true">

      <!-- Cabeçalho -->
      <div class="rm-header">
        <h2 class="rm-title">${room.title}</h2>
        <button class="rm-close" id="rmClose" aria-label="Fechar">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Corpo com scroll -->
      <div class="rm-body">
        <div class="rm-grid">

          <!-- COLUNA ESQUERDA: galeria -->
          <div class="rm-gallery">

            <!-- Imagem principal com setas -->
            <div class="rm-main-wrap">
              <img id="rmMainImg"
                   src="${room.images[0]}"
                   alt="${room.title}"
                   class="rm-main-img"
                   onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop'"
              />
              ${room.images.length > 1 ? `
              <button class="rm-arrow rm-arrow-prev" id="rmPrev" aria-label="Foto anterior">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <button class="rm-arrow rm-arrow-next" id="rmNext" aria-label="Próxima foto">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              ` : ''}
              <div class="rm-zoom-hint">🔍 Clica para ampliar</div>
              <div class="rm-counter" id="rmCounter">${room.images.length > 1 ? `1 / ${room.images.length}` : ''}</div>
            </div>

            <!-- Miniaturas -->
            ${room.images.length > 1 ? `
            <div class="rm-thumbs" id="rmThumbs">
              ${room.images.map((img, i) => `
                <button class="rm-thumb ${i === 0 ? 'active' : ''}"
                        data-index="${i}"
                        aria-label="Foto ${i + 1}">
                  <img src="${img}" alt="${room.title} foto ${i + 1}"
                       onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop'" />
                </button>
              `).join('')}
            </div>` : ''}
          </div>

          <!-- COLUNA DIREITA: info -->
          <div class="rm-info">
            <p class="rm-meta">📍 ${room.location}</p>
            <p class="rm-meta">👤 ${room.contact || ''}</p>

            <div class="detail-badges" style="margin:1rem 0 1.25rem">
              <span class="badge badge-accent">${room.price}</span>
              <span class="badge badge-secondary">📅 ${room.available || 'Disponível'}</span>
            </div>

            <!-- Descrição com Ver mais/menos -->
            <div class="rm-desc-wrap">
              <p id="rmDescText" class="rm-desc-text">${descShort.replace(/\n/g, '<br>')}</p>
              ${needsExpand ? `
              <button class="rm-expand-btn" id="rmExpandBtn">Ver mais ▼</button>
              ` : ''}
            </div>

            <!-- O que inclui -->
            ${room.detailsList.length ? `
            <div class="detail-includes" style="margin:1.25rem 0">
              <h2 style="font-size:1.1rem;margin-bottom:0.75rem">O que inclui</h2>
              <ul>${room.detailsList.map(d => `<li>${d}</li>`).join('')}</ul>
            </div>` : ''}

            <!-- Botões de acção -->
            <div class="rm-actions">
              <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}"
                 target="_blank" rel="noopener"
                 class="btn btn-whatsapp" style="width:100%;text-align:center;display:block">
                💬 Tenho Interesse — WhatsApp
              </a>
              ${room.link ? `
              <a href="${room.link}" target="_blank" rel="noopener"
                 class="btn" style="width:100%;text-align:center;display:block;background:var(--secondary);color:var(--secondary-fg)">
                Ver anúncio original
              </a>` : ''}
            </div>
          </div><!-- /rm-info -->

        </div><!-- /rm-grid -->
      </div><!-- /rm-body -->
    </div><!-- /rm-dialog -->
  `;
}

/* ============================================================
   MODAL DE DETALHE — EVENTOS
   ============================================================ */
function bindModalEvents() {
  const modal   = document.getElementById('roomModal');
  const room    = modalState.room;

  // Fechar
  document.getElementById('rmClose').addEventListener('click', closeRoomModal);
  document.getElementById('rmBackdrop').addEventListener('click', closeRoomModal);

  // Setas
  const prevBtn = document.getElementById('rmPrev');
  const nextBtn = document.getElementById('rmNext');
  if (prevBtn) prevBtn.addEventListener('click', () => changeSlide(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => changeSlide(1));

  // Miniaturas
  const thumbs = document.getElementById('rmThumbs');
  if (thumbs) {
    thumbs.querySelectorAll('.rm-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        goToSlide(parseInt(btn.dataset.index));
      });
    });
  }

  // Clique na imagem principal → zoom
  document.getElementById('rmMainImg').addEventListener('click', () => {
    openZoom(modalState.currentIndex);
  });

  // Swipe no mobile — imagem principal
  const mainWrap = modal.querySelector('.rm-main-wrap');
  mainWrap.addEventListener('touchstart', e => {
    modalState.touchStartX = e.touches[0].clientX;
    modalState.touchStartY = e.touches[0].clientY;
  }, { passive: true });
  mainWrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - modalState.touchStartX;
    const dy = e.changedTouches[0].clientY - modalState.touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      changeSlide(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  // Descrição: Ver mais / Ver menos
  const expandBtn = document.getElementById('rmExpandBtn');
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      modalState.descExpanded = !modalState.descExpanded;
      const descEl = document.getElementById('rmDescText');
      const descLines = (room.desc || '').split('\n');
      const DESC_LIMIT = 4;
      if (modalState.descExpanded) {
        descEl.innerHTML = room.desc.replace(/\n/g, '<br>');
        expandBtn.textContent = 'Ver menos ▲';
      } else {
        descEl.innerHTML = descLines.slice(0, DESC_LIMIT).join('\n').replace(/\n/g, '<br>');
        expandBtn.textContent = 'Ver mais ▼';
      }
    });
  }

  // Teclado: ESC e setas
  modal._keyHandler = function(e) {
    if (e.key === 'Escape') {
      const zoom = document.getElementById('photoZoom');
      if (zoom && zoom.classList.contains('open')) {
        closeZoom();
      } else {
        closeRoomModal();
      }
    }
    if (e.key === 'ArrowLeft')  changeSlide(-1);
    if (e.key === 'ArrowRight') changeSlide(1);
  };
  document.addEventListener('keydown', modal._keyHandler);
}

/* ============================================================
   CARROSSEL — NAVEGAÇÃO
   ============================================================ */
function goToSlide(index) {
  const room = modalState.room;
  if (!room) return;
  const total = room.images.length;
  modalState.currentIndex = (index + total) % total;

  // Troca imagem principal
  const mainImg = document.getElementById('rmMainImg');
  if (mainImg) {
    mainImg.src = room.images[modalState.currentIndex];
  }

  // Actualiza contador
  const counter = document.getElementById('rmCounter');
  if (counter) {
    counter.textContent = total > 1 ? `${modalState.currentIndex + 1} / ${total}` : '';
  }

  // Actualiza miniaturas
  const thumbs = document.getElementById('rmThumbs');
  if (thumbs) {
    thumbs.querySelectorAll('.rm-thumb').forEach((btn, i) => {
      btn.classList.toggle('active', i === modalState.currentIndex);
    });
    // Scroll automático para a miniatura activa
    const activeThumb = thumbs.querySelector('.rm-thumb.active');
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }
}

function changeSlide(direction) {
  goToSlide(modalState.currentIndex + direction);
}

/* ============================================================
   ZOOM / LIGHTBOX
   ============================================================ */
let zoomState = {
  currentIndex: 0,
  touchStartX: 0,
};

function openZoom(index) {
  const room = modalState.room;
  if (!room) return;
  zoomState.currentIndex = index;

  const zoom = document.getElementById('photoZoom');
  zoom.innerHTML = buildZoomHTML(room, index);
  zoom.classList.add('open');

  bindZoomEvents();
}

function closeZoom() {
  const zoom = document.getElementById('photoZoom');
  zoom.classList.remove('open');
}

function buildZoomHTML(room, index) {
  return `
    <div class="pz-backdrop" id="pzBackdrop"></div>
    <div class="pz-content">
      <button class="pz-close" id="pzClose" aria-label="Fechar zoom">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="pz-img-wrap" id="pzImgWrap">
        <img id="pzImg"
             src="${room.images[index]}"
             alt="${room.title}"
             onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&h=900&fit=crop'"
        />
      </div>
      ${room.images.length > 1 ? `
      <button class="pz-arrow pz-arrow-prev" id="pzPrev" aria-label="Foto anterior">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button class="pz-arrow pz-arrow-next" id="pzNext" aria-label="Próxima foto">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <div class="pz-counter">${index + 1} / ${room.images.length}</div>
      ` : ''}
    </div>
  `;
}

function bindZoomEvents() {
  const room = modalState.room;

  document.getElementById('pzClose').addEventListener('click', closeZoom);
  document.getElementById('pzBackdrop').addEventListener('click', closeZoom);

  const prevBtn = document.getElementById('pzPrev');
  const nextBtn = document.getElementById('pzNext');
  if (prevBtn) prevBtn.addEventListener('click', e => { e.stopPropagation(); changeZoomSlide(-1); });
  if (nextBtn) nextBtn.addEventListener('click', e => { e.stopPropagation(); changeZoomSlide(1); });

  // Swipe no zoom
  const wrap = document.getElementById('pzImgWrap');
  if (wrap) {
    wrap.addEventListener('touchstart', e => {
      zoomState.touchStartX = e.touches[0].clientX;
    }, { passive: true });
    wrap.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - zoomState.touchStartX;
      if (Math.abs(dx) > 40) changeZoomSlide(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
}

function changeZoomSlide(direction) {
  const room = modalState.room;
  if (!room) return;
  const total = room.images.length;
  zoomState.currentIndex = (zoomState.currentIndex + direction + total) % total;

  const img = document.getElementById('pzImg');
  const counter = document.querySelector('.pz-counter');
  if (img) img.src = room.images[zoomState.currentIndex];
  if (counter) counter.textContent = `${zoomState.currentIndex + 1} / ${total}`;

  // Sincroniza o carrossel do modal principal
  goToSlide(zoomState.currentIndex);
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

  // Limpa listener de teclado ao fechar modal
  document.getElementById('roomModal').addEventListener('transitionend', function() {
    if (!this.classList.contains('open') && this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  });
});
