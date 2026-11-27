iniciarPagina('');

const parametros = new URLSearchParams(location.search);
const id = parametros.get('id');
if (parametros.get('novo')) mostrarMsg('Empréstimo registrado com sucesso');

async function carregar() {
  const conteudo = document.getElementById('conteudo');
  try {
    const e = await api('/emprestimos/' + id);
    const aberto = e.status === 'ativo';

    conteudo.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h4 mb-0">Empréstimo #${e.id} ${badgeSituacao(e.situacao)}</h1>
      </div>

      <div class="row g-3">
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-body">
              <h2 class="h6">Solicitante</h2>
              <p class="mb-1"><strong>${esc(e.solicitante)}</strong> (${esc(e.tipo)})</p>
              <p class="mb-1 small">Matrícula: ${esc(e.matricula)}</p>
              <p class="mb-1 small">📞 ${esc(e.telefone || '-')}</p>
              <p class="mb-0 small">✉️ ${esc(e.email || '-')}</p>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-body small">
              <h2 class="h6">Datas</h2>
              <p class="mb-1">Emprestado em: ${dataBR(e.data_emprestimo)} por ${esc(e.monitor)}</p>
              <p class="mb-1 ${e.situacao === 'atrasado' ? 'text-danger fw-bold' : ''}">
                Devolver até: ${dataBR(e.data_prevista_devolucao)}
                ${e.situacao === 'atrasado' ? ` (atrasado ${diasDesde(e.data_prevista_devolucao)} dia(s))` : ''}
              </p>
              <p class="mb-1">Renovações: ${e.renovacoes}</p>
              <p class="mb-1">Devolvido em: ${dataBR(e.data_devolucao)}</p>
              ${e.observacao ? `<p class="mb-0">Obs.: ${esc(e.observacao)}</p>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-body">
          <h2 class="h6">Itens</h2>
          <table class="table table-sm mb-0">
            <thead><tr><th>Peça</th><th>Categoria</th><th class="text-center">Quantidade</th></tr></thead>
            <tbody>
              ${e.itens.map((i) => `
                <tr><td>${esc(i.nome)}</td><td>${esc(i.categoria)}</td><td class="text-center">${i.quantidade}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${aberto ? `
      <div class="card mt-3">
        <div class="card-body d-flex flex-wrap gap-3 align-items-end">
          <button class="btn btn-success" onclick="devolver()">Registrar devolução</button>
          <div class="ms-md-auto">
            <label class="form-label small mb-1" for="novaData">Renovar até</label>
            <div class="input-group">
              <input type="date" id="novaData" class="form-control">
              <button class="btn btn-outline-primary" onclick="renovar()">Renovar</button>
            </div>
          </div>
        </div>
      </div>` : ''}
    `;

    if (aberto) {
      // A nova data precisa ser depois do prazo atual e não pode ser no passado
      const minimo = e.data_prevista_devolucao >= dataISO(0) ? proximoDia(e.data_prevista_devolucao) : dataISO(0);
      const campo = document.getElementById('novaData');
      campo.min = minimo;
      campo.value = e.data_prevista_devolucao >= dataISO(0) ? somarDias(e.data_prevista_devolucao, 7) : dataISO(7);
    }
  } catch (err) {
    conteudo.innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
  }
}

function somarDias(data, dias) {
  const d = new Date(data + 'T00:00');
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function proximoDia(data) {
  return somarDias(data, 1);
}

async function devolver() {
  if (!confirm('Confirmar a devolução de todas as peças deste empréstimo?')) return;
  try {
    await api(`/emprestimos/${id}/devolver`, 'PATCH');
    mostrarMsg('Devolução registrada');
    carregar();
    carregarAlerta();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

async function renovar() {
  const novaData = document.getElementById('novaData').value;
  if (!novaData) return mostrarMsg('Escolha a nova data', 'warning');
  try {
    await api(`/emprestimos/${id}/renovar`, 'PATCH', { nova_data: novaData });
    mostrarMsg('Empréstimo renovado até ' + dataBR(novaData));
    carregar();
    carregarAlerta();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

carregar();
