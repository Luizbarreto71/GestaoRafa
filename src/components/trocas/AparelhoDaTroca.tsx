import { Input, Select, Textarea } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { ANATEL_URL, ARMAZENAMENTOS, DEFEITOS, ESTADOS, SITUACOES_IMEI, imeiValido } from '@shared/trocas';
import { Copy, ExternalLink, ShieldAlert, Trash2 } from 'lucide-react';
import { FotosDaTroca } from './FotosDaTroca';

/** Um aparelho enquanto está sendo preenchido na tela. */
export type AparelhoEmEdicao = {
  modelo: string;
  marca: string;
  armazenamento: string;
  cor: string;
  imei: string;
  imeiSituacao: string;
  estado: string;
  observacoes: string;
  valorAvaliado: string;
  defeitos: string[];
  fotos: { tipo: 'ANATEL' | 'DOCUMENTO' | 'APARELHO'; data: string }[];
};

export const aparelhoVazio = (): AparelhoEmEdicao => ({
  modelo: '',
  marca: '',
  armazenamento: '',
  cor: '',
  imei: '',
  imeiSituacao: 'NAO_CONSULTADO',
  estado: 'Bom',
  observacoes: '',
  valorAvaliado: '',
  defeitos: [],
  fotos: [],
});

/** Só os números, que é como o IMEI é conferido e gravado. */
export const imeiDe = (a: AparelhoEmEdicao) => a.imei.replace(/\D/g, '');

/** O que impede este aparelho de ser registrado, ou nada. */
export function problemaNoAparelho(a: AparelhoEmEdicao): string | null {
  const imei = imeiDe(a);
  if (!a.modelo.trim()) return 'Informe o modelo do aparelho.';
  if (imei.length !== 15 || !imeiValido(imei)) return 'Confira o IMEI: os 15 números não fecham.';
  if (a.imeiSituacao === 'BLOQUEADO') return 'A Anatel aponta roubo, furto ou bloqueio neste aparelho.';
  if (!(Number(a.valorAvaliado) || 0)) return 'Informe quanto vale este aparelho.';
  return null;
}

/**
 * O cartão de um aparelho recebido na troca.
 *
 * Modelo, IMEI, estado, defeitos e fotos são de cada peça — o cliente pode
 * deixar um iPhone e um Redmi na mesma troca, e cada um tem a sua história
 * e o seu valor. Cliente, aparelho que sai e a conta ficam fora daqui,
 * porque são do negócio inteiro.
 */
export function AparelhoDaTroca({
  aparelho,
  indice,
  total,
  aoMudar,
  aoRemover,
}: {
  aparelho: AparelhoEmEdicao;
  indice: number;
  total: number;
  aoMudar: (mudanca: Partial<AparelhoEmEdicao>) => void;
  aoRemover: () => void;
}) {
  const imeiLimpo = imeiDe(aparelho);
  const imeiCompleto = imeiLimpo.length === 15;
  const imeiOk = imeiCompleto && imeiValido(imeiLimpo);
  const bloqueado = aparelho.imeiSituacao === 'BLOQUEADO';
  const avaliado = Number(aparelho.valorAvaliado) || 0;

  const temAnatel = aparelho.fotos.some((f) => f.tipo === 'ANATEL');

  const consultarAnatel = async () => {
    try {
      await navigator.clipboard.writeText(imeiLimpo);
    } catch {
      /* sem área de transferência: a página abre do mesmo jeito */
    }
    window.open(ANATEL_URL, '_blank', 'noopener');
  };

  const listaDeGigas = `gigas-troca-${indice}`;

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        bloqueado ? 'border-danger bg-danger-bg/40 dark:bg-danger/10' : 'border-slate-200 dark:border-navy-700',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-slate-100">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white dark:bg-accent">
            {indice + 1}
          </span>
          {aparelho.modelo.trim() || `Aparelho ${indice + 1}`}
          {avaliado > 0 && (
            <span className="text-xs font-semibold text-success">{formatCurrency(avaliado)}</span>
          )}
        </p>

        {/* Com um aparelho só não há o que remover — some o botão em vez de
            deixá-lo ali sem função. */}
        {total > 1 && (
          <button
            type="button"
            onClick={aoRemover}
            className="rounded-lg p-1.5 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
            aria-label={`Remover aparelho ${indice + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ------------------------------------------------------- identificação */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Modelo"
          required
          value={aparelho.modelo}
          onChange={(e) => aoMudar({ modelo: e.target.value })}
          placeholder="iPhone 12, Redmi Note 13…"
          autoFocus={indice > 0}
        />
        <Input
          label="Marca"
          value={aparelho.marca}
          onChange={(e) => aoMudar({ marca: e.target.value })}
          placeholder="Apple, Xiaomi…"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Input
            label="Armazenamento"
            value={aparelho.armazenamento}
            onChange={(e) => aoMudar({ armazenamento: e.target.value })}
            placeholder="128GB"
            list={listaDeGigas}
          />
          <datalist id={listaDeGigas}>
            {ARMAZENAMENTOS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <Input
          label="Cor"
          value={aparelho.cor}
          onChange={(e) => aoMudar({ cor: e.target.value })}
          placeholder="Preto, Azul…"
        />
        <Select
          label="Estado geral"
          value={aparelho.estado}
          onChange={(e) => aoMudar({ estado: e.target.value })}
          options={ESTADOS.map((e) => ({ value: e, label: e }))}
        />
      </div>

      {/* ---------------------------------------------------------------- IMEI */}
      <div className="mt-4">
        <Input
          label="IMEI"
          required
          inputMode="numeric"
          value={aparelho.imei}
          onChange={(e) => aoMudar({ imei: e.target.value })}
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

            <div className="mt-3 grid grid-cols-2 gap-2">
              {SITUACOES_IMEI.map((s) => (
                <button
                  key={s.chave}
                  type="button"
                  onClick={() => aoMudar({ imeiSituacao: s.chave })}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-semibold transition',
                    aparelho.imeiSituacao === s.chave
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
      </div>

      {/* ------------------------------------------------------------ defeitos */}
      <div className="mt-4">
        <p className="label-base">O que este aparelho tem</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {DEFEITOS.map((d) => {
            const marcado = aparelho.defeitos.includes(d.chave);
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
                    aoMudar({
                      defeitos: e.target.checked
                        ? [...aparelho.defeitos, d.chave]
                        : aparelho.defeitos.filter((c) => c !== d.chave),
                    })
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
            value={aparelho.observacoes}
            onChange={(e) => aoMudar({ observacoes: e.target.value })}
            placeholder="Riscos na lateral, acompanha carregador, caixa original…"
          />
        </div>
      </div>

      {/* --------------------------------------------------------------- fotos */}
      <div className="mt-4">
        <p className="label-base">Fotos deste aparelho</p>
        <FotosDaTroca
          valor={aparelho.fotos}
          aoMudar={(fotos) => aoMudar({ fotos })}
          tipos={['ANATEL', 'APARELHO']}
        />

        {!temAnatel && (
          <p className="mt-2 text-xs text-warning">
            Falta o print da Anatel deste aparelho. Dá para registrar sem, mas é o que protege a
            loja depois.
          </p>
        )}
      </div>

      {/* -------------------------------------------------------------- valor */}
      <div className="mt-4">
        <Input
          label="Quanto a loja paga por este aparelho"
          type="number"
          min={0}
          step="0.01"
          required
          value={aparelho.valorAvaliado}
          onChange={(e) => aoMudar({ valorAvaliado: e.target.value })}
        />
      </div>
    </div>
  );
}
