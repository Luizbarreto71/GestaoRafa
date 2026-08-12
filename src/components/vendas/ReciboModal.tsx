import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import type { Sale } from '@/types';
import { Download, Loader2, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Mostra o comprovante da venda na tela, do jeito que sai no papel.
 *
 * Exibe o próprio PDF, e não uma cópia em HTML: um comprovante que aparece
 * diferente do que imprime não serve para conferir nada.
 */
export function ReciboModal({ venda, aoFechar }: { venda: Sale | null; aoFechar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const quadro = useRef<HTMLIFrameElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!venda) return;

    let cancelado = false;
    let criada: string | null = null;

    setUrl(null);
    setErro(false);

    api
      .get(`/sales/${venda.id}/recibo`, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelado) return;
        criada = URL.createObjectURL(data as Blob);
        setUrl(criada);
      })
      .catch(() => !cancelado && setErro(true));

    return () => {
      cancelado = true;
      // Só depois de trocar de venda: revogar antes deixa o quadro vazio.
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [venda?.id]);

  function imprimir() {
    try {
      quadro.current?.contentWindow?.focus();
      quadro.current?.contentWindow?.print();
    } catch {
      // Navegador que não deixa imprimir de dentro do quadro: abre o PDF.
      if (url) window.open(url, '_blank', 'noopener');
    }
  }

  async function baixar() {
    if (!venda) return;
    setBaixando(true);
    try {
      const { data } = await api.get(`/sales/${venda.id}/recibo`, { responseType: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(data as Blob);
      link.download = `recibo-${venda.code}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Não foi possível baixar o comprovante');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Modal
      open={Boolean(venda)}
      onClose={aoFechar}
      title={`Comprovante ${venda?.code ?? ''}`}
      description={venda?.customerName ?? 'Consumidor não identificado'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => void baixar()}
            disabled={!url || baixando}
            icon={baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          >
            Baixar PDF
          </Button>
          <Button onClick={imprimir} disabled={!url} icon={<Printer className="h-4 w-4" />}>
            Imprimir
          </Button>
        </>
      }
    >
      <div className="h-[70vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-navy-700 dark:bg-navy-800">
        {erro && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-danger">
            Não foi possível carregar o comprovante desta venda.
          </div>
        )}

        {!erro && !url && (
          <div className="flex h-full items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Montando o comprovante…
          </div>
        )}

        {url && (
          <iframe
            ref={quadro}
            src={url}
            title={`Comprovante ${venda?.code ?? ''}`}
            className="h-full w-full"
          />
        )}
      </div>
    </Modal>
  );
}
