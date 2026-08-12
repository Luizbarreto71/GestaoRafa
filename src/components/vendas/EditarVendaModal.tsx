import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { CarrinhoDeItens, totalDosItens } from '@/components/vendas/CarrinhoDeItens';
import {
  FormasDePagamento,
  formaVazia,
  paraApi,
  somaDasFormas,
  type FormaDePagamento,
} from '@/components/vendas/FormasDePagamento';
import { useToast } from '@/contexts/ToastContext';
import { useUsers } from '@/hooks/queries';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/api';
import { formatCurrency, toInputDate } from '@/lib/format';
import type { ItemVenda, Sale } from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

/**
 * Corrige uma venda já registrada.
 *
 * Mudar quantidade acerta o estoque pela diferença, e mudar valor obriga o
 * pagamento a fechar de novo — por isso a tela mostra o antes e o depois
 * antes de salvar. Só o administrador chega aqui.
 */
export function EditarVendaModal({ venda, aoFechar }: { venda: Sale | null; aoFechar: () => void }) {
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [formas, setFormas] = useState<FormaDePagamento[]>([]);
  const [dividido, setDividido] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerDocument: '',
    vendedor: '',
    notes: '',
    saleDate: '',
    paymentMethod: 'PIX',
    installments: '1',
  });

  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: usuarios } = useUsers({ pageSize: 100 }, true);

  useEffect(() => {
    if (!venda) return;

    setItens(
      venda.items?.map((i) => ({
        productId: i.productId,
        productName: i.productName ?? i.product?.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        imei: i.imei ?? '',
        serialNumber: i.serialNumber ?? '',
      })) ?? [],
    );

    // A troca não é editável aqui: ela tem tela própria e mexe no aparelho
    // recebido, não no dinheiro desta venda.
    const emDinheiro = (venda.payments ?? []).filter((p) => p.method !== 'TROCA');
    setDividido(emDinheiro.length > 1);
    setFormas(
      emDinheiro.map((p) => ({
        ...formaVazia(p.method),
        amount: String(Number(p.amount).toFixed(2)),
        installments: String(p.installments ?? 1),
      })),
    );

    setForm({
      customerName: venda.customerName ?? '',
      customerPhone: venda.customerPhone ?? '',
      customerDocument: venda.customerDocument ?? '',
      vendedor: venda.seller?.name ?? venda.sellerName ?? '',
      notes: venda.notes ?? '',
      saleDate: toInputDate(venda.saleDate),
      paymentMethod: emDinheiro[0]?.method ?? venda.paymentMethod ?? 'PIX',
      installments: String(emDinheiro[0]?.installments ?? venda.installments ?? 1),
    });
  }, [venda?.id]);

  const salvar = useMutation({
    mutationFn: async (dados: Record<string, unknown>) => {
      const { data } = await api.put<{ message: string }>(`/sales/${venda!.id}`, dados);
      return data;
    },
    onSuccess: (r) => {
      toast.success('Venda atualizada', r.message);
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      aoFechar();
    },
    onError: (erro) => toast.error('Não foi possível salvar', getErrorMessage(erro)),
  });

  if (!venda) return null;

  const totalAntes = Number(venda.totalAmount);
  const daTroca = (venda.payments ?? []).find((p) => p.method === 'TROCA');
  const totalDepois = totalDosItens(itens);
  const aReceber = totalDepois - Number(daTroca?.amount ?? 0);
  const mudouTotal = Math.abs(totalDepois - totalAntes) >= 0.01;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!itens.length) return toast.warning('A venda precisa de ao menos um produto');

    if (dividido && Math.abs(somaDasFormas(formas) - aReceber) >= 0.01) {
      return toast.warning(
        'As formas de pagamento não fecham',
        `Distribua ${formatCurrency(aReceber)}.`,
      );
    }

    salvar.mutate({
      items: itens.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        imei: i.imei || null,
        serialNumber: i.serialNumber || null,
      })),
      customerName: form.customerName.trim() || null,
      customerPhone: form.customerPhone.trim() || null,
      customerDocument: form.customerDocument.trim() || null,
      sellerName: form.vendedor.trim() || null,
      notes: form.notes.trim() || null,
      saleDate: form.saleDate ? new Date(`${form.saleDate}T12:00:00`).toISOString() : undefined,
      paymentMethod: dividido ? undefined : form.paymentMethod,
      installments: dividido ? undefined : Number(form.installments) || 1,
      payments: dividido
        ? paraApi(true, formas)
        : [
            ...(paraApi(false, []) ?? []),
            { method: form.paymentMethod, amount: aReceber, installments: Number(form.installments) || 1 },
            ...(daTroca
              ? [{ method: 'TROCA', amount: Number(daTroca.amount), installments: 1 }]
              : []),
          ],
    });
  }

  return (
    <Modal
      open
      onClose={aoFechar}
      title={`Editar venda ${venda.code}`}
      description="Mudar quantidade acerta o estoque pela diferença"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-editar-venda"
            loading={salvar.isPending}
            icon={<Save className="h-4 w-4" />}
          >
            Salvar alterações
          </Button>
        </>
      }
    >
      <form id="form-editar-venda" onSubmit={enviar} className="space-y-5">
        {mudouTotal && (
          <div className="flex gap-2.5 rounded-lg bg-warning-bg px-4 py-3 text-sm dark:bg-warning/10">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-slate-700 dark:text-slate-300">
              O total muda de <strong>{formatCurrency(totalAntes)}</strong> para{' '}
              <strong>{formatCurrency(totalDepois)}</strong>. O estoque e o fechamento do caixa
              acompanham a correção.
            </p>
          </div>
        )}

        <div>
          <p className="label-base">Produtos</p>
          <CarrinhoDeItens itens={itens} aoMudar={setItens} />
        </div>

        <div>
          <p className="label-base">Cliente</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Nome"
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="Consumidor"
            />
            <Input
              label="CPF"
              value={form.customerDocument}
              onChange={(e) => setForm((f) => ({ ...f, customerDocument: e.target.value }))}
            />
            <Input
              label="Telefone"
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Input
              label="Vendedor"
              value={form.vendedor}
              onChange={(e) => setForm((f) => ({ ...f, vendedor: e.target.value }))}
              list="vendedores-edicao"
              hint="Em branco tira a venda do nome de qualquer vendedor"
            />
            <datalist id="vendedores-edicao">
              {(usuarios?.data ?? []).map((u) => (
                <option key={u.id} value={u.name} />
              ))}
            </datalist>
          </div>
          <Input
            label="Data da venda"
            type="date"
            value={form.saleDate}
            onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))}
          />
        </div>

        <div>
          <p className="label-base">
            Pagamento
            {daTroca && (
              <span className="ml-1.5 font-normal text-slate-400">
                · troca de {formatCurrency(Number(daTroca.amount))} preservada
              </span>
            )}
          </p>
          <FormasDePagamento
            dividido={dividido}
            aoDividir={setDividido}
            formas={formas}
            aoMudarFormas={setFormas}
            formaUnica={form.paymentMethod}
            aoMudarFormaUnica={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}
            parcelas={form.installments}
            aoMudarParcelas={(v) => setForm((f) => ({ ...f, installments: v }))}
            total={aReceber}
          />
        </div>

        <Textarea
          label="Observação"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </form>
    </Modal>
  );
}
