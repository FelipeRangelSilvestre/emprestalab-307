# EmprestaLab 307

Sistema de controle de empréstimos de peças do Laboratório 307 – ICET/UFAM.
Disciplina de Programação Web – Prof. Antonio Alberto Sena dos Santos.

**Equipe:** Felipe Rangel Silvestre e Iasmim Braga Belem

## Tecnologias

- **Front-end:** HTML5, CSS3 (Bootstrap 5), JavaScript com Fetch API
- **Back-end:** Node.js + Express 5
- **Banco:** PostgreSQL (biblioteca `pg`)
- **Segurança:** bcrypt (`bcryptjs`) para senhas e JWT (`jsonwebtoken`) nas rotas

## Como rodar

Precisa ter instalado: **Node.js 18+** e **PostgreSQL**.

1. Crie o banco no PostgreSQL (pelo pgAdmin ou psql):
   ```sql
   CREATE DATABASE emprestalab;
   ```
2. Na pasta do projeto, instale as dependências:
   ```bash
   npm install
   ```
3. Copie `.env.example` para `.env` e coloque o usuário/senha do seu Postgres em `DATABASE_URL`.
4. Crie as tabelas e os dados de exemplo (**apaga os dados existentes**):
   ```bash
   npm run db:init
   ```
5. Inicie o servidor:
   ```bash
   npm start
   ```
6. Abra **http://localhost:3000**

### Logins de teste

| Perfil  | E-mail              | Senha  |
|---------|---------------------|--------|
| Admin   | admin@lab307.com    | 123456 |
| Monitor | monitor@lab307.com  | 123456 |

Os dados de exemplo já vêm com 1 empréstimo ativo, 1 atrasado e 1 devolvido, para a demonstração.

## Estrutura

```
database/
  schema.sql        tabelas (usuarios, solicitantes, pecas, emprestimos, itens_emprestimo)
  init.js           cria as tabelas e insere dados de exemplo
src/
  server.js         Express, rotas e tratamento de erros
  db.js             conexão com o PostgreSQL
  utils.js          funções de validação
  middleware/auth.js  verificação do token JWT e do perfil admin
  routes/           auth, usuarios, solicitantes, pecas, emprestimos
public/
  index.html        login
  painel.html       painel com 3 colunas + alerta de atrasados
  solicitantes.html cadastro, busca, bloqueio e histórico
  pecas.html        cadastro, busca e estoque
  novo-emprestimo.html  carrinho de empréstimo
  emprestimo.html   detalhe com Devolver e Renovar
  usuarios.html     cadastro de monitores (só admin)
  js/app.js         funções comuns (fetch com token, menu, alerta)
```

## Onde está cada requisito

| Requisito | Onde |
|-----------|------|
| RF01 Login/logout | `routes/auth.js`, `index.html`, botão Sair (`app.js`) |
| RF02 Cadastrar monitores (admin) | `routes/usuarios.js`, `usuarios.html` |
| RF03/RF04 Solicitantes + busca | `routes/solicitantes.js`, `solicitantes.html` |
| RF05/RF06 Peças + busca | `routes/pecas.js`, `pecas.html` |
| RF07 Carrinho | `POST /api/emprestimos`, `novo-emprestimo.html` |
| RF08 Não passar do disponível | transação com `UPDATE ... WHERE quantidade_disponivel >= $1` |
| RF09 Bloqueado ou atrasado | verificação no início da transação do `POST /api/emprestimos` |
| RF10 Devolução | `PATCH /api/emprestimos/:id/devolver` |
| RF11 Renovação | `PATCH /api/emprestimos/:id/renovar` |
| RF12 Aviso de prazo vencido | faixa vermelha em todas as telas + janela ao abrir o painel |
| RF13 Painel 3 colunas | `GET /api/emprestimos/painel`, `painel.html` |
| RF14 Contato dos atrasados | cartões da coluna Atrasados e janela de alerta |
| RF15 Bloquear/desbloquear | `PATCH /api/solicitantes/:id/bloqueio` |
| RF16 Histórico | `GET /api/solicitantes/:id/emprestimos` |
| RNF01 bcrypt | `routes/auth.js`, `routes/usuarios.js` |
| RNF02 JWT | `middleware/auth.js` |
| RNF03 Responsivo | Bootstrap (testado em tela de celular) |
| RNF05 Validação front e back | `required`/`min` nos formulários + `validar()` nas rotas |

## Regras de negócio

1. Antes de confirmar o carrinho, o sistema verifica se o solicitante está bloqueado ou tem atraso.
2. O estoque só baixa se houver quantidade de **todas** as peças, dentro de uma transação (`BEGIN`/`COMMIT`/`ROLLBACK`). Na devolução as quantidades voltam.
3. "Atrasado" não é gravado no banco: é calculado na consulta (`status = 'ativo' AND data_prevista_devolucao < CURRENT_DATE`).
4. Renovar troca a data prevista (tem que ser depois da atual e não pode ser no passado) e soma 1 em `renovacoes`.

Outras proteções: não exclui peça emprestada nem solicitante com empréstimo ativo, e não deixa o total de uma peça ficar menor que a quantidade emprestada.

## Observação

O Bootstrap é carregado por CDN, então o computador precisa de internet para o visual aparecer.
