// Cria as tabelas e insere dados de exemplo.
// Uso: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Tabelas criadas.');

  // Usuários: 1 admin e 1 monitor (senha de ambos: 123456)
  const hash = await bcrypt.hash('123456', 10);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES
     ('Administrador', 'admin@lab307.com', $1, 'admin'),
     ('Monitor Teste', 'monitor@lab307.com', $1, 'monitor')`,
    [hash]
  );

  await pool.query(`
    INSERT INTO solicitantes (nome, matricula, telefone, email, tipo) VALUES
    ('Ana Souza',        '22150001', '(92) 99111-1111', 'ana@ufam.edu.br',    'aluno'),
    ('Bruno Lima',       '22150002', '(92) 99222-2222', 'bruno@ufam.edu.br',  'aluno'),
    ('Carla Mendes',     '21150003', '(92) 99333-3333', 'carla@ufam.edu.br',  'aluno'),
    ('Prof. Daniel Reis','P0001',    '(92) 99444-4444', 'daniel@ufam.edu.br', 'professor')
  `);

  await pool.query(`
    INSERT INTO pecas (nome, categoria, descricao, quantidade_total, quantidade_disponivel) VALUES
    ('Raspberry Pi 4',        'Placas',       '4 GB de RAM',             5,  5),
    ('Arduino Uno',           'Placas',       'Com cabo USB',            10, 10),
    ('Sensor ultrassônico',   'Sensores',     'HC-SR04',                 8,  8),
    ('Sensor de temperatura', 'Sensores',     'DHT11',                   6,  6),
    ('Protoboard 830 furos',  'Componentes',  NULL,                      12, 12),
    ('Kit jumpers',           'Componentes',  '40 macho-macho',          15, 15)
  `);

  // Empréstimos de exemplo: 1 ativo, 1 atrasado e 1 devolvido
  await pool.query(`
    INSERT INTO emprestimos (solicitante_id, usuario_id, data_emprestimo, data_prevista_devolucao, data_devolucao, status) VALUES
    (1, 2, CURRENT_DATE - 2,  CURRENT_DATE + 5, NULL,             'ativo'),
    (2, 2, CURRENT_DATE - 10, CURRENT_DATE - 3, NULL,             'ativo'),
    (3, 2, CURRENT_DATE - 20, CURRENT_DATE - 13, CURRENT_DATE - 14, 'devolvido')
  `);
  await pool.query(`
    INSERT INTO itens_emprestimo (emprestimo_id, peca_id, quantidade) VALUES
    (1, 1, 1), (1, 5, 2),
    (2, 2, 2), (2, 3, 1),
    (3, 4, 1)
  `);
  // Baixa o estoque dos empréstimos ainda ativos
  await pool.query(`
    UPDATE pecas p
    SET quantidade_disponivel = p.quantidade_total - t.qtd
    FROM (
      SELECT i.peca_id, SUM(i.quantidade) AS qtd
      FROM itens_emprestimo i
      JOIN emprestimos e ON e.id = i.emprestimo_id
      WHERE e.status = 'ativo'
      GROUP BY i.peca_id
    ) t
    WHERE p.id = t.peca_id
  `);

  console.log('Dados de exemplo inseridos.');
  console.log('Login: admin@lab307.com / 123456  ou  monitor@lab307.com / 123456');
  await pool.end();
}

init().catch((err) => {
  console.error('Erro ao iniciar o banco:', err.message);
  process.exit(1);
});
