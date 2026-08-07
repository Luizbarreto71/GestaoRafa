import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/cn';
import { ImagePlus, Loader2, Star, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface PhotoUploaderProps {
  value: string[];
  onChange: (fotos: string[]) => void;
  max?: number;
}

/** Maior lado da imagem depois de reduzida. */
const LADO_MAXIMO = 1200;
const QUALIDADE = 0.82;

/**
 * Reduz a foto no próprio navegador antes de enviar.
 *
 * É o que permite guardar as imagens no banco: uma foto de 4MB da câmera do
 * celular vira ~150KB, e o upload fica rápido mesmo em internet ruim.
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

/** Fotos do produto. A primeira é a que aparece na listagem. */
export function PhotoUploader({ value, onChange, max = 6 }: PhotoUploaderProps) {
  const [processando, setProcessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function adicionar(lista: FileList | null) {
    if (!lista?.length) return;

    const arquivos = Array.from(lista).slice(0, max - value.length);
    if (!arquivos.length) {
      toast.warning(`Limite de ${max} fotos atingido`);
      return;
    }

    setProcessando(true);
    try {
      const reduzidas = await Promise.all(arquivos.map(reduzirImagem));
      onChange([...value, ...reduzidas]);
      toast.success(`${reduzidas.length} foto(s) adicionada(s)`, 'Serão salvas junto com o produto.');
    } catch (erro) {
      toast.error('Não consegui carregar a foto', erro instanceof Error ? erro.message : undefined);
    } finally {
      setProcessando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const remover = (foto: string) => onChange(value.filter((f) => f !== foto));
  const tornarPrincipal = (foto: string) => onChange([foto, ...value.filter((f) => f !== foto)]);

  return (
    <div>
      <label className="label-base">Fotos do produto</label>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((foto, indice) => (
          <div
            key={foto.slice(0, 64) + indice}
            className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-navy-600 dark:bg-navy-800"
          >
            <img src={foto} alt={`Foto ${indice + 1}`} className="h-full w-full object-cover" loading="lazy" />

            {indice === 0 && (
              <span className="absolute left-1 top-1 rounded bg-navy-900/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                Principal
              </span>
            )}

            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-navy-950/60 opacity-0 transition group-hover:opacity-100">
              {indice !== 0 && (
                <button
                  type="button"
                  onClick={() => tornarPrincipal(foto)}
                  className="rounded-full bg-white/90 p-1.5 text-warning transition hover:bg-white"
                  title="Definir como principal"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => remover(foto)}
                className="rounded-full bg-white/90 p-1.5 text-danger transition hover:bg-white"
                title="Remover foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              void adicionar(e.dataTransfer.files);
            }}
            disabled={processando}
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition',
              arrastando
                ? 'border-accent bg-accent/5'
                : 'border-slate-300 hover:border-accent hover:bg-slate-50 dark:border-navy-600 dark:hover:bg-navy-800',
            )}
          >
            {processando ? (
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            ) : (
              <ImagePlus className="h-5 w-5 text-slate-400" />
            )}
            <span className="px-1 text-center text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {processando ? 'Preparando…' : 'Adicionar'}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void adicionar(e.target.files)}
      />

      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        Máximo de {max} fotos. As imagens são reduzidas automaticamente antes de salvar.
      </p>
    </div>
  );
}
