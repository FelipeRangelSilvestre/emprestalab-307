const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// POST /api/auth/login  { email, senha }
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha' });

  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
  const usuario = rows[0];

  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
  }

  const dados = { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil };
  const token = jwt.sign(dados, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: dados });
});

module.exports = router;
