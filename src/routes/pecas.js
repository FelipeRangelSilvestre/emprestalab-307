const router = require('express').Router();
const pool = require('../db');
const { erro } = require('../utils');

function validar(body) {
  const dados = {
    nome: body.nome?.trim(),
    categoria: body.categoria?.trim(),
    descricao: body.descricao?.trim() || null,
    quantidade_total: Number(body.quantidade_total),
  };
  if (!dados.nome) throw erro(400, 'Informe o nome da peça');
  if (!dados.categoria) throw erro(400, 'Informe a categoria');
  if (!Number.isInteger(dados.quantidade_total) || dados.quantidade_total < 0) {
    throw erro(400, 'Quantidade total deve ser um número inteiro maior ou igual a zero');
  }
  return dados;
}

// GET /api/pecas?busca=   (busca por nome ou categoria)
router.get('/', async (req, res) => {
  const busca = `%${req.query.busca || ''}%`;
  const { rows } = await pool.query(
    `SELECT * FROM pecas
     WHERE nome ILIKE $1 OR categoria ILIKE $1
     ORDER BY categoria, nome`,
    [busca]
  );
  res.json(rows);
});

// GET /api/pecas/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM pecas WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw erro(404, 'Peça não encontrada');
  res.json(rows[0]);
});

// POST /api/pecas  (disponível começa igual ao total)
router.post('/', async (req, res) => {
  const d = validar(req.body);
  const { rows } = await pool.query(
    `INSERT INTO pecas (nome, categoria, descricao, quantidade_total, quantidade_disponivel)
     VALUES ($1, $2, $3, $4, $4) RETURNING *`,
    [d.nome, d.categoria, d.descricao, d.quantidade_total]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/pecas/:id
// Se o total mudar, o disponível muda na mesma diferença.
// Não deixa o total ficar menor que o que está emprestado.
router.put('/:id', async (req, res) => {
  const d = validar(req.body);
  const atual = await pool.query('SELECT * FROM pecas WHERE id = $1', [req.params.id]);
  const peca = atual.rows[0];
  if (!peca) throw erro(404, 'Peça não encontrada');

  const emprestadas = peca.quantidade_total - peca.quantidade_disponivel;
  if (d.quantidade_total < emprestadas) {
    throw erro(400, `Há ${emprestadas} unidade(s) emprestada(s). O total não pode ser menor que isso.`);
  }

  const { rows } = await pool.query(
    `UPDATE pecas SET nome = $1, categoria = $2, descricao = $3,
       quantidade_total = $4, quantidade_disponivel = $5
     WHERE id = $6 RETURNING *`,
    [d.nome, d.categoria, d.descricao, d.quantidade_total, d.quantidade_total - emprestadas, req.params.id]
  );
  res.json(rows[0]);
});

// DELETE /api/pecas/:id  (só se não estiver emprestada)
router.delete('/:id', async (req, res) => {
  const emUso = await pool.query(
    `SELECT 1 FROM itens_emprestimo i
     JOIN emprestimos e ON e.id = i.emprestimo_id
     WHERE i.peca_id = $1 AND e.status = 'ativo'`,
    [req.params.id]
  );
  if (emUso.rowCount > 0) throw erro(400, 'Esta peça está emprestada e não pode ser excluída');

  const { rowCount } = await pool.query('DELETE FROM pecas WHERE id = $1', [req.params.id]);
  if (!rowCount) throw erro(404, 'Peça não encontrada');
  res.json({ mensagem: 'Peça excluída' });
});

module.exports = router;
