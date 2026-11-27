iniciarPagina('novo-emprestimo.html');

let solicitante = null; // solicitante escolhido
let carrinho = [];      // [{ peca_id, nome, quantidade, disponivel }]
let pecasEncontradas = [];

// Prazo padrão: 7 dias, e não deixa escolher data no passado
document.getElementById('prazo').value = dataISO(7);
document.getElementById('prazo').min = dataISO(0);

// ---------- 1. Solicitante ----------

async function buscarSolicitante() {
  const texto = document.getElementById('buscaSolicitante').value.trim();
  const area = document.getElementById('resultadoSolicitante');
  if (!texto) {
    area.innerHTML = '';
    return;
  }
  try {
    const lista = await api('/solicitantes?busca=' + encodeURIComponent(texto));
    area.innerHTML = lista.length ? lista.slice(0, 8).map((s) => {
      // RF09: mostra o motivo e não deixa escolher
      const motivo = s.bloqueado ? 'Bloqueado' : s.atrasado ? 'Tem devolução atrasada' : '';
      return `
        <button type="button" class="list-group-item list-group-item-action ${motivo ? 'disabled' : ''}"
                onclick="escolherSolicitante(${s.id})">
          <strong>${esc(s.nome)}</strong> <span class="text-muted small">${esc(s.matricula)} · ${esc(s.tipo)}</span>
          ${motivo ? `<span class="badge text-bg-danger float-end">${motivo}</span>` : ''}
        </button>`;
    }).join('') : '<div class="text-muted small">Nenhum solicitante encontrado.</div>';
    area.dataset.lista = JSON.stringify(lista);
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

function escolherSolicitante(id) {
  const lista = JSON.parse(document.getElementById('resultadoSolicitante').dataset.lista || '[]');
  selecionar(lista.find((s) => s.id === id));
}

function selecionar(s) {
  solicitante = s;
  const caixa = document.getElementById('solicitanteEscolhido');
  caixa.innerHTML = `
    <div class="alert alert-secondary d-flex justify-content-between align-items-center mb-0">
      <div><strong>${esc(s.nome)}</strong><br><span class="small">${esc(s.matricula)} · ${esc(s.telefone || s.email || '')}</span></div>
      <button class="btn btn-sm btn-outline-dark" onclick="trocarSolicitante()">Trocar</button>
    </div>`;
  caixa.classList.remove('d-none');
  document.getElementById('areaBuscaSolicitante').classList.add('d-none');
}

function trocarSolicitante() {
  solicitante = null;
  document.getElementById('solicitanteEscolhido').classList.add('d-none');
  document.getElementById('areaBuscaSolicitante').classList.remove('d-none');
  document.getElementById('buscaSolicitante').focus();
}

// ---------- 2. Peças ----------

async function buscarPeca() {
  const texto = document.getElementById('buscaPeca').value.trim();
  const area = document.getElementById('resultadoPeca');
  try {
    pecasEncontradas = await api('/pecas?busca=' + encodeURIComponent(texto));
    area.innerHTML = pecasEncontradas.length ? pecasEncontradas.map((p) => {
      const noCarrinho = carrinho.find((c) => c.peca_id === p.id)?.quantidade || 0;
      const resta = p.quantidade_disponivel - noCarrinho;
      return `
        <div class="list-group-item d-flex justify-content-between align-items-center gap-2">
          <div>
            <strong>${esc(p.nome)}</strong> <span class="text-muted small">${esc(p.categoria)}</span><br>
            <span class="small ${resta ? 'text-success' : 'text-danger'}">Disponível: ${resta}</span>
          </div>
          <div class="d-flex gap-1">
            <input type="number" id="qtd-${p.id}" class="form-control form-control-sm" style="width: 70px"
                   value="1" min="1" max="${resta}" ${resta ? '' : 'disabled'}>
            <button class="btn btn-sm btn-dark" onclick="adicionar(${p.id})" ${resta ? '' : 'disabled'}>Adicionar</button>
          </div>
        </div>`;
    }).join('') : '<div class="text-muted small">Nenhuma peça encontrada.</div>';
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

function adicionar(id) {
  const p = pecasEncontradas.find((x) => x.id === id);
  const qtd = Number(document.getElementById('qtd-' + id).value);
  const item = carrinho.find((c) => c.peca_id === id);
  const jaNoCarrinho = item ? item.quantidade : 0;

  // RF08 no front: não passa do disponível
  if (!Number.isInteger(qtd) || qtd < 1) return mostrarMsg('Quantidade inválida', 'warning');
  if (qtd + jaNoCarrinho > p.quantidade_disponivel) {
    return mostrarMsg(`Só há ${p.quantidade_disponivel} unidade(s) de ${p.nome}`, 'warning');
  }

  if (item) item.quantidade += qtd;
  else carrinho.push({ peca_id: id, nome: p.nome, quantidade: qtd });

  desenharCarrinho();
  buscarPeca(); // atualiza o "disponível" da lista
}

function remover(id) {
  carrinho = carrinho.filter((c) => c.peca_id !== id);
  desenharCarrinho();
  buscarPeca();
}

function desenharCarrinho() {
  document.getElementById('carrinho').innerHTML = carrinho.length ? carrinho.map((c) => `
    <tr>
      <td>${esc(c.nome)}</td>
      <td class="text-center">${c.quantidade}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-danger" onclick="remover(${c.peca_id})">Remover</button></td>
    </tr>`).join('') : '<tr><td colspan="3" class="text-muted small">Carrinho vazio.</td></tr>';
}

// ---------- 3. Confirmar ----------

async function confirmar() {
  const prazo = document.getElementById('prazo').value;
  if (!solicitante) return mostrarMsg('Escolha o solicitante', 'warning');
  if (carrinho.length === 0) return mostrarMsg('Adicione pelo menos uma peça', 'warning');
  if (!prazo || prazo < dataISO(0)) return mostrarMsg('Escolha uma data de devolução válida', 'warning');

  const botao = document.getElementById('btnConfirmar');
  botao.disabled = true;
  try {
    const r = await api('/emprestimos', 'POST', {
      solicitante_id: solicitante.id,
      data_prevista_devolucao: prazo,
      observacao: document.getElementById('observacao').value,
      itens: carrinho.map((c) => ({ peca_id: c.peca_id, quantidade: c.quantidade })),
    });
    location.href = `emprestimo.html?id=${r.id}&novo=1`;
  } catch (err) {
    mostrarMsg(err.message, 'danger');
    botao.disabled = false;
  }
}

// ---------- Eventos ----------

let espera1, espera2;
document.getElementById('buscaSolicitante').addEventListener('input', () => {
  clearTimeout(espera1);
  espera1 = setTimeout(buscarSolicitante, 300);
});
document.getElementById('buscaPeca').addEventListener('input', () => {
  clearTimeout(espera2);
  espera2 = setTimeout(buscarPeca, 300);
});

// Vindo da tela de solicitantes (?solicitante=ID), já seleciona
const idInicial = new URLSearchParams(location.search).get('solicitante');
if (idInicial) {
  api('/solicitantes/' + idInicial).then((s) => {
    if (s.bloqueado) mostrarMsg(`${s.nome} está bloqueado(a)`, 'danger');
    else if (s.atrasado) mostrarMsg(`${s.nome} tem devolução atrasada`, 'danger');
    else selecionar(s);
  }).catch((err) => mostrarMsg(err.message, 'danger'));
}

desenharCarrinho();
buscarPeca(); // lista todas as peças de início
