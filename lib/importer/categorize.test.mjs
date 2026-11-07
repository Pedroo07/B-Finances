import assert from "node:assert/strict";
import test from "node:test";

import { suggestCategory } from "./categorize.ts";

test("sugere categorias por palavra-chave", () => {
  assert.equal(suggestCategory("Dl*Spotify P48e6"), "subscriptions");
  assert.equal(suggestCategory("Posto dos Amigos"), "transport");
  assert.equal(suggestCategory("Supermercado Leal"), "foods");
  assert.equal(suggestCategory("Emporio Brasil"), "foods");
  assert.equal(suggestCategory("iFood *Restaurante"), "delivery");
  assert.equal(suggestCategory("Mercado Livre Pedido"), "shopping");
  assert.equal(suggestCategory("AMAZON BR *Amazon BR"), "shopping");
  assert.equal(suggestCategory("Bmb *Vivoeasy Lite"), "fixes");
  assert.equal(suggestCategory("Flaviogomez"), "other");
});

test("palavras curtas só casam como palavra inteira", () => {
  assert.equal(suggestCategory("Timoteo Pecas"), "other");
  assert.equal(suggestCategory("Tim Celular"), "fixes");
});
