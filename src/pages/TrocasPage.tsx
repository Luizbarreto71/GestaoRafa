import { FormularioDeTroca } from '@/components/trocas/FormularioDeTroca';
import { FotoProtegida } from '@/components/trocas/FotoProtegida';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useTroca, useTrocas } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { DEFEITO_ROTULO, SITUACAO_IMEI_ROTULO } from '@shared/trocas';
import type { Troca, TrocaStatus } from '@/types';
import { Plus, Repeat2, Search, ShieldAlert, ShieldCheck, ShieldQuestion, X } from 'lucide-react';
import { useState } from 'react';

const ROTULO_FOTO: Record<string, string> = {
  ANATEL: 'Print da Anatel',
  DOCUMENTO: 'Documento do cliente',
  APARELHO: 'O aparelho',
};

const TOM_STATUS: Record<TrocaStatus, 'warning' | 'success' | 'danger'> = {
  AVALIADA: 'warning',
  ACEITA: 'success',
  RECUSADA: 'danger',
};

const ROTULO_STATUS: Record<TrocaStatus, string> = {
  AVALIADA: 'Aguardando venda',
  ACEITA: 'Aceita',
  RECUSADA: 'Recusada',
};

/** O escudo diz de relance se o aparelho pode ser recebido. */
export function EscudoImei({ situacao, compacto }: { situacao: string; compacto?: boolean }) {
  const mapa = {
    REGULAR: { Icone: ShieldCheck, cor: 'text-success', fundo: 'bg-success-bg dark:bg-success/15' },
    BLOQUEADO: { Icone: ShieldAlert, cor: 'text-danger', fundo: 'bg-danger-bg dark:bg-danger/15' },
    IRREGULAR: { Icone: ShieldAlert, cor: 'text-warning', fundo: 'bg-warning-bg dark:bg-warning/15' },
    NAO_CONSULTADO: { Icone: ShieldQuestion, cor: 'text-slate-500', fundo: 'bg-slate-100 dark:bg-navy-700' },
  }[situacao] ?? {
    Icone: ShieldQuestion,
    cor: 'text-slate-500',
    fundo: 'bg-slate-100 dark:bg-navy-700',
  };

  return (
    <span
      className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold', mapa.fundo, mapa.cor)}
      title={`Anatel: ${SITUACAO_IMEI_ROTULO[situacao] ?? situacao}`}
    >
      <mapa.Icone className="h-3.5 w-3.5" />
      {!compacto && (SITUACAO_IMEI_ROTULO[situacao] ?? situacao)}
    </span>
  );
}

/**
 * Trocas: aparelhos usados recebidos como parte do pagamento.
 *
 * Uma troca vive sozinha até virar venda — o vendedor avalia no balcão e o
 * caixa é quem fecha, atrelando-a à pré-venda.
 */
export default function TrocasPage() {
  const [formAberto, setFormAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<Troca | null>(null);
  const [recusando, setRecusando] = useState<Troca | null>(null);
  const [busca, setBusca] = useState('');

  const termo = useDebounce(busca, 300);
  const toast = useToast();
  const { data, isLoading } = useTrocas({ search: termo });
  const recusar = useTroca('recusar');

  async function confirmarRecusa() {
    if (!recusando) return;
    try {
      const r = await recusar.mutateAsync({ id: recusando.id });
      toast.success('Troca recusada', r.message);
      setRecusando(null);
    } catch (erro) {
      toast.error('Não foi possível recusar', erro instanceof Error ? erro.message : undefined);
    }
  }

  const lista = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            🔁 Trocas
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Aparelho usado que entra como parte do pagamento. Vira desconto na pré-venda.
          </p>
        </div>

        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormAberto(true)}>
          Nova troca
        </Button>
      </div>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por IMEI, modelo, cliente ou número da troca…"
        icon={<Search className="h-4 w-4" />}
      />

      {isLoading && <div className="skeleton h-32 w-full" />}

      {!isLoading && lista.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <Repeat2 className="h-10 w-10 text-slate-300 dark:text-navy-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {termo ? `Nada encontrado para “${termo}”.` : 'Nenhuma troca registrada ainda.'}
            </p>
            {!termo && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormAberto(true)}>
                Registrar a primeira
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lista.map((t) => (
          <Card key={t.id}>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{t.code}</p>
                  <p className="truncate text-base font-bold text-navy-900 dark:text-slate-100">
                    {t.modelo}
                    {t.armazenamento ? ` ${t.armazenamento}` : ''}
                    {t.cor ? ` · ${t.cor}` : ''}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {t.customerName} · {formatDateTime(t.createdAt)}
                  </p>
                </div>
                <Badge tone={TOM_STATUS[t.status]}>{ROTULO_STATUS[t.status]}</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <EscudoImei situacao={t.imeiSituacao} />
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{t.imei}</span>
                {t.estado && <Badge tone="neutral">{t.estado}</Badge>}
              </div>

              {t.defeitos.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.defeitos.map((d) => (
                    <span
                      key={d}
                      className="rounded bg-warning-bg px-1.5 py-0.5 text-[11px] font-medium text-warning dark:bg-warning/15"
                    >
                      {DEFEITO_ROTULO[d] ?? d}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-navy-700">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Avaliado em</p>
                  <p className="text-lg font-extrabold text-success">{formatCurrency(t.valorAvaliado)}</p>
                </div>

                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDetalhe(t)}>
                    Detalhes
                  </Button>
                  {t.status === 'AVALIADA' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setRecusando(t)}
                      icon={<X className="h-3.5 w-3.5" />}
                    >
                      Recusar
                    </Button>
                  )}
                </div>
              </div>

              {t.preSale && (
                <p className="text-xs font-semibold text-accent">Na pré-venda {t.preSale.code}</p>
              )}
              {t.sale && <p className="text-xs font-semibold text-success">✅ Virou a venda {t.sale.code}</p>}
            </CardBody>
          </Card>
        ))}
      </div>

      <FormularioDeTroca aberto={formAberto} aoFechar={() => setFormAberto(false)} />

      <DetalheDaTroca troca={detalhe} aoFechar={() => setDetalhe(null)} />

      <ConfirmDialog
        open={Boolean(recusando)}
        title="Recusar a troca"
        message={`A troca ${recusando?.code} sai da lista de disponíveis e o aparelho volta para o cliente.`}
        confirmLabel="Recusar"
        cancelLabel="Voltar"
        loading={recusar.isPending}
        onConfirm={() => void confirmarRecusa()}
        onCancel={() => setRecusando(null)}
      />
    </div>
  );
}

