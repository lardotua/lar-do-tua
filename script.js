/* ============================================================
   LAR DO TUA — script.js
   ============================================================

   ÍNDICE:
   1. GOOGLE SHEETS   ← Cola aqui o link CSV da tua sheet
   2. WHATSAPP        ← Muda aqui o número de WhatsApp
   3. NAVEGAÇÃO       ← Não precisas de editar
   4. RENDERIZAÇÃO    ← Não precisas de editar
   ============================================================ */


/* ============================================================
   1. GOOGLE SHEETS
   ↓ Depois de publicares a sheet como CSV, cola o link aqui.
     Para obter o link:
       Ficheiro → Partilhar → Publicar na Web
       → Seleciona "Quartos" + formato "CSV" → Publicar
       → Copia o link e substitui o texto abaixo
   ============================================================ */
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSEd4S3t2mhmVMotRfoMIEH58uQMv91qcRDE5rRWVi10c5NGmwGIl4YYYtRep0Z-CfqQhFksjFGLeQe/pub?gid=146921896&single=true&output=csv";


/* ============================================================
   2. WHATSAPP
   ↓ Substitui pelo número real (formato internacional, sem espaços)
      Exemplo: 351912345678  (351 = Portugal + número sem o 0 inicial)
   ============================================================ */
const WHATSAPP_NUMBER = "351000000000";


/* ============================================================
   3. NAVEGAÇÃO — não precisas de editar
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
   4. RENDERIZAÇÃO — não precisas de editar
   ============================================================ */

// Converte linha CSV numa linha de texto simples tendo em conta campos com vírgulas entre aspas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Transforma o CSV num array de objectos room
function csvToRooms(csv) {
  const lines = csv.trim().split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (values[i] || '').trim());

    // Fotos: filtra campos img vazios
    const imgs = [obj.img1, obj.img2, obj.img3].filter(Boolean);
    // Fallback se não houver fotos
    obj.images = imgs.length ? imgs : [
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop"
    ];
    obj.img = obj.images[0];

    // Details: separados por ponto e vírgula
    obj.detailsList = obj.details ? obj.details.split(';').map(d => d.trim()).filter(Boolean) : [];

    return obj;
  }).filter(r => r.id); // ignora linhas vazias
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
        <a href="${room.link}" target="_blank" rel="noopener"
           class="btn" style="width:100%;text-align:center;display:block;background:var(--secondary);color:var(--secondary-fg)">
          Ver anúncio original
        </a>
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

async function fetchWithProxy(url) {
  const res = await fetch('/sheet-proxy');
  if (!res.ok) throw new Error("Não foi possível carregar a sheet. Verifica se está publicada como CSV.");
  return await res.text();
}

async function loadRooms() {
  if (SHEET_CSV_URL === "COLA_AQUI_O_LINK_CSV_DA_TUA_SHEET") {
    showLoading("⚠️ Ainda não ligaste a Google Sheet. Abre o script.js e cola o link CSV na secção 1.");
    return;
  }

  showLoading("A carregar quartos...");

  try {
    const csv = await fetchWithProxy(SHEET_CSV_URL);
    rooms = csvToRooms(csv);
    if (rooms.length === 0) throw new Error("Sheet vazia ou mal formatada");
    renderRooms();
  } catch (err) {
    showLoading(`❌ ${err.message}`);
    console.error(err);
  }
}

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
