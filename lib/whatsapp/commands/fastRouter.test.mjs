import assert from "node:assert/strict";
import test from "node:test";
import { resolveFastRoute } from "./fastRouter.ts";

test("fastRouter: responde ao comando ping com tempo de processamento", () => {
  const t0 = Date.now() - 42;
  const res = resolveFastRoute("ping", t0);
  assert.equal(res.type, "instant_reply");
  assert.match(res.message, /Pong!/);
  assert.match(res.message, /Tempo de processamento/);

  const resBang = resolveFastRoute("!ping", t0);
  assert.equal(resBang.type, "instant_reply");
  assert.match(resBang.message, /Pong!/);
});

test("fastRouter: saudações retornam menu rápido", () => {
  for (const greeting of ["oi", "olá", "ola", "bom dia", "boa tarde", "e aí", "opa"]) {
    const res = resolveFastRoute(greeting);
    assert.equal(res.type, "instant_reply", `Falhou para: ${greeting}`);
    assert.match(res.message, /B-Finances/);
  }
});

test("fastRouter: agradecimentos retornam resposta amigável", () => {
  for (const thanks of ["valeu", "obrigado", "obrigada", "vlw"]) {
    const res = resolveFastRoute(thanks);
    assert.equal(res.type, "instant_reply");
    assert.match(res.message, /Por nada/);
  }
});

test("fastRouter: pedidos de ajuda retornam guia de comandos", () => {
  for (const help of ["ajuda", "menu", "comandos", "help", "como funciona"]) {
    const res = resolveFastRoute(help);
    assert.equal(res.type, "instant_reply");
    assert.match(res.message, /Guia de Comandos/);
    assert.match(res.message, /ping/);
  }
});

test("fastRouter: consultas frequentes geram comandos sem IA", () => {
  const saldo = resolveFastRoute("saldo");
  assert.equal(saldo.type, "command");
  assert.equal(saldo.command.action, "query");
  assert.equal(saldo.command.resource, "summary");

  const hoje = resolveFastRoute("gastos hoje");
  assert.equal(hoje.type, "command");
  assert.equal(hoje.command.action, "query");
  assert.equal(hoje.command.period?.type, "today");

  const mes = resolveFastRoute("gastos do mes");
  assert.equal(mes.type, "command");
  assert.equal(mes.command.action, "query");
  assert.equal(mes.command.period?.type, "current_month");

  const fatura = resolveFastRoute("minhas faturas");
  assert.equal(fatura.type, "command");
  assert.equal(fatura.command.resource, "invoice");

  const contas = resolveFastRoute("contas a pagar");
  assert.equal(contas.type, "command");
  assert.equal(contas.command.resource, "bill");

  const inv = resolveFastRoute("investimentos");
  assert.equal(inv.type, "command");
  assert.equal(inv.command.resource, "investment");
});

test("fastRouter: frases complexas retornam type none para ir para o Gemini", () => {
  const complex = resolveFastRoute("quanto gastei na farmácia droga raia entre janeiro e março parcelado em 3x?");
  assert.equal(complex.type, "none");
});

