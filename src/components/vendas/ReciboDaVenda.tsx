import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Check, Download, Loader2, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Lembra a escolha do caixa entre uma venda e outra. */
const CHAVE = 'recibo:auto';

export const imprimirSempre = () => localStorage.getItem(CHAVE) === 'true';

/**
 * Manda o comprovante para a impressora sem sair da tela.
 *
 * O PDF é buscado com o token e exibido num quadro escondido: abrir uma
 * aba nova faria o caixa perder o balcão de vista e depender de o
 * navegador não bloquear a janela.
 */
async function imprimir(vendaId: string): Promise<void> {
  const { data } = await api.get(`/sales/${vendaId}/recibo`, { responseType: 'blob' });
  const url = URL.createObjectURL(data as Blob);

  const quadro = document.createElement('iframe');
  quadro.style.position = 'fixed';
  quadro.style.right = '0';
  quadro.style.bottom = '0';
  quadro.style.width = '0';
  quadro.style.height = '0';
  quadro.style.border = '0';
  quadro.src = url;

  await new Promise<void>((resolve) => {
    quadro.onload = () => {
      try {
        quadro.contentWindow?.focus();
        quadro.contentWindow?.print();
      } catch {
        // Navegador que não deixa imprimir de dentro do quadro: abre o PDF.
        window.open(url, '_blank', 'noopener');
      }
      resolve();
    };
    document.body.appendChild(quadro);
  });

  // Só limpa depois: remover cedo demais cancela a impressão em andamento.
  setTimeout(() => {
    quadro.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

async function baixar(vendaId: string, codigo: string): Promise<void> {
  const { data } = await api.get(`/sales/${vendaId}/recibo`, { responseType: 'blob' });
  const url = URL.createObjectURL(data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `recibo-${codigo}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Confirmação da venda com o comprovante à mão.
 *
 * Aparece assim que a venda fecha, porque é o único momento em que o
 * cliente ainda está no balcão para receber o papel.
 */
export function ReciboDaVenda({
  venda,
  aoFechar,
}: {
  venda: { id: string; code: string; totalAmount: number } | null;
  aoFechar: () => void;
}) {
  const [auto, setAuto] = useState(imprimirSempre);
  const [ocupado, setOcupado] = useState<'imprimir' | 'baixar' | null>(null);
  const jaImprimiu = useRef<string | null>(null);
  const toast = useToast();

  async function acionar(acao: 'imprimir' | 'baixar') {
    if (!venda) return;
    setOcupado(acao);
    try {
      if (acao === 'imprimir') await imprimir(venda.id);
      else await baixar(venda.id, venda.code);
    } catch {
      toast.error('Não foi possível gerar o comprovante');
    } finally {
      setOcupado(null);
    }
  }

  // Impressão automática: uma vez por venda, nunca de novo ao redesenhar.
  useEffect(() => {
    if (!venda || !auto || jaImprimiu.current === venda.id) return;
    jaImprimiu.current = venda.id;
    void acionar('imprimir');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venda?.id, auto]);

  function alternarAuto(ligado: boolean) {
    setAuto(ligado);
    localStorage.setItem(CHAVE, String(ligado));
  }

  return (
    <Modal
      open={Boolean(venda)}
      onClose={aoFechar}
      title="Venda registrada"
      description={venda?.code}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => void acionar('baixar')}
            disabled={Boolean(ocupado)}
            icon={
              ocupado === 'baixar' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )
            }
          >
            Baixar PDF
          </Button>
          <Button
            onClick={() => void acionar('imprimir')}
            disabled={Boolean(ocupado)}
            icon={
              ocupado === 'imprimir' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )
            }
          >
            Imprimir recibo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg dark:bg-success/15">
            <Check className="h-6 w-6 text-success" strokeWidth={3} />
          </span>
          <p className="text-3xl font-extrabold text-navy-900 dark:text-slate-50">
            {formatCurrency(venda?.totalAmount ?? 0)}
          </p>
          <p className="font-mono text-sm text-slate-500 dark:text-slate-400">{venda?.code}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm dark:bg-navy-800">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => alternarAuto(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-accent"
          />
          <span className="text-slate-600 dark:text-slate-400">
            Imprimir automaticamente a cada venda
            <span className="block text-xs text-slate-400">
              Vale só neste computador — cada caixa escolhe o seu
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
