const jwt = require('jsonwebtoken');

// Exige token JWT válido no cabeçalho: Authorization: Bearer <token>
function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.replace('Bearer ', '');

  if (!token) return res.status(401).json({ erro: 'Faça login para continuar' });

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Sessão expirada, faça login novamente' });
  }
}

// Só deixa passar quem tem perfil admin
function somenteAdmin(req, res, next) {
  if (req.usuario.perfil !== 'admin') {
    return res.status(403).json({ erro: 'Apenas o administrador pode fazer isso' });
  }
  next();
}

module.exports = { autenticar, somenteAdmin };
