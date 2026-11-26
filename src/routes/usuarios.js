const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { somenteAdmin } = require('../middleware/auth');
const { erro, emailValido } = require('../utils');

router.use(somenteAdmin);

// GET /api/usuarios
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT id, nome, email, perfil FROM usuarios ORDER BY nome');
  res.json(rows);
});

// POST /api/usuarios  { nome, email, senha, perfil }
router.post('/', async (req, res) => {
  const { nome, email, senha, perfil } = req.body;

  if (!nome?.trim()) throw erro(400, 'Informe o nome');
  if (!emailValido(email)) throw erro(400, 'E-mail inválido');
  if (!senha || senha.length < 6) throw erro(400, 'A senha deve ter pelo menos 6 caracteres');
  if (!['admin', 'monitor'].includes(perfil)) throw erro(400, 'Perfil inválido');

  const hash = await bcrypt.hash(senha, 10);
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, perfil',
    [nome.trim(), email.trim().toLowerCase(), hash, perfil]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
