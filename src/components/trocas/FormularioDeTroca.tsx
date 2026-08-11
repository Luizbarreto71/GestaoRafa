import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useProducts, useTroca } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { useUnit } from '@/contexts/UnitContext';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import {
  ANATEL_URL,
  ARMAZENAMENTOS,
  DEFEITOS,
  ESTADOS,
  SITUACOES_IMEI,
  imeiValido,
} from '@shared/trocas';
import type { Troca } from '@/types';
import { Check, Copy, ExternalLink, Search, ShieldAlert, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { FotosDaTroca } from './FotosDaTroca';

const VAZIO = {
  modelo: '',
  marca: '',
  armazenamento: '',
  cor: '',
  imei: '',
  imeiSituacao: 'NAO_CONSULTADO',
  estado: 'Bom',
  observacoes: '',
  valorAvaliado: '',
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
  const [defeitos, setDefeitos] = useState<string[]>([]);
  const [fotos, setFotos] = useState<{ tipo: 'ANATEL' | 'DOCUMENTO' | 'APARELHO'; data: string }[]>([]);
  const [buscaSaida, setBuscaSaida] = useState('');
  const [saida, setSaida] = useState<{ id: string; name: string } | null>(null);

  const toast = useToast();
  const { unidades } = useUnit();
  const criar = useTroca('criar');

  const termo = useDebounce(buscaSaida, 300);
  const { data: produtos } = useProducts({ search: termo, pageSize: 6 });

  const alterar = (campo: keyof typeof VAZIO, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const imeiLimpo = form.imei.replace(/\D/g, '');
  const imeiCompleto = imeiLimpo.length === 15;
  const imeiOk = imeiCompleto && imeiValido(imeiLimpo);
  const bloqueado = form.imeiSituacao === 'BLOQUEADO';

  const avaliado = Number(form.valorAvaliado) || 0;
  const valorSaida = Number(form.valorSaida) || 0;
  const diferenca = valorSaida - avaliado;

  const temDocumento = fotos.some((f) => f.tipo === 'DOCUMENTO');
  const temAnatel = fotos.some((f) => f.tipo === 'ANATEL');

  function limpar() {
    setForm(VAZIO);
    setDefeitos([]);
    setFotos([]);
    setSaida(null);
    setBuscaSaida('');
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (!imeiOk) return toast.warning('Confira o IMEI', 'Os 15 números não fecham a conferência.');
    if (bloqueado) {
      return toast.error(
        'Aparelho bloqueado',
        'A Anatel aponta roubo, furto ou bloqueio. Não receba este aparelho.',
      );
    }
    if (!avaliado) return toast.warning('Informe quanto vale o aparelho do cliente');

    try {
      const r = await criar.mutateAsync({
        dados: {
          ...form,
          imei: imeiLimpo,
          marca: form.marca || null,
          armazenamento: form.armazenamento || null,
          cor: form.cor || null,
          estado: form.estado || null,
          observacoes: form.observacoes || null,
          valorAvaliado: avaliado,
          valorSaida,
          productId: saida?.id ?? null,
          saidaNome: saida?.name ?? null,
          customerPhone: form.customerPhone || null,
          customerDocument: form.customerDocument || null,
          unitId: form.unitId || unidades[0]?.id || null,
          defeitos,
          photos: fotos,
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

  const consultarAnatel = async () => {
    try {
      await navigator.clipboard.writeText(imeiLimpo);
      toast.info('IMEI copiado', 'Cole no campo da Anatel e resolva o "não sou um robô".');
    } catch {
      /* sem área de transferência: a página abre do mesmo jeito */
    }
    window.open(ANATEL_URL, '_blank', 'noopener');
  };

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
        {/* ---------------------------------------------- aparelho que entra */}
        <section>
          <p className="label-base">Aparelho que está entrando</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Modelo"
              required
              value={form.modelo}
              onChange={(e) => alterar('modelo', e.target.value)}
              placeholder="iPhone 12, Redmi Note 13…"
              autoFocus
            />
            <Input
              label="Marca"
              value={form.marca}
              onChange={(e) => alterar('marca', e.target.value)}
              placeholder="Apple, Xiaomi…"
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Input
                label="Armazenamento"
                value={form.armazenamento}
                onChange={(e) => alterar('armazenamento', e.target.value)}
                placeholder="128GB"
                list="gigas-troca"
              />
              <datalist id="gigas-troca">
                {ARMAZENAMENTOS.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <Input
              label="Cor"
              value={form.cor}
              onChange={(e) => alterar('cor', e.target.value)}
              placeholder="Preto, Azul…"
            />
            <Select
              label="Estado geral"
              value={form.estado}
              onChange={(e) => alterar('estado', e.target.value)}
              options={ESTADOS.map((e) => ({ value: e, label: e }))}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------ IMEI */}
        <section>
          <p className="label-base">IMEI e situação na Anatel</p>

          <Input
            label="IMEI"
            required
            inputMode="numeric"
            value={form.imei}
            onChange={(e) => alterar('imei', e.target.value)}
            placeholder="15 números"
            hint={`${imeiLimpo.length}/15`}
            error={imeiCompleto && !imeiOk ? 'Esses 15 números não fecham — confira a digitação' : undefined}
          />

          {imeiOk && (
            <>
              <button
                type="button"
                onClick={() => void consultarAnatel()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent/5 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/10"
              >
                <ExternalLink className="h-4 w-4" />
                Copiar o IMEI e abrir a consulta da Anatel
                <Copy className="h-3.5 w-3.5 opacity-60" />
              </button>

              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                A consulta não pode ser feita pelo sistema: a página da Anatel exige o “não sou um
                robô”. Consulte, marque abaixo o que apareceu e anexe o print.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {SITUACOES_IMEI.map((s) => (
                  <button
                    key={s.chave}
                    type="button"
                    onClick={() => alterar('imeiSituacao', s.chave)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-semibold transition',
                      form.imeiSituacao === s.chave
                        ? s.tom === 'danger'
                          ? 'border-danger bg-danger/10 text-danger'
                          : s.tom === 'success'
                            ? 'border-success bg-success/10 text-success'
                            : s.tom === 'warning'
                              ? 'border-warning bg-warning/10 text-warning'
                              : 'border-accent bg-accent/10 text-accent'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-800',
                    )}
                  >
                    {s.rotulo}
                  </button>
                ))}
              </div>
            </>
          )}

          {bloqueado && (
            <div className="mt-3 flex gap-2.5 rounded-lg bg-danger-bg px-4 py-3 text-sm dark:bg-danger/10">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <p className="font-medium text-danger">
                Não receba este aparelho. A Anatel aponta roubo, furto ou bloqueio — o sistema não
                deixa registrar a troca.
              </p>
            </div>
          )}
        </section>

        {/* -------------------------------------------------------- defeitos */}
        <section>
          <p className="label-base">O que o aparelho tem</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {DEFEITOS.map((d) => {
              const marcado = defeitos.includes(d.chave);
              return (
                <label
                  key={d.chave}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition',
                    marcado
                      ? 'border-warning bg-warning-bg/60 dark:bg-warning/10'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={(e) =>
                      setDefeitos((atual) =>
                        e.target.checked ? [...atual, d.chave] : atual.filter((c) => c !== d.chave),
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 accent-warning"
                  />
                  <span className={marcado ? 'font-medium text-warning' : 'text-slate-600 dark:text-slate-400'}>
                    {d.rotulo}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-3">
            <Textarea
              label="Observações"
              value={form.observacoes}
              onChange={(e) => alterar('observacoes', e.target.value)}
              placeholder="Riscos na lateral, acompanha carregador, caixa original…"
            />
          </div>
        </section>

        {/* ----------------------------------------------------------- fotos */}
        <section>
          <p className="label-base">Fotos</p>
          <FotosDaTroca valor={fotos} aoMudar={setFotos} />

          {(!temDocumento || !temAnatel) && (
            <p className="mt-2 text-xs text-warning">
              Faltando:{' '}
              {[!temDocumento && 'documento do cliente', !temAnatel && 'print da Anatel']
                .filter(Boolean)
                .join(' e ')}
              . Dá para registrar sem, mas é o que protege a loja depois.
            </p>
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
            <Input
              label="Valor do aparelho do cliente"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.valorAvaliado}
              onChange={(e) => alterar('valorAvaliado', e.target.value)}
              hint="Quanto a loja aceita pagar pelo usado"
            />
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
