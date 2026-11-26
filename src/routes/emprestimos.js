const router = require('express').Router();
const pool = require('../db');
const { erro, hoje, dataValida } = require('../utils');

// Situação calculada na consulta (regra 3): atrasado = ativo com prazo vencido
const SITUACAO = `
  CASE WHEN e.status = 'devolvido' THEN 'devolvido'
       WHEN e.data_prevista_devolucao < CURRENT_DATE THEN 'atrasado'
       ELSE 'ativo' END AS situacao`;

const LISTA = `
  SELECT e.*, ${SITUACAO},
         s.nome AS solicitante, s.matricula, s.telefone, s.email,
         (SELECT STRING_AGG(p.nome || ' (' || i.quantidade || ')', ', ')
          FROM itens_emprestimo i JOIN pecas p ON p.id = i.peca_id
          WHERE i.emprestimo_id = e.id) AS pecas
  FROM emprestimos e
  JOIN solicitantes s ON s.id = e.solicitante_id`;

// GET /api/emprestimos/painel  -> ativos, atrasados e devolvidos
router.get('/painel', async (req, res) => {
  const { rows } = await pool.query(`${LISTA} ORDER BY e.data_prevista_devolucao, e.id`);

  const ativos = rows.filter((e) => e.situacao === 'ativo');
  const atrasados = rows.filter((e) => e.situacao === 'atrasado');
  const devolvidos = rows
    .filter((e) => e.situacao === 'devolvido')
    .sort((a, b) => (b.data_devolucao > a.data_devolucao ? 1 : -1))
    .slice(0, 30); // só os 30 mais recentes

  res.json({
    ativos,
    atrasados,
    devolvidos,
    contagem: {
      ativos: ativos.length,
      atrasados: atrasados.length,
      devolvidos: rows.length - ativos.length - atrasados.length,
    },
  });
});

// GET /api/emprestimos/atrasados  (com telefone e e-mail, para o alerta)
router.get('/atrasados', async (req, res) => {
  const { rows } = await pool.query(
    `${LISTA}
     WHERE e.status = 'ativo' AND e.data_prevista_devolucao < CURRENT_DATE
     ORDER BY e.data_prevista_devolucao`
  );
  res.json(rows);
});

// GET /api/emprestimos/:id  (detalhe com itens)
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, ${SITUACAO},
            s.nome AS solicitante, s.matricula, s.telefone, s.email, s.tipo,
            u.nome AS monitor
     FROM emprestimos e
     JOIN solicitantes s ON s.id = e.solicitante_id
     JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw erro(404, 'Empréstimo não encontrado');

  const itens = await pool.query(
    `SELECT i.peca_id, i.quantidade, p.nome, p.categoria
     FROM itens_emprestimo i JOIN pecas p ON p.id = i.peca_id
     WHERE i.emprestimo_id = $1 ORDER BY p.nome`,
    [req.params.id]
  );
  res.json({ ...rows[0], itens: itens.rows });
});

