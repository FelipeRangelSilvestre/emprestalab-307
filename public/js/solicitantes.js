iniciarPagina('solicitantes.html');

const modalForm = new bootstrap.Modal('#modalForm');
const modalHistorico = new bootstrap.Modal('#modalHistorico');
let lista = [];

async function carregar() {
  try {
    const busca = encodeURIComponent(document.getElementById('busca').value);
    lista = await api('/solicitantes?busca=' + busca);
    desenhar();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

function desenhar() {
  const tabela = document.getElementById('tabela');
  if (lista.length === 0) {
    tabela.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum solicitante encontrado.</td></tr>';
    return;
  }
  tabela.innerHTML = lista.map((s) => {
    let situacao = '<span class="badge text-bg-success">Liberado</span>';
    if (s.atrasado) situacao = '<span class="badge text-bg-warning">Com atraso</span>';
    if (s.bloqueado) situacao = '<span class="badge text-bg-danger">Bloqueado</span>';

    return `
      <tr>
        <td>${esc(s.nome)}</td>
        <td>${esc(s.matricula)}</td>
        <td class="text-capitalize">${esc(s.tipo)}</td>
        <td class="small">${esc(s.telefone || '')}<br>${esc(s.email || '')}</td>
        <td>${situacao}</td>
        <td class="text-end text-nowrap">
          <a class="btn btn-sm btn-outline-dark" href="novo-emprestimo.html?solicitante=${s.id}" title="Novo empréstimo">Emprestar</a>
          <button class="btn btn-sm btn-outline-secondary" onclick="verHistorico(${s.id})">Histórico</button>
          <button class="btn btn-sm btn-outline-primary" onclick="abrirForm(${s.id})">Editar</button>
          <button class="btn btn-sm btn-outline-warning" onclick="alternarBloqueio(${s.id})">${s.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluir(${s.id})">Excluir</button>
        </td>
      </tr>`;
  }).join('');
}

function abrirForm(id) {
  const s = lista.find((x) => x.id === id) || {};
  document.getElementById('tituloForm').textContent = id ? 'Editar solicitante' : 'Novo solicitante';
  document.getElementById('id').value = s.id || '';
  document.getElementById('nome').value = s.nome || '';
  document.getElementById('matricula').value = s.matricula || '';
  document.getElementById('tipo').value = s.tipo || 'aluno';
  document.getElementById('telefone').value = s.telefone || '';
  document.getElementById('email').value = s.email || '';
  modalForm.show();
}

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('id').value;
  const dados = {
    nome: document.getElementById('nome').value,
    matricula: document.getElementById('matricula').value,
    tipo: document.getElementById('tipo').value,
    telefone: document.getElementById('telefone').value,
    email: document.getElementById('email').value,
  };
  if (!dados.telefone.trim() && !dados.email.trim()) {
    mostrarMsg('Informe telefone ou e-mail', 'warning');
    return;
  }
  try {
    if (id) await api('/solicitantes/' + id, 'PUT', dados);
    else await api('/solicitantes', 'POST', dados);
    modalForm.hide();
    mostrarMsg('Solicitante salvo');
    carregar();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
});

async function alternarBloqueio(id) {
  const s = lista.find((x) => x.id === id);
  try {
    await api(`/solicitantes/${id}/bloqueio`, 'PATCH', { bloqueado: !s.bloqueado });
    mostrarMsg(s.bloqueado ? 'Solicitante desbloqueado' : 'Solicitante bloqueado');
    carregar();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

async function excluir(id) {
  const s = lista.find((x) => x.id === id);
  if (!confirm(`Excluir ${s.nome}? O histórico dele também será apagado.`)) return;
  try {
    await api('/solicitantes/' + id, 'DELETE');
    mostrarMsg('Solicitante excluído');
    carregar();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

async function verHistorico(id) {
  const s = lista.find((x) => x.id === id);
  document.getElementById('tituloHistorico').textContent = 'Histórico de ' + s.nome;
  const corpo = document.getElementById('corpoHistorico');
  corpo.innerHTML = 'Carregando...';
  modalHistorico.show();
  try {
    const historico = await api(`/solicitantes/${id}/emprestimos`);
    if (historico.length === 0) {
      corpo.innerHTML = '<p class="text-muted">Nenhum empréstimo ainda.</p>';
      return;
    }
    corpo.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm">
          <thead><tr><th>#</th><th>Peças</th><th>Emprestado</th><th>Prazo</th><th>Devolvido</th><th>Situação</th></tr></thead>
          <tbody>
            ${historico.map((h) => `
              <tr>
                <td><a href="emprestimo.html?id=${h.id}">${h.id}</a></td>
                <td>${esc(h.pecas)}</td>
                <td>${dataBR(h.data_emprestimo)}</td>
                <td>${dataBR(h.data_prevista_devolucao)}${h.renovacoes ? ` <span class="small text-muted">(${h.renovacoes} renov.)</span>` : ''}</td>
                <td>${dataBR(h.data_devolucao)}</td>
                <td>${badgeSituacao(h.situacao)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    corpo.innerHTML = `<p class="text-danger">${esc(err.message)}</p>`;
  }
}

// Busca enquanto digita (espera 300 ms depois da última tecla)
let espera;
document.getElementById('busca').addEventListener('input', () => {
  clearTimeout(espera);
  espera = setTimeout(carregar, 300);
});

carregar();
