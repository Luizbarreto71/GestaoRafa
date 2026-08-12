import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/format';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

export type AbaixoDoMinimo = { nome: string; cobrado: number; minimo: number };

/**
 * Itens abaixo do preço de atacado.
 *
 * Sem atacado cadastrado não há piso: o produto fica de fora em vez de
 * bloquear a venda por um dado que ninguém preencheu.
 */
export function abaixoDoMinimo(
  itens: { productId: string; productName?: string | null; unitPrice: number }[],
  produtos: { id: string; name: string; wholesalePrice?: number | null }[],
): AbaixoDoMinimo[] {
  return itens.flatMap((item) => {
    const produto = produtos.find((p) => p.id === item.productId);
    if (!produto?.wholesalePrice) return [];
    if (item.unitPrice >= produto.wholesalePrice) return [];

    return [{ nome: produto.name, cobrado: item.unitPrice, minimo: produto.wholesalePrice }];
  });
}

/**
 * Pede a chave do administrador para fechar abaixo do mínimo.
 *
 * Mostra item a item o que está abaixo e de quanto: quem digita a chave
 * precisa saber o que está autorizando, não só que "algo" está barato.
 */
export function PedirChave({
  itens,
  aoConfirmar,
  aoFechar,
  ocupado,
}: {
  itens: AbaixoDoMinimo[] | null;
  aoConfirmar: (chave: string) => void;
  aoFechar: () => void;
  ocupado?: boolean;
}) {
  const [chave, setChave] = useState('');

  useEffect(() => {
    if (itens) setChave('');
  }, [itens]);

  if (!itens) return null;

  const perda = itens.reduce((s, i) => s + (i.minimo - i.cobrado), 0);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (chave.trim()) aoConfirmar(chave.trim());
  }

  return (
    <Modal
      open
      onClose={aoFechar}
      title="Venda abaixo do preço de atacado"
      description="Precisa da chave do administrador"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-chave"
            loading={ocupado}
            disabled={!chave.trim()}
            icon={<KeyRound className="h-4 w-4" />}
          >
            Liberar e finalizar
          </Button>
        </>
      }
    >
      <form id="form-chave" onSubmit={enviar} className="space-y-4">
        <div className="flex gap-2.5 rounded-lg bg-warning-bg px-4 py-3 text-sm dark:bg-warning/10">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
            {itens.map((i) => (
              <p key={i.nome + i.cobrado}>
                <strong>{i.nome}</strong> por {formatCurrency(i.cobrado)} — o mínimo é{' '}
                {formatCurrency(i.minimo)}
              </p>
            ))}
            {itens.length > 1 && (
              <p className="border-t border-warning/20 pt-1.5 font-semibold">
                A loja abre mão de {formatCurrency(perda)} no total
              </p>
            )}
          </div>
        </div>

        <Input
          label="Chave de acesso"
          type="password"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder="••••••"
          autoFocus
          autoComplete="off"
        />
      </form>
    </Modal>
  );
}
