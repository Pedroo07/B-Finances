# B Finance

<p align="center">
  <img src="./public/Logo.png" alt="Logo do B Finance" width="110" />
</p>

<p align="center">
  <strong>Controle financeiro pessoal, simples de usar e completo para o dia a dia.</strong>
</p>

O **B Finance** é uma aplicação web de gestão financeira pessoal já disponível em produção. Ela reúne receitas, despesas, cartões, contas a pagar e investimentos em uma experiência visual pensada para transformar informações dispersas em decisões financeiras mais claras.

## A experiência para quem usa

O fluxo foi desenhado para ser direto: crie sua conta, registre sua movimentação e acompanhe a evolução da sua vida financeira em um único lugar.

### Visão geral do mês

No painel inicial, o usuário encontra o saldo, receitas, despesas, indicadores de evolução e gráficos para entender rapidamente como o mês está se comportando.

### Receitas e despesas organizadas

Cada movimentação pode receber categoria, data e forma de pagamento. O histórico facilita a consulta de gastos e ganhos, enquanto os filtros ajudam a encontrar o que importa sem esforço.

### Cartões de crédito e faturas

O B Finance permite cadastrar cartões, definir dias de fechamento e vencimento, registrar compras e acompanhar faturas. O pagamento da fatura é refletido no controle financeiro para evitar duplicidade de informação.

### Contas a pagar que acompanham a rotina

Além de contas únicas e parceladas, o sistema oferece contas fixas mensais. Ao criar uma conta recorrente, os próximos lançamentos são preparados automaticamente no mesmo dia de vencimento.

Se uma conta fixa deixar de existir, o usuário pode escolher entre:

- remover **apenas aquele mês**, mantendo os demais lançamentos;
- remover **todos os meses**, encerrando a recorrência por completo.

O sistema também trata meses curtos de forma natural: uma conta programada para o dia 31 vence no último dia de fevereiro e volta ao dia 31 no mês seguinte.

### Investimentos e projeção financeira

Os investimentos ficam registrados junto às demais informações financeiras. A aplicação combina as movimentações e as contas pendentes para mostrar uma projeção do saldo mensal.

### Assistente pelo WhatsApp

Quando integrado, o assistente conversa pelo WhatsApp para registrar operações, responder consultas financeiras e orientar o usuário a partir dos dados cadastrados.

## O que este projeto demonstra

Este repositório representa o desenvolvimento de uma aplicação completa, com foco tanto em experiência do usuário quanto em regras de negócio reais.

| Entrega           | O que foi construído                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Produto           | Uma plataforma de finanças pessoais com autenticação e dados isolados por usuário.                                                |
| Interface         | Telas responsivas, temas claro e escuro, componentes reutilizáveis e navegação entre módulos financeiros.                         |
| Regras de negócio | Controle de faturas, compras no cartão, pagamentos, parcelamentos, projeções e recorrências mensais com exceções por competência. |
| Dados             | Persistência no Firebase, com modelagem separada para transações, cartões, investimentos e contas a pagar.                        |
| Integrações       | Webhook do WhatsApp Cloud API e recursos de IA com Gemini para uma interface conversacional.                                      |
| Qualidade         | Tipagem com TypeScript, validações, formatação consistente e testes automatizados para regras críticas.                           |

## Decisões técnicas em destaque

- **Recorrência mensal com controle por competência:** contas fixas são modeladas como uma série e seus lançamentos mensais são independentes. Isso permite excluir um único mês sem interromper a recorrência ou encerrá-la inteiramente quando necessário.
- **Faturas sem duplicidade:** pagamentos de cartão e contas relacionadas utilizam vínculos entre registros para preservar a consistência dos dados financeiros.
- **Separação entre interface e domínio:** os serviços concentram a comunicação com Firebase e as regras de negócio, enquanto as telas se concentram na experiência de uso.
- **Preparado para uso real:** autenticação, armazenamento por usuário, formulários validados e tratamento de estados de carregamento fazem parte do produto.

## Tecnologias utilizadas

- **Next.js** e **React** para a aplicação web
- **TypeScript** para segurança de tipos e manutenção
- **Tailwind CSS** e **Radix UI** para a interface
- **Firebase** para autenticação, banco de dados e armazenamento
- **Firebase Admin** para operações no servidor
- **Gemini API** e **WhatsApp Cloud API** para a experiência conversacional

## Privacidade e segurança

Os dados financeiros são vinculados ao usuário autenticado. Informações sensíveis, tokens e credenciais não fazem parte do repositório público. A aplicação foi estruturada para que cada pessoa trabalhe com o próprio conjunto de dados.

---

**B Finance** — menos planilhas, mais clareza sobre o próprio dinheiro.
