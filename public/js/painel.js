iniciarPagina('painel.html');

// Monta o cartão de um empréstimo
function cartao(e) {
  let detalhe = `Prazo: ${dataBR(e.data_prevista_devolucao)}`;
  if (e.situacao === 'devolvido') detalhe = `Devolvido em ${dataBR(e.data_devolucao)}`;

  // RF14: contato do solicitante nos atrasados
  let contato = '';
  if (e.situacao === 'atrasado') {
    detalhe = `<span class="text-danger fw-semibold">Venceu em ${dataBR(e.data_prevista_devolucao)} (${diasDesde(e.data_prevista_devolucao)} dia(s))</span>`;
    contato = `<div class="small mt-1">📞 ${esc(e.telefone || '-')}<br>✉️ ${esc(e.email || '-')}</div>`;
  }

  return `
    <div class="card mb-2" onclick="location.href='emprestimo.html?id=${e.id}'">
      <div class="card-body p-2">
        <div class="d-flex justify-content-between">
          <strong>${esc(e.solicitante)}</strong>
          <span class="text-muted small">#${e.id}</span>
        </div>
        <div class="small text-muted">${esc(e.matricula)}</div>
        <div class="small">${esc(e.pecas)}</div>
        <div class="small">${detalhe}</div>
        ${contato}
      </div>
    </div>`;
}

function preencher(idColuna, lista) {
  document.getElementById(idColuna).innerHTML =
    lista.length ? lista.map(cartao).join('') : '<p class="text-muted small">Nenhum empréstimo.</p>';
}

async function carregarPainel() {
  try {
    const dados = await api('/emprestimos/painel');
    document.getElementById('qtdAtivos').textContent = dados.contagem.ativos;
    document.getElementById('qtdAtrasados').textContent = dados.contagem.atrasados;
    document.getElementById('qtdDevolvidos').textContent = dados.contagem.devolvidos;
    preencher('colAtivos', dados.ativos);
    preencher('colAtrasados', dados.atrasados);
    preencher('colDevolvidos', dados.devolvidos);

    // Mostra o alerta uma vez por login
    if (dados.atrasados.length && !sessionStorage.getItem('alertaVisto')) {
      sessionStorage.setItem('alertaVisto', 'sim');
      document.getElementById('listaModalAtrasados').innerHTML = dados.atrasados.map((e) => `
        <div class="border-bottom pb-2 mb-2">
          <strong>${esc(e.solicitante)}</strong> – venceu em ${dataBR(e.data_prevista_devolucao)}<br>
          <span class="small">📞 ${esc(e.telefone || '-')} &nbsp; ✉️ ${esc(e.email || '-')}</span><br>
          <a class="small" href="emprestimo.html?id=${e.id}">Abrir empréstimo #${e.id}</a>
        </div>`).join('');
      new bootstrap.Modal('#modalAtrasados').show();
    }
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

carregarPainel();
