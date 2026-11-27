// Funções usadas por todas as páginas

function getToken() {
  return localStorage.getItem('token');
}

function getUsuario() {
  return JSON.parse(localStorage.getItem('usuario') || 'null');
}

function sair() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  sessionStorage.clear();
  location.href = 'index.html';
}

// Chama a API com o token JWT. Ex.: await api('/pecas'), await api('/pecas', 'POST', dados)
async function api(url, metodo = 'GET', corpo) {
  const resposta = await fetch('/api' + url, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + getToken(),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401 && !url.startsWith('/auth')) sair();
  if (!resposta.ok) throw new Error(dados.erro || 'Erro na requisição');
  return dados;
}

// Evita que textos digitados virem HTML na página
function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// '2026-11-19' -> '19/11/2026'
function dataBR(data) {
  if (!data) return '-';
  const [a, m, d] = data.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

// Data de hoje + dias, no formato do <input type="date">
function dataISO(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Quantos dias se passaram desde a data
function diasDesde(data) {
  return Math.round((new Date(dataISO() + 'T00:00') - new Date(data + 'T00:00')) / 86400000);
}

// Mensagem rápida no canto da tela
function mostrarMsg(texto, tipo = 'success') {
  let caixa = document.getElementById('mensagens');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.id = 'mensagens';
    caixa.className = 'msg-flutuante';
    document.body.appendChild(caixa);
  }
  const div = document.createElement('div');
  div.className = `alert alert-${tipo} shadow mb-2`;
  div.textContent = texto;
  caixa.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function badgeSituacao(situacao) {
  const cores = { ativo: 'primary', atrasado: 'danger', devolvido: 'success' };
  return `<span class="badge text-bg-${cores[situacao]}">${situacao}</span>`;
}

// Bloqueia a página para quem não fez login e monta o menu
function iniciarPagina(paginaAtual) {
  if (!getToken()) {
    location.href = 'index.html';
    return;
  }
  const usuario = getUsuario();
  const links = [
    ['painel.html', 'Painel'],
    ['novo-emprestimo.html', 'Novo empréstimo'],
    ['solicitantes.html', 'Solicitantes'],
    ['pecas.html', 'Peças'],
  ];
  if (usuario.perfil === 'admin') links.push(['usuarios.html', 'Monitores']);

  document.getElementById('menu').innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container">
        <a class="navbar-brand fw-bold" href="painel.html">EmprestaLab 307</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="nav">
          <ul class="navbar-nav me-auto">
            ${links.map(([href, nome]) => `
              <li class="nav-item">
                <a class="nav-link ${href === paginaAtual ? 'active' : ''}" href="${href}">${nome}</a>
              </li>`).join('')}
          </ul>
          <span class="navbar-text me-3">${esc(usuario.nome)}</span>
          <button class="btn btn-outline-light btn-sm" onclick="sair()">Sair</button>
        </div>
      </div>
    </nav>`;

  carregarAlerta();
}

// RF12: faixa vermelha no topo de todas as páginas quando há atrasados
async function carregarAlerta() {
  const alerta = document.getElementById('alerta');
  if (!alerta) return;
  const atrasados = await api('/emprestimos/atrasados');
  if (atrasados.length === 0) {
    alerta.innerHTML = '';
    return;
  }
  alerta.innerHTML = `
    <div class="alert alert-danger d-flex justify-content-between align-items-center">
      <span><strong>${atrasados.length}</strong> empréstimo(s) com prazo vencido.</span>
      <a href="painel.html#atrasados" class="btn btn-sm btn-danger">Ver atrasados</a>
    </div>`;
  return atrasados;
}