function DetalheDaTroca({ troca, aoFechar }: { troca: Troca | null; aoFechar: () => void }) {
  return (
    <Modal
      open={Boolean(troca)}
      onClose={aoFechar}
      title={troca?.code}
      description={troca ? `${troca.modelo} · ${troca.customerName}` : undefined}
      size="md"
    >
      {troca && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Linha rotulo="Vendedor" valor={troca.seller?.name ?? '—'} />
            <Linha rotulo="Unidade" valor={troca.unit?.name ?? '—'} />
            <Linha rotulo="CPF" valor={troca.customerDocument ?? '—'} />
            <Linha rotulo="Telefone" valor={troca.customerPhone ?? '—'} />
          </div>

          {/* Um bloco por peça. Trocas antigas guardavam o aparelho na
              própria troca — a lista vem vazia e o de fora é o que existe. */}
          {(troca.aparelhos?.length
            ? troca.aparelhos
            : [
                {
                  id: troca.id,
                  ordem: 0,
                  modelo: troca.modelo,
                  marca: troca.marca,
                  armazenamento: troca.armazenamento,
                  cor: troca.cor,
                  imei: troca.imei,
                  imeiSituacao: troca.imeiSituacao,
                  estado: troca.estado,
                  defeitos: troca.defeitos,
                  observacoes: troca.observacoes,
                  valorAvaliado: troca.valorAvaliado,
                  fotos: troca.photos,
                },
              ]
          ).map((a, i, todos) => (
            <div key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-navy-700">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-navy-900 dark:text-slate-100">
                  {todos.length > 1 && (
                    <span className="mr-1.5 text-xs font-semibold text-slate-400">{i + 1}/{todos.length}</span>
                  )}
                  {a.modelo}
                </p>
                <strong className="text-success">{formatCurrency(a.valorAvaliado)}</strong>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Linha rotulo="Marca" valor={a.marca ?? '—'} />
                <Linha rotulo="Armazenamento" valor={a.armazenamento ?? '—'} />
                <Linha rotulo="Cor" valor={a.cor ?? '—'} />
                <Linha rotulo="Estado" valor={a.estado ?? '—'} />
                <Linha rotulo="IMEI" valor={a.imei ?? '—'} />
              </div>

              <div className="mt-2 flex items-center gap-2">
                <EscudoImei situacao={a.imeiSituacao} />
                {i === 0 && troca.imeiCheckedAt && (
                  <span className="text-xs text-slate-500">
                    consultado em {formatDateTime(troca.imeiCheckedAt)}
                  </span>
                )}
              </div>

              {a.defeitos.length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-slate-600 dark:text-slate-400">
                  {a.defeitos.map((d) => (
                    <li key={d}>{DEFEITO_ROTULO[d] ?? d}</li>
                  ))}
                </ul>
              )}

              {a.observacoes && (
                <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{a.observacoes}</p>
              )}

              {a.fotos.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {a.fotos.map((f) => (
                    <FotoProtegida
                      key={f.id}
                      url={f.url}
                      alt={ROTULO_FOTO[f.tipo] ?? f.tipo}
                      className="aspect-square rounded-lg border border-slate-200 dark:border-navy-700"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* O documento do cliente é do negócio, não de uma peça. */}
          {troca.aparelhos?.length > 0 && troca.photos.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">Documento do cliente</p>
              <div className="grid grid-cols-4 gap-2">
                {troca.photos.map((f) => (
                  <FotoProtegida
                    key={f.id}
                    url={f.url}
                    alt={ROTULO_FOTO[f.tipo] ?? f.tipo}
                    className="aspect-square rounded-lg border border-slate-200 dark:border-navy-700"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800">
            <Linha rotulo="Aparelho que sai" valor={troca.saidaNome ?? '—'} />
            <Linha rotulo="Valor de saída" valor={formatCurrency(troca.valorSaida)} />
            <Linha rotulo="Troca do cliente" valor={`− ${formatCurrency(troca.valorAvaliado)}`} />
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 dark:border-navy-700">
              <span className="font-semibold text-navy-900 dark:text-slate-100">
                {troca.diferenca >= 0 ? 'O cliente paga' : 'A loja devolve'}
              </span>
              <strong className="text-lg text-success">{formatCurrency(Math.abs(troca.diferenca))}</strong>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

const Linha = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <p className="flex justify-between gap-3">
    <span className="text-slate-500 dark:text-slate-400">{rotulo}</span>
    <span className="text-right font-medium text-navy-900 dark:text-slate-100">{valor}</span>
  </p>
);