// POST /api/emprestimos  -> confirma o carrinho
// { solicitante_id, data_prevista_devolucao, observacao, itens: [{ peca_id, quantidade }] }
router.post('/', async (req, res) => {
  const { solicitante_id, data_prevista_devolucao, observacao } = req.body;
  const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens : [];

  if (!solicitante_id) throw erro(400, 'Escolha o solicitante');
  if (!dataValida(data_prevista_devolucao)) throw erro(400, 'Data de devolução inválida');
  if (data_prevista_devolucao < hoje()) throw erro(400, 'A data de devolução não pode ser no passado');
  if (itensRecebidos.length === 0) throw erro(400, 'Adicione pelo menos uma peça ao carrinho');

  // Junta peças repetidas do carrinho em um item só
  const itens = {};
  for (const item of itensRecebidos) {
    const qtd = Number(item.quantidade);
    if (!Number.isInteger(qtd) || qtd <= 0) throw erro(400, 'Quantidade inválida no carrinho');
    itens[item.peca_id] = (itens[item.peca_id] || 0) + qtd;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Regra 1 (RF09): solicitante bloqueado ou com atraso não pode pegar
    const sol = await client.query(
      `SELECT s.nome, s.bloqueado,
         EXISTS (SELECT 1 FROM emprestimos e WHERE e.solicitante_id = s.id
                 AND e.status = 'ativo' AND e.data_prevista_devolucao < CURRENT_DATE) AS atrasado
       FROM solicitantes s WHERE s.id = $1`,
      [solicitante_id]
    );
    if (!sol.rows[0]) throw erro(404, 'Solicitante não encontrado');
    if (sol.rows[0].bloqueado) throw erro(400, `${sol.rows[0].nome} está bloqueado(a) para empréstimos`);
    if (sol.rows[0].atrasado) throw erro(400, `${sol.rows[0].nome} tem devolução atrasada`);

    const novo = await client.query(
      `INSERT INTO emprestimos (solicitante_id, usuario_id, data_prevista_devolucao, observacao)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [solicitante_id, req.usuario.id, data_prevista_devolucao, observacao?.trim() || null]
    );
    const emprestimoId = novo.rows[0].id;

    // Regra 2 (RF07/RF08): baixa o estoque só se houver quantidade
    for (const [pecaId, qtd] of Object.entries(itens)) {
      const baixa = await client.query(
        `UPDATE pecas SET quantidade_disponivel = quantidade_disponivel - $1
         WHERE id = $2 AND quantidade_disponivel >= $1 RETURNING id`,
        [qtd, pecaId]
      );
      if (baixa.rowCount === 0) {
        const p = await client.query('SELECT nome, quantidade_disponivel FROM pecas WHERE id = $1', [pecaId]);
        if (!p.rows[0]) throw erro(404, 'Peça não encontrada');
        throw erro(400, `Quantidade indisponível de "${p.rows[0].nome}" (disponível: ${p.rows[0].quantidade_disponivel})`);
      }
      await client.query(
        'INSERT INTO itens_emprestimo (emprestimo_id, peca_id, quantidade) VALUES ($1, $2, $3)',
        [emprestimoId, pecaId, qtd]
      );
    }

    await client.query('COMMIT'); // grava tudo
    res.status(201).json({ id: emprestimoId, mensagem: 'Empréstimo registrado' });
  } catch (e) {
    await client.query('ROLLBACK'); // ou nada
    throw e;
  } finally {
    client.release();
  }
});

// PATCH /api/emprestimos/:id/devolver  -> peças voltam ao estoque (RF10)
router.patch('/:id/devolver', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE emprestimos SET status = 'devolvido', data_devolucao = CURRENT_DATE
       WHERE id = $1 AND status = 'ativo'`,
      [req.params.id]
    );
    if (rowCount === 0) throw erro(400, 'Empréstimo não encontrado ou já devolvido');

    await client.query(
      `UPDATE pecas p SET quantidade_disponivel = p.quantidade_disponivel + i.quantidade
       FROM itens_emprestimo i
       WHERE i.peca_id = p.id AND i.emprestimo_id = $1`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ mensagem: 'Devolução registrada' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// PATCH /api/emprestimos/:id/renovar  { nova_data }  (RF11)
router.patch('/:id/renovar', async (req, res) => {
  const { nova_data } = req.body;
  if (!dataValida(nova_data)) throw erro(400, 'Nova data inválida');
  if (nova_data < hoje()) throw erro(400, 'A nova data não pode ser no passado');

  const { rows } = await pool.query(
    `UPDATE emprestimos
     SET data_prevista_devolucao = $1, renovacoes = renovacoes + 1
     WHERE id = $2 AND status = 'ativo' AND data_prevista_devolucao < $1
     RETURNING *`,
    [nova_data, req.params.id]
  );
  if (!rows[0]) throw erro(400, 'Não foi possível renovar: empréstimo já devolvido ou a nova data não é posterior à atual');
  res.json({ mensagem: 'Empréstimo renovado', emprestimo: rows[0] });
});

module.exports = router;
