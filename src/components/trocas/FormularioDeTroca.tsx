import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useProducts, useTroca } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { useUnit } from '@/contexts/UnitContext';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { Troca } from '@/types';
import { Check, Plus, Search, X } from 'lucide-react';
import { FotosDaTroca } from './FotosDaTroca';
import { useState, type FormEvent } from 'react';
import {
  AparelhoDaTroca,
  aparelhoVazio,
  imeiDe,
  problemaNoAparelho,
  type AparelhoEmEdicao,
} from './AparelhoDaTroca';

const VAZIO = {
  valorSaida: '',
  customerName: '',
  customerPhone: '',
  customerDocument: '',
  unitId: '',
};

/**
 * Avaliação do aparelho usado que entra como parte do pagamento.
 *
 * A ordem das perguntas segue o balcão: primeiro o aparelho na mão, depois
 * o IMEI (que é o que trava o negócio), depois o dinheiro.
 */
export function FormularioDeTroca({
  aberto,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Recebe a troca recém-criada — usado pela pré-venda para já anexá-la. */
  aoCriar?: (troca: Troca) => void;
}) {
  const [form, setForm] = useState(VAZIO);
  const [aparelhos, setAparelhos] = useState<AparelhoEmEdicao[]>([aparelhoVazio()]);
  const [fotosDoCliente, setFotosDoCliente] = useState<
    { tipo: 'ANATEL' | 'DOCUMENTO' | 'APARELHO'; data: string }[]
  >([]);
  const [buscaSaida, setBuscaSaida] = useState('');
  const [saida, setSaida] = useState<{ id: string; name: string } | null>(null);

  const toast = useToast();
  const { unidades } = useUnit();
  const criar = useTroca('criar');

  const termo = useDebounce(buscaSaida, 300);
  const { data: produtos } = useProducts({ search: termo, pageSize: 6 });

  const alterar = (campo: keyof typeof VAZIO, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const mudarAparelho = (indice: number, mudanca: Partial<AparelhoEmEdicao>) =>
    setAparelhos((atual) => atual.map((a, i) => (i === indice ? { ...a, ...mudanca } : a)));

  // A troca vale a soma: é isso que abate do que o cliente tem a pagar.
  const avaliado = aparelhos.reduce((soma, a) => soma + (Number(a.valorAvaliado) || 0), 0);
  const valorSaida = Number(form.valorSaida) || 0;
  const diferenca = valorSaida - avaliado;

  const bloqueado = aparelhos.some((a) => a.imeiSituacao === 'BLOQUEADO');

  function limpar() {
    setForm(VAZIO);
    setAparelhos([aparelhoVazio()]);
    setFotosDoCliente([]);
    setSaida(null);
    setBuscaSaida('');
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();

    // Aponta o aparelho pelo número: com três na tela, "confira o IMEI" sem
    // dizer qual manda o vendedor procurar.
    for (const [i, aparelho] of aparelhos.entries()) {
      const problema = problemaNoAparelho(aparelho);
      if (problema) {
        return toast.warning(`Aparelho ${i + 1}: ${aparelho.modelo.trim() || 'sem modelo'}`, problema);
      }
    }

    const digitados = aparelhos.map(imeiDe);
    const repetido = digitados.find((imei, i) => digitados.indexOf(imei) !== i);
    if (repetido) {
      return toast.warning('IMEI repetido', `O número ${repetido} foi informado em dois aparelhos.`);
    }

    try {
      const r = await criar.mutateAsync({
        dados: {
          ...form,
          valorSaida,
          productId: saida?.id ?? null,
          saidaNome: saida?.name ?? null,
          customerPhone: form.customerPhone || null,
          customerDocument: form.customerDocument || null,
          unitId: form.unitId || unidades[0]?.id || null,
          photos: fotosDoCliente,
          aparelhos: aparelhos.map((a) => ({
            modelo: a.modelo,
            marca: a.marca || null,
            armazenamento: a.armazenamento || null,
            cor: a.cor || null,
            imei: imeiDe(a),
            imeiSituacao: a.imeiSituacao,
            estado: a.estado || null,
            observacoes: a.observacoes || null,
            valorAvaliado: Number(a.valorAvaliado) || 0,
            defeitos: a.defeitos,
            photos: a.fotos,
          })),
        },
      });

      toast.success('Troca registrada', r.message);
      aoCriar?.(r as Troca);
      limpar();
      aoFechar();
    } catch (erro) {
      toast.error('Não foi possível registrar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={aoFechar}
      title="Nova troca"
      description="Aparelho usado recebido como parte do pagamento"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-troca"
            loading={criar.isPending}
            disabled={bloqueado}
            icon={<Check className="h-4 w-4" />}
          >
            Registrar troca
          </Button>
        </>
      }
    >
      <form id="form-troca" onSubmit={enviar} className="space-y-6">
        {/* --------------------------------------------- aparelhos que entram */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="label-base mb-0">
              {aparelhos.length === 1 ? 'Aparelho que está entrando' : `${aparelhos.length} aparelhos entrando`}
            </p>
            {aparelhos.length > 1 && (
              <span className="text-sm font-bold text-success">{formatCurrency(avaliado)}</span>
            )}
          </div>

          {aparelhos.map((aparelho, i) => (
            <AparelhoDaTroca
              key={i}
              aparelho={aparelho}
              indice={i}
              total={aparelhos.length}
              aoMudar={(mudanca) => mudarAparelho(i, mudanca)}
              aoRemover={() => setAparelhos((atual) => atual.filter((_, x) => x !== i))}
            />
          ))}

          {/* Até seis: mais que isso não é troca, é compra de lote — e essa
              tem outro caminho, pela entrada de mercadoria. */}
          {aparelhos.length < 6 && (
            <button
              type="button"
              onClick={() => setAparelhos((atual) => [...atual, aparelhoVazio()])}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-accent hover:text-accent dark:border-navy-600 dark:text-slate-400"
            >
              <Plus className="h-4 w-4" />
              O cliente deixou mais um aparelho
            </button>
          )}
        </section>

        {/* --------------------------------------------------------- cliente */}
        <section>
          <p className="label-base">Cliente</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Nome"
              required
              value={form.customerName}
              onChange={(e) => alterar('customerName', e.target.value)}
            />
            <Input
              label="CPF"
              value={form.customerDocument}
              onChange={(e) => alterar('customerDocument', e.target.value)}
              placeholder="000.000.000-00"
            />
            <Input
              label="Telefone"
              value={form.customerPhone}
              onChange={(e) => alterar('customerPhone', e.target.value)}
              placeholder="(11) 90000-0000"
            />
          </div>

          {/* Uma vez só: o RG é da pessoa, não de cada aparelho. */}
          <div className="mt-3">
            <FotosDaTroca valor={fotosDoCliente} aoMudar={setFotosDoCliente} tipos={['DOCUMENTO']} />
            {!fotosDoCliente.length && (
              <p className="mt-1 text-xs text-warning">
                Sem o documento do cliente, a loja fica sem prova de quem entregou os aparelhos.
              </p>
            )}
          </div>
        </section>

        {/* ------------------------------------------------- aparelho que sai */}
        <section>
          <p className="label-base">Aparelho que está saindo</p>

          {saida ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-navy-700 dark:bg-navy-800">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                {saida.name}
              </span>
              <button
                type="button"
                onClick={() => setSaida(null)}
                className="rounded p-1 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
                aria-label="Trocar aparelho"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Input
                label="Procure no estoque"
                value={buscaSaida}
                onChange={(e) => setBuscaSaida(e.target.value)}
                placeholder="Nome, modelo, IMEI…"
                icon={<Search className="h-4 w-4" />}
              />

              {termo.length >= 2 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700">
                  {produtos?.data.length === 0 && (
                    <p className="px-3 py-4 text-center text-sm text-slate-500">Nada encontrado</p>
                  )}
                  {produtos?.data.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSaida({ id: p.id, name: p.name });
                        // Já preenche o valor de saída com o preço praticado.
                        alterar('valorSaida', String(p.salePrice || p.wholesalePrice || 0));
                        setBuscaSaida('');
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-navy-900 dark:text-slate-100">
                        {p.name}
                      </span>
                      <Badge tone="neutral">{formatCurrency(p.salePrice || p.wholesalePrice || 0)}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* ---------------------------------------------------------- valores */}
        <section>
          <p className="label-base">A conta</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* A avaliação não se digita aqui: é a soma do que foi anotado em
                cada aparelho, e um segundo lugar para mexer no mesmo número
                seria um lugar para os dois discordarem. */}
            <div>
              <p className="label-base">O que a loja paga pela troca</p>
              <div className="flex h-[42px] items-center justify-between rounded-lg bg-slate-50 px-3 dark:bg-navy-800">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {aparelhos.length === 1 ? '1 aparelho' : `${aparelhos.length} aparelhos`}
                </span>
                <strong className="text-base font-bold text-success">{formatCurrency(avaliado)}</strong>
              </div>
            </div>
            <Input
              label="Valor do aparelho que sai"
              type="number"
              min={0}
              step="0.01"
              value={form.valorSaida}
              onChange={(e) => alterar('valorSaida', e.target.value)}
            />
          </div>

          <div
            className={cn(
              'mt-3 rounded-lg px-4 py-3',
              diferenca >= 0 ? 'bg-navy-900 text-white dark:bg-navy-800' : 'bg-warning-bg dark:bg-warning/15',
            )}
          >
            <p className="flex items-center justify-between">
              <span className={cn('text-sm font-semibold', diferenca < 0 && 'text-warning')}>
                {diferenca >= 0 ? 'O cliente ainda paga' : 'A loja devolve ao cliente'}
              </span>
              <strong className={cn('text-2xl font-extrabold', diferenca < 0 && 'text-warning')}>
                {formatCurrency(Math.abs(diferenca))}
              </strong>
            </p>
            <p className={cn('mt-0.5 text-xs', diferenca >= 0 ? 'text-slate-300' : 'text-warning')}>
              {formatCurrency(valorSaida)} do aparelho − {formatCurrency(avaliado)} da troca
            </p>
          </div>
        </section>
      </form>
    </Modal>
  );
}
