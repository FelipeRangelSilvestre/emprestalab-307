const router = require('express').Router();
const pool = require('../db');
const { erro, emailValido } = require('../utils');

// Valida e limpa os dados vindos do formulário
function validar(body) {
  const dados = {
    nome: body.nome?.trim(),
    matricula: body.matricula?.trim(),
    telefone: body.telefone?.trim() || null,
    email: body.email?.trim().toLowerCase() || null,
    tipo: body.tipo,
  };
  if (!dados.nome) throw erro(400, 'Informe o nome');
  if (!dados.matricula) throw erro(400, 'Informe a matrícula');
  if (!['aluno', 'professor'].includes(dados.tipo)) throw erro(400, 'Tipo deve ser aluno ou professor');
  if (dados.email && !emailValido(dados.email)) throw erro(400, 'E-mail inválido');
  if (!dados.telefone && !dados.email) throw erro(400, 'Informe telefone ou e-mail para contato');
  return dados;
}

// GET /api/solicitantes?busca=   (busca por nome ou matrícula)
router.get('/', async (req, res) => {
  const busca = `%${req.query.busca || ''}%`;
  const { rows } = await pool.query(
    `SELECT s.*,
       EXISTS (SELECT 1 FROM emprestimos e
               WHERE e.solicitante_id = s.id AND e.status = 'ativo'
                 AND e.data_prevista_devolucao < CURRENT_DATE) AS atrasado
     FROM solicitantes s
     WHERE s.nome ILIKE $1 OR s.matricula ILIKE $1
     ORDER BY s.nome`,
    [busca]
  );
  res.json(rows);
});

// GET /api/solicitantes/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*,
       EXISTS (SELECT 1 FROM emprestimos e
               WHERE e.solicitante_id = s.id AND e.status = 'ativo'
                 AND e.data_prevista_devolucao < CURRENT_DATE) AS atrasado
     FROM solicitantes s WHERE s.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw erro(404, 'Solicitante não encontrado');
  res.json(rows[0]);
});

// POST /api/solicitantes
router.post('/', async (req, res) => {
  const d = validar(req.body);
  const { rows } = await pool.query(
    `INSERT INTO solicitantes (nome, matricula, telefone, email, tipo)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [d.nome, d.matricula, d.telefone, d.email, d.tipo]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/solicitantes/:id
router.put('/:id', async (req, res) => {
  const d = validar(req.body);
  const { rows } = await pool.query(
    `UPDATE solicitantes SET nome = $1, matricula = $2, telefone = $3, email = $4, tipo = $5
     WHERE id = $6 RETURNING *`,
    [d.nome, d.matricula, d.telefone, d.email, d.tipo, req.params.id]
  );
  if (!rows[0]) throw erro(404, 'Solicitante não encontrado');
  res.json(rows[0]);
});

// DELETE /api/solicitantes/:id  (só se não tiver empréstimo ativo)
router.delete('/:id', async (req, res) => {
  const ativos = await pool.query(
    "SELECT 1 FROM emprestimos WHERE solicitante_id = $1 AND status = 'ativo'",
    [req.params.id]
  );
  if (ativos.rowCount > 0) throw erro(400, 'Este solicitante tem empréstimo ativo e não pode ser excluído');

  const { rowCount } = await pool.query('DELETE FROM solicitantes WHERE id = $1', [req.params.id]);
  if (!rowCount) throw erro(404, 'Solicitante não encontrado');
  res.json({ mensagem: 'Solicitante excluído' });
});

// PATCH /api/solicitantes/:id/bloqueio  { bloqueado: true | false }
router.patch('/:id/bloqueio', async (req, res) => {
  const bloqueado = req.body.bloqueado === true;
  const { rows } = await pool.query(
    'UPDATE solicitantes SET bloqueado = $1 WHERE id = $2 RETURNING *',
    [bloqueado, req.params.id]
  );
  if (!rows[0]) throw erro(404, 'Solicitante não encontrado');
  res.json(rows[0]);
});

// GET /api/solicitantes/:id/emprestimos  (histórico)
router.get('/:id/emprestimos', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.data_emprestimo, e.data_prevista_devolucao, e.data_devolucao, e.renovacoes,
       CASE WHEN e.status = 'devolvido' THEN 'devolvido'
            WHEN e.data_prevista_devolucao < CURRENT_DATE THEN 'atrasado'
            ELSE 'ativo' END AS situacao,
       STRING_AGG(p.nome || ' (' || i.quantidade || ')', ', ') AS pecas
     FROM emprestimos e
     JOIN itens_emprestimo i ON i.emprestimo_id = e.id
     JOIN pecas p ON p.id = i.peca_id
     WHERE e.solicitante_id = $1
     GROUP BY e.id
     ORDER BY e.data_emprestimo DESC, e.id DESC`,
    [req.params.id]
  );
  res.json(rows);
});

module.exports = router;
