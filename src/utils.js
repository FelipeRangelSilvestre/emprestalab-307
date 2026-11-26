// Cria um erro com status HTTP (tratado no server.js)
function erro(status, mensagem) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

// Data de hoje no formato AAAA-MM-DD (horário local do servidor)
function hoje() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function dataValida(texto) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto || '') && !isNaN(new Date(texto));
}

function emailValido(texto) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto || '');
}

module.exports = { erro, hoje, dataValida, emailValido };
