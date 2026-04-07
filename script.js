/* ============================================================
   LAR DO TUA — script.js
   Os quartos são geridos pelo painel em /admin
   ============================================================ */

const WHATSAPP_NUMBER = "351000000000";

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
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const obj = {};
  match[1].split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Remove aspas
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    obj[key] = value;
  });

  // Lê listas (details)
  const listMatch = match[1].match(/details:\n((?:\s+-.*\n?)*)/);
  if (listMatch) {
    obj.details = listMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s+-\s*/, '').replace(/^item:\s*/, '').trim())
      .filter(Boolean);
  }

  return obj;
}

async function loadRooms() {
  showLoading('A carregar quartos...');

  try {
    // Carrega o índice de quartos gerado automaticamente
    const res = await fetch('/quartos.json');
    if (!res.ok) throw new Error('Ficheiro de quartos não encontrado.');
    const files = await res.json();

    const promises = files.map(async (filename) => {
      const r = await fetch(`/_quartos/${filename}`);
      if (!r.ok) return null;
      const text = await r.text();
      const data = parseFrontMatter(text);
      if (!data || !data.id) return null;

      const imgs = [data.img1, data.img2, data.img3].filter(Boolean);
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
   RENDERIZAÇÃO
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
        <a href="#" onclick="navigate('quarto-detalhe','${room.id}');return false"
           class="btn" style="background:${showDesc ? 'var(--accent)' : 'var(--primary)'};color:#fff;text-align:center">
          ${showDesc ? 'Tenho Interesse' : 'Ver Detalhes'}
        </a>
      </div>
    </div>`;
}

function renderRoomDetail(id) {
  const room = rooms.find(r => r.id === id);
  if (!room) return;
  const whatsappMsg = encodeURIComponent(`Olá! Tenho interesse no quarto "${room.title}" (${room.price}). Podem dar-me mais informações?`);

  document.getElementById('quartoDetalheContent').innerHTML = `
    <a href="#" onclick="navigate('quartos');return false" class="back-link">← Voltar aos quartos</a>
    <div class="detail-grid">
      <div>
        <div class="gallery-main">
          <img id="mainImg" src="${room.images[0]}" alt="${room.title}"
               onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop'" />
        </div>
        <div class="gallery-thumbs">
          ${room.images.map((img, i) => `
            <button class="${i === 0 ? 'active' : ''}" onclick="changeImg('${img}', this)">
              <img src="${img}" alt="${room.title} foto ${i + 1}" />
            </button>`).join('')}
        </div>
      </div>
      <div>
        <h1 style="font-size:2rem;margin-bottom:0.5rem">${room.title}</h1>
        <p class="room-location" style="margin-bottom:0.25rem">📍 ${room.location}</p>
        <p class="room-location" style="margin-bottom:1rem">👤 ${room.contact}</p>
        <div class="detail-badges">
          <span class="badge badge-accent">${room.price}</span>
          <span class="badge badge-secondary">📐 ${room.area}</span>
          <span class="badge badge-secondary">📅 ${room.available}</span>
        </div>
        <p style="color:rgba(30,42,58,0.8);margin-bottom:1.5rem;line-height:1.7">${room.desc}</p>
        ${room.detailsList.length ? `
        <div class="detail-includes">
          <h2 style="font-size:1.25rem;margin-bottom:1rem">O que inclui</h2>
          <ul>${room.detailsList.map(d => `<li>${d}</li>`).join('')}</ul>
        </div>` : ''}
        <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}" target="_blank" rel="noopener"
           class="btn btn-whatsapp" style="width:100%;text-align:center;margin-bottom:0.75rem;display:block">
          💬 Tenho Interesse — WhatsApp
        </a>
        ${room.link ? `
        <a href="${room.link}" target="_blank" rel="noopener"
           class="btn" style="width:100%;text-align:center;display:block;background:var(--secondary);color:var(--secondary-fg)">
          Ver anúncio original
        </a>` : ''}
      </div>
    </div>`;
}

function changeImg(src, btn) {
  document.getElementById('mainImg').src = src;
  document.querySelectorAll('.gallery-thumbs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
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
