import { CalculadoraDeCartao, useTaxasDeCartao } from '@/components/vendas/CalculadoraDeCartao';
import { Input, Select } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { useContasDePix } from '@/hooks/queries';
import { aceitaParcelas, FORMAS, infoDaForma } from '@/lib/pagamentos';
import { Check, HandCoins, Plus, Split, Trash2 } from 'lucide-react';

export type FormaDePagamento = {
  method: string;
  amount: string;
  installments: string;
  notes: string;
  /** Conta que recebeu, quando a forma tem mais de uma. */
  destino?: string;
  /** Taxa da maquininha desta linha, em %. Vem da calculadora. */
  feePercent?: number | null;
  /** Visa/Master ou Elo/Amex: muda a taxa que a maquininha cobra. */
  bandeira?: 'padrao' | 'elo';
  /** Código de autorização do comprovante, para achar no extrato. */
  autorizacao?: string;
};

export const formaVazia = (method = 'PIX'): FormaDePagamento => ({
  method,
  amount: '',
  installments: '1',
  notes: '',
});

/** Quanto já foi distribuído entre as formas. */
export const somaDasFormas = (formas: FormaDePagamento[]) =>
  formas.reduce((soma, f) => soma + (Number(f.amount) || 0), 0);

/** Lista de parcelas com o valor de cada uma já calculado. */
const opcoesDeParcela = (valor: number) =>
  Array.from({ length: 24 }, (_, i) => ({
    value: String(i + 1),
    label: i === 0 ? 'À vista (1x)' : `${i + 1}x de ${formatCurrency(valor / (i + 1))}`,
  }));

/**
 * Escolha da forma de pagamento, com ícone.
 *
 * Botões em vez de lista suspensa: no balcão a mão vai direto ao Pix sem
 * abrir menu, e o ícone é reconhecido antes de a palavra ser lida.
 */
