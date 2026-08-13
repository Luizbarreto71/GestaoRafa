-- Desfaz a marcação que a migração dos seminovos fez nos aparelhos de
-- vitrine. Presumi que vitrine era seminovo; não é como a loja trabalha.
--
-- Só desmarca o que aquela migração marcou — a origem "Cadastro anterior"
-- é a assinatura dela. Aparelho que entrou por troca ou compra continua
-- na aba, e nenhum produto sai do estoque: só deixa de aparecer ali.
UPDATE "products"
SET "seminovo" = false, "seminovoOrigem" = NULL
WHERE "seminovo" = true
  AND "seminovoOrigem" = 'Cadastro anterior'
  AND "tradeInAparelhoId" IS NULL;
