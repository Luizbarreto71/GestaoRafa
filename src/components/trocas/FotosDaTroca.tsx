import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/cn';
import { Camera, FileCheck2, IdCard, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';

type Tipo = 'ANATEL' | 'DOCUMENTO' | 'APARELHO';
type Foto = { tipo: Tipo; data: string };

const LADO_MAXIMO = 1200;
const QUALIDADE = 0.82;

const GRUPOS: { tipo: Tipo; rotulo: string; ajuda: string; icone: typeof Camera; max: number }[] = [
  {
    tipo: 'ANATEL',
    rotulo: 'Print da Anatel',
    ajuda: 'A tela do resultado da consulta',
    icone: FileCheck2,
    max: 2,
  },
  {
    tipo: 'DOCUMENTO',
    rotulo: 'Documento do cliente',
    ajuda: 'RG ou CNH com foto',
    icone: IdCard,
    max: 2,
  },
  {
    tipo: 'APARELHO',
    rotulo: 'O aparelho',
    ajuda: 'Frente, traseira e o que estiver avariado',
    icone: Camera,
    max: 6,
  },
];

/**
 * Reduz a foto no próprio navegador antes de enviar.
 *
 * Mesma conta das fotos de produto: 4MB da câmera do celular viram ~150KB,
 * e o upload continua rápido na internet da loja.
 */
function reduzirImagem(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onerror = () => reject(new Error('Não consegui ler o arquivo'));
    leitor.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('Arquivo de imagem inválido'));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Navegador não suporta redimensionar imagens'));

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', QUALIDADE));
      };

      img.src = leitor.result as string;
    };

    leitor.readAsDataURL(arquivo);
  });
}

/**
 * Fotos da troca, separadas por finalidade.
 *
 * São três coisas diferentes e não podem virar um monte só: meses depois,
 * quem procura o comprovante da Anatel precisa achá-lo sem abrir seis fotos.
 */
export function FotosDaTroca({
  valor,
  aoMudar,
}: {
  valor: Foto[];
  aoMudar: (fotos: Foto[]) => void;
}) {
  const [processando, setProcessando] = useState<Tipo | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const toast = useToast();

  async function adicionar(tipo: Tipo, lista: FileList | null, max: number) {
    if (!lista?.length) return;

    const jaTem = valor.filter((f) => f.tipo === tipo).length;
    const arquivos = Array.from(lista).slice(0, max - jaTem);
    if (!arquivos.length) return toast.warning(`Limite de ${max} foto(s) aqui`);

    setProcessando(tipo);
    try {
      const reduzidas = await Promise.all(arquivos.map(reduzirImagem));
      aoMudar([...valor, ...reduzidas.map((data) => ({ tipo, data }))]);
    } catch (erro) {
      toast.error('Não consegui carregar a foto', erro instanceof Error ? erro.message : undefined);
    } finally {
      setProcessando(null);
      const input = refs.current[tipo];
      if (input) input.value = '';
    }
  }

  const remover = (foto: Foto) => aoMudar(valor.filter((f) => f !== foto));

  return (
    <div className="space-y-3">
      {GRUPOS.map((grupo) => {
        const minhas = valor.filter((f) => f.tipo === grupo.tipo);

        return (
          <div key={grupo.tipo}>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <grupo.icone className="h-3.5 w-3.5" />
              {grupo.rotulo}
              <span className="font-normal text-slate-400">· {grupo.ajuda}</span>
            </p>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {minhas.map((foto, i) => (
                <div
                  key={foto.data.slice(0, 48) + i}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-navy-600"
                >
                  <img src={foto.data} alt={grupo.rotulo} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => remover(foto)}
                    className="absolute inset-0 flex items-center justify-center bg-navy-950/60 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remover foto"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}

              {minhas.length < grupo.max && (
                <button
                  type="button"
                  onClick={() => refs.current[grupo.tipo]?.click()}
                  disabled={processando === grupo.tipo}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-lg border-2 border-dashed transition',
                    'border-slate-300 hover:border-accent hover:bg-slate-50 dark:border-navy-600 dark:hover:bg-navy-800',
                  )}
                >
                  {processando === grupo.tipo ? (
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  ) : (
                    <grupo.icone className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              )}
            </div>

            <input
              ref={(el) => {
                refs.current[grupo.tipo] = el;
              }}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void adicionar(grupo.tipo, e.target.files, grupo.max)}
            />
          </div>
        );
      })}
    </div>
  );
}
