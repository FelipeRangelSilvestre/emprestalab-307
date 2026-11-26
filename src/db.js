const { Pool, types } = require('pg');

// Faz o pg devolver colunas DATE como texto 'AAAA-MM-DD'
// (evita a data "voltar um dia" por causa do fuso horário)
types.setTypeParser(1082, (valor) => valor);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
