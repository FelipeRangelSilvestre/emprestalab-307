iniciarPagina('pecas.html');

const modalForm = new bootstrap.Modal('#modalForm');
let lista = [];

async function carregar() {
  try {
    const busca = encodeURIComponent(document.getElementById('busca').value);
    lista = await api('/pecas?busca=' + busca);
    desenhar();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

function desenhar() {
  const tabela = document.getElementById('tabela');
  if (lista.length === 0) {
    tabela.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma peça encontrada.</td></tr>';
    return;
  }
  tabela.innerHTML = lista.map((p) => {
    const cor = p.quantidade_disponivel === 0 ? 'danger' : 'success';
    return `
      <tr>
        <td>${esc(p.nome)}</td>
        <td>${esc(p.categoria)}</td>
        <td class="small text-muted">${esc(p.descricao || '')}</td>
        <td class="text-center">${p.quantidade_total}</td>
        <td class="text-center"><span class="badge text-bg-${cor}">${p.quantidade_disponivel}</span></td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirForm(${p.id})">Editar</button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluir(${p.id})">Excluir</button>
        </td>
      </tr>`;
  }).join('');

  // Sugestões de categoria no formulário
  const categorias = [...new Set(lista.map((p) => p.categoria))];
  document.getElementById('categorias').innerHTML = categorias.map((c) => `<option value="${esc(c)}">`).join('');
}

function abrirForm(id) {
  const p = lista.find((x) => x.id === id) || {};
  document.getElementById('tituloForm').textContent = id ? 'Editar peça' : 'Nova peça';
  document.getElementById('id').value = p.id || '';
  document.getElementById('nome').value = p.nome || '';
  document.getElementById('categoria').value = p.categoria || '';
  document.getElementById('descricao').value = p.descricao || '';
  document.getElementById('quantidade_total').value = p.quantidade_total ?? 1;

  // Na edição, o total não pode ser menor que o que está emprestado
  const emprestadas = id ? p.quantidade_total - p.quantidade_disponivel : 0;
  document.getElementById('quantidade_total').min = emprestadas;
  document.getElementById('infoEmprestadas').textContent =
    emprestadas ? `${emprestadas} unidade(s) emprestada(s) no momento.` : '';
  modalForm.show();
}

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('id').value;
  const dados = {
    nome: document.getElementById('nome').value,
    categoria: document.getElementById('categoria').value,
    descricao: document.getElementById('descricao').value,
    quantidade_total: Number(document.getElementById('quantidade_total').value),
  };
  try {
    if (id) await api('/pecas/' + id, 'PUT', dados);
    else await api('/pecas', 'POST', dados);
    modalForm.hide();
    mostrarMsg('Peça salva');
    carregar();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
});

async function excluir(id) {
  const p = lista.find((x) => x.id === id);
  if (!confirm(`Excluir a peça "${p.nome}"?`)) return;
  try {
    await api('/pecas/' + id, 'DELETE');
    mostrarMsg('Peça excluída');
    carregar();
  } catch (err) {
    mostrarMsg(err.message, 'danger');
  }
}

let espera;
document.getElementById('busca').addEventListener('input', () => {
  clearTimeout(espera);
  espera = setTimeout(carregar, 300);
});

carregar();