function EscolhaDaForma({
  valor,
  destino,
  aoEscolher,
  contasPix,
}: {
  valor: string;
  destino: string;
  aoEscolher: (forma: string, destino: string) => void;
  contasPix: string[];
}) {
  // Uma conta de Pix por botão: a caixa escolhe forma e conta num toque só,
  // em vez de escolher Pix e depois procurar de quem é a chave.
  const botoes = FORMAS.flatMap((forma) =>
    forma.valor === 'PIX' && contasPix.length
      ? contasPix.map((conta) => ({ ...forma, rotulo: conta, destino: conta }))
      : [{ ...forma, destino: '' }],
  );

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      {botoes.map((forma) => {
        const escolhida = valor === forma.valor && destino === forma.destino;

        return (
          <button
            key={forma.valor + forma.destino}
            type="button"
            onClick={() => aoEscolher(forma.valor, forma.destino)}
            title={forma.rotulo}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-3 transition',
              escolhida
                ? 'border-accent bg-accent/10 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800',
            )}
          >
            {escolhida && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
              </span>
            )}

            <forma.icone
              className={cn('h-6 w-6', escolhida ? 'text-accent' : forma.cor)}
              strokeWidth={escolhida ? 2.4 : 1.8}
            />
            <span
              className={cn(
                'text-center text-xs font-semibold leading-tight',
                escolhida ? 'text-accent' : 'text-slate-600 dark:text-slate-400',
              )}
            >
              {forma.rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Monta o pagamento de uma venda, dividido ou não.
 *
 * Cada forma pergunta só o que precisa: Pix e dinheiro não têm parcela,
 * crédito abre a calculadora da maquininha, fiado abre a conta do que vai
 * ficar devendo. Mostrar tudo sempre é o que deixa o caixa lento.
 */
export function FormasDePagamento({
  dividido,
  aoDividir,
  formas,
  aoMudarFormas,
  formaUnica,
  aoMudarFormaUnica,
  destino = '',
  aoMudarDestino,
  parcelas,
  aoMudarParcelas,
  cobrado = '',
  aoMudarCobrado,
  bandeira = 'padrao',
  aoMudarBandeira,
  autorizacao = '',
  aoMudarAutorizacao,
  entrada = '',
  aoMudarEntrada,
  formaDaEntrada = 'PIX',
  aoMudarFormaDaEntrada,
  total,
}: {
  dividido: boolean;
  aoDividir: (v: boolean) => void;
  formas: FormaDePagamento[];
  aoMudarFormas: (f: FormaDePagamento[]) => void;
  formaUnica: string;
  aoMudarFormaUnica: (v: string) => void;
  /** Conta que recebeu, quando a forma tem mais de uma. */
  destino?: string;
  aoMudarDestino?: (v: string) => void;
  parcelas: string;
  aoMudarParcelas: (v: string) => void;
  /** O valor combinado no crédito, já com a taxa. */
  cobrado?: string;
  aoMudarCobrado?: (v: string) => void;
  /** Visa/Master ou Elo/Amex — muda a taxa que a maquininha cobra. */
  bandeira?: 'padrao' | 'elo';
  aoMudarBandeira?: (b: 'padrao' | 'elo') => void;
  /** Código do comprovante da maquininha. */
  autorizacao?: string;
  aoMudarAutorizacao?: (v: string) => void;
  /** Quanto o cliente adianta quando o resto fica em aberto. */
  entrada?: string;
  aoMudarEntrada?: (v: string) => void;
  formaDaEntrada?: string;
  aoMudarFormaDaEntrada?: (v: string) => void;
  /** Total da venda, para conferir o rateio. */
  total: number;
}) {
  const taxas = useTaxasDeCartao();
  const distribuido = somaDasFormas(formas);
  const falta = total - distribuido;

  const alterar = (i: number, mudanca: Partial<FormaDePagamento>) =>
    aoMudarFormas(formas.map((f, indice) => (indice === i ? { ...f, ...mudanca } : f)));

  const contasPix = useContasDePix();

  function escolher(valor: string, conta: string) {
    aoMudarFormaUnica(valor);
    aoMudarDestino?.(conta);
    // Forma sem parcelamento não pode carregar "6x" de uma escolha anterior.
    if (!aceitaParcelas(valor)) aoMudarParcelas('1');
  }

  function dividir() {
    aoDividir(true);
    // Primeira linha já com a forma escolhida e o total inteiro: quem só
    // quer separar em duas edita um valor e pronto.
    aoMudarFormas([
      { ...formaVazia(formaUnica), amount: total ? String(total.toFixed(2)) : '', installments: parcelas },
      formaVazia('DINHEIRO'),
    ]);
  }

  function juntar() {
    aoDividir(false);
    aoMudarFormas([]);
  }

  if (!dividido) {
    return (
      <div className="space-y-3">
        <EscolhaDaForma
          valor={formaUnica}
          destino={destino}
          aoEscolher={escolher}
          contasPix={contasPix}
        />

        {/* Parcelas vive dentro da calculadora: no crédito é lá que ela
            muda a taxa, e dois campos iguais na tela geram dúvida. */}
        {formaUnica === 'CREDITO' && (
          <CalculadoraDeCartao
            taxas={taxas}
            valorSugerido={total}
            parcelas={parcelas}
            aoMudarParcelas={aoMudarParcelas}
            cobrado={cobrado}
            aoMudarCobrado={aoMudarCobrado}
            bandeira={bandeira}
            aoMudarBandeira={aoMudarBandeira}
            autorizacao={autorizacao}
            aoMudarAutorizacao={aoMudarAutorizacao}
          />
        )}

        {formaUnica === 'EM_ABERTO' && aoMudarEntrada && (
          <EntradaComSaldo
            total={total}
            entrada={entrada}
            aoMudarEntrada={aoMudarEntrada}
            formaDaEntrada={formaDaEntrada}
            aoMudarFormaDaEntrada={aoMudarFormaDaEntrada ?? (() => {})}
          />
        )}

        <button
          type="button"
          onClick={dividir}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:border-accent hover:bg-accent/5 hover:text-accent dark:border-navy-600 dark:text-slate-400"
        >
          <Split className="h-4 w-4" />
          Dividir em mais de uma forma
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-navy-900 dark:text-slate-100">
          <Split className="h-4 w-4 text-accent" />
          Pagamento dividido
        </p>
        <button
          type="button"
          onClick={juntar}
          className="text-xs font-semibold text-slate-500 hover:underline dark:text-slate-400"
        >
          Voltar para uma forma só
        </button>
      </div>

      <div className="space-y-2.5">
        {formas.map((f, i) => {
          const info = infoDaForma(f.method);

          return (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-navy-700 dark:bg-navy-900"
            >
              <div className="flex items-center gap-2">
                <info.icone className={cn('h-5 w-5 shrink-0', info.cor)} />

                <Select
                  value={f.method}
                  onChange={(e) => {
                    const method = e.target.value;
                    // Trocar para uma forma sem parcela zera o parcelamento.
                    alterar(i, { method, ...(aceitaParcelas(method) ? {} : { installments: '1' }) });
                  }}
                  options={FORMAS.map((x) => ({ value: x.valor, label: x.rotulo }))}
                  wrapperClassName="flex-1"
                />

                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={f.amount}
                  onChange={(e) => alterar(i, { amount: e.target.value })}
                  wrapperClassName="w-32"
                />

                <button
                  type="button"
                  onClick={() => aoMudarFormas(formas.filter((_, indice) => indice !== i))}
                  disabled={formas.length <= 2}
                  className="rounded p-2 text-danger transition hover:bg-danger-bg disabled:opacity-30 dark:hover:bg-danger/15"
                  title={formas.length <= 2 ? 'Um pagamento dividido tem ao menos duas formas' : 'Remover'}
                  aria-label="Remover forma"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {f.method === 'PIX' && contasPix.length > 0 && (
                <div className="mt-2 pl-7">
                  <Select
                    label="Caiu em qual conta"
                    value={f.destino ?? ''}
                    onChange={(e) => alterar(i, { destino: e.target.value })}
                    options={contasPix.map((c) => ({ value: c, label: c }))}
                    placeholder="Escolha a conta"
                    wrapperClassName="max-w-[17rem]"
                  />
                </div>
              )}

              {aceitaParcelas(f.method) && (
                <div className="mt-2 pl-7">
                  <Select
                    label="Parcelas"
                    value={f.installments}
                    onChange={(e) => alterar(i, { installments: e.target.value })}
                    options={opcoesDeParcela(Number(f.amount) || 0)}
                    wrapperClassName="max-w-[17rem]"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        {formas.length < 6 && (
          <button
            type="button"
            onClick={() => aoMudarFormas([...formas, formaVazia('DINHEIRO')])}
            className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Mais uma forma
          </button>
        )}

        {/* O que falta some quando fecha: é o sinal de que pode finalizar. */}
        {Math.abs(falta) >= 0.01 && (
          <button
            type="button"
            onClick={() =>
              alterar(formas.length - 1, {
                amount: ((Number(formas[formas.length - 1].amount) || 0) + falta).toFixed(2),
              })
            }
            className="text-xs font-semibold text-accent hover:underline"
          >
            Jogar o resto na última
          </button>
        )}
      </div>

      {formas.some((f) => f.method === 'CREDITO') && (
        <div className="mt-3">
          <CalculadoraDeCartao
            taxas={taxas}
            valorSugerido={total}
            bandeira={bandeira}
            aoMudarBandeira={(b) => {
              aoMudarBandeira?.(b);
              // A bandeira muda a taxa da linha que já está preenchida.
              const i = formas.map((f) => f.method).lastIndexOf('CREDITO');
              if (i >= 0) alterar(i, { bandeira: b });
            }}
            aoUsar={(valor, parcelasDoCartao, taxa) => {
              // Preenche a última linha de crédito: é a que a pessoa
              // acabou de mexer na prática.
              const i = formas.map((f) => f.method).lastIndexOf('CREDITO');
              if (i >= 0) {
                alterar(i, {
                  amount: valor.toFixed(2),
                  installments: String(parcelasDoCartao),
                  feePercent: taxa,
                  bandeira,
                });
              }
            }}
          />
        </div>
      )}

      <div
        className={cn(
          'mt-3 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm',
          Math.abs(falta) < 0.01
            ? 'bg-success-bg text-success dark:bg-success/15'
            : 'bg-warning-bg text-warning dark:bg-warning/15',
        )}
      >
        <span className="font-semibold">
          {Math.abs(falta) < 0.01
            ? 'Fecha com o total da venda'
            : falta > 0
              ? 'Ainda falta distribuir'
              : 'Passou do total da venda'}
        </span>
        <strong>
          {Math.abs(falta) < 0.01
            ? formatCurrency(total)
            : `${formatCurrency(Math.abs(falta))} · de ${formatCurrency(total)}`}
        </strong>
      </div>
    </div>
  );
}

/**
 * O cliente leva agora e paga o resto depois.
 *
 * A conta é feita na tela e não de cabeça: quem digita já vê quanto fica
 * devendo, que é o número que o cliente pergunta e que vai virar cobrança.
 */
function EntradaComSaldo({
  total,
  entrada,
  aoMudarEntrada,
  formaDaEntrada,
  aoMudarFormaDaEntrada,
}: {
  total: number;
  entrada: string;
  aoMudarEntrada: (v: string) => void;
  formaDaEntrada: string;
  aoMudarFormaDaEntrada: (v: string) => void;
}) {
  const pago = Number(entrada) || 0;
  const resto = total - pago;
  const passou = pago > total;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning-bg/40 p-3 dark:bg-warning/10">
      <p className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-navy-900 dark:text-slate-100">
        <HandCoins className="h-4 w-4 text-warning" />
        Vai ficar devendo
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label="Valor da venda" value={formatCurrency(total)} readOnly hint="Soma dos produtos" />
        <Input
          label="Paga agora"
          type="number"
          min={0}
          step="0.01"
          value={entrada}
          onChange={(e) => aoMudarEntrada(e.target.value)}
          placeholder="0,00"
          hint="Zero se levar tudo fiado"
        />
        <Select
          label="Como paga a entrada"
          value={formaDaEntrada}
          onChange={(e) => aoMudarFormaDaEntrada(e.target.value)}
          options={FORMAS.filter((f) => f.valor !== 'EM_ABERTO').map((f) => ({
            value: f.valor,
            label: f.rotulo,
          }))}
          disabled={pago <= 0}
        />
      </div>

      <div
        className={cn(
          'mt-3 flex items-center justify-between rounded-lg px-3 py-2.5',
          passou ? 'bg-danger-bg dark:bg-danger/15' : 'bg-navy-900 text-white dark:bg-navy-800',
        )}
      >
        <span className={cn('text-sm font-semibold', passou && 'text-danger')}>
          {passou ? 'A entrada passou do valor da venda' : 'Fica em aberto'}
        </span>
        <strong className={cn('text-2xl font-extrabold', passou && 'text-danger')}>
          {formatCurrency(Math.abs(resto))}
        </strong>
      </div>

      {!passou && resto > 0 && (
        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
          Vai para <strong>Valores em aberto</strong> no nome do cliente. Nome e telefone são
          obrigatórios nesse caso.
        </p>
      )}
    </div>
  );
}

/** Traduz o que está na tela para o que a API espera. Null = forma única. */
export function paraApi(dividido: boolean, formas: FormaDePagamento[]) {
  if (!dividido) return undefined;

  return formas
    .filter((f) => (Number(f.amount) || 0) > 0)
    .map((f) => ({
      method: f.method,
      amount: Number(f.amount),
      installments: Number(f.installments) || 1,
      notes: f.notes.trim() || null,
      destino: f.destino?.trim() || null,
      // Só o crédito tem taxa; nas outras formas o líquido é o próprio valor.
      feePercent: f.method === 'CREDITO' ? (f.feePercent ?? null) : null,
      bandeira: f.method === 'CREDITO' ? (f.bandeira ?? 'padrao') : null,
      autorizacao: f.autorizacao?.trim() || null,
    }));
}
