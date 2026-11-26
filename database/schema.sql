-- EmprestaLab 307 - Esquema do banco (PostgreSQL)
-- ATENÇÃO: apaga as tabelas antes de criar de novo.

DROP TABLE IF EXISTS itens_emprestimo, emprestimos, pecas, solicitantes, usuarios CASCADE;

-- Monitores que usam o sistema
CREATE TABLE usuarios (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  email      VARCHAR(100) NOT NULL UNIQUE,
  senha_hash VARCHAR(100) NOT NULL,
  perfil     VARCHAR(10)  NOT NULL DEFAULT 'monitor' CHECK (perfil IN ('admin', 'monitor'))
);

-- Alunos e professores atendidos no balcão
CREATE TABLE solicitantes (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(100) NOT NULL,
  matricula VARCHAR(20)  NOT NULL UNIQUE,
  telefone  VARCHAR(20),
  email     VARCHAR(100),
  tipo      VARCHAR(10)  NOT NULL CHECK (tipo IN ('aluno', 'professor')),
  bloqueado BOOLEAN      NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Peças controladas por quantidade
CREATE TABLE pecas (
  id                    SERIAL PRIMARY KEY,
  nome                  VARCHAR(100) NOT NULL,
  categoria             VARCHAR(50)  NOT NULL,
  descricao             TEXT,
  quantidade_total      INT NOT NULL CHECK (quantidade_total >= 0),
  quantidade_disponivel INT NOT NULL CHECK (quantidade_disponivel >= 0),
  CHECK (quantidade_disponivel <= quantidade_total)
);

-- Cabeçalho do empréstimo
CREATE TABLE emprestimos (
  id                      SERIAL PRIMARY KEY,
  solicitante_id          INT  NOT NULL REFERENCES solicitantes(id) ON DELETE CASCADE,
  usuario_id              INT  NOT NULL REFERENCES usuarios(id),
  data_emprestimo         DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_devolucao DATE NOT NULL,
  data_devolucao          DATE,
  renovacoes              INT  NOT NULL DEFAULT 0,
  status                  VARCHAR(10) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'devolvido')),
  observacao              TEXT
);

-- Itens do carrinho (peça + quantidade)
CREATE TABLE itens_emprestimo (
  id            SERIAL PRIMARY KEY,
  emprestimo_id INT NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  peca_id       INT NOT NULL REFERENCES pecas(id) ON DELETE CASCADE,
  quantidade    INT NOT NULL CHECK (quantidade > 0)
);
