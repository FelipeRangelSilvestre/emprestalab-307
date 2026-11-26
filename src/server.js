require('dotenv').config();
const express = require('express');
const path = require('path');
const { autenticar } = require('./middleware/auth');

const app = express();
app.use(express.json());

// Front-end (HTML, CSS e JS) servido pela pasta public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rota pública
app.use('/api/auth', require('./routes/auth'));

// Daqui pra baixo, tudo exige login
app.use('/api', autenticar);
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/solicitantes', require('./routes/solicitantes'));
app.use('/api/pecas', require('./routes/pecas'));
app.use('/api/emprestimos', require('./routes/emprestimos'));

// Tratamento de erros (o Express 5 já captura erros de funções async)
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ erro: err.message });
  if (err.code === '23505') return res.status(400).json({ erro: 'Já existe um cadastro com esse valor (matrícula ou e-mail)' });
  if (err.code === '22P02') return res.status(400).json({ erro: 'Valor inválido (verifique os IDs enviados)' });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EmprestaLab 307 rodando em http://localhost:${PORT}`));
