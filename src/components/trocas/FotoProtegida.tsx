import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ImageOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Foto de troca, buscada com o token do usuário.
 *
 * Não dá para usar `<img src="/api/…">` aqui: a tag não manda o cabeçalho
 * de autenticação, e estas imagens incluem o documento do cliente — a rota
 * não pode ficar aberta como a das fotos de produto.
 */
export function FotoProtegida({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className?: string;
}) {
  const [blob, setBlob] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    let criada = '';

    api
      .get(url, { responseType: 'blob' })
      .then((r) => {
        if (!vivo) return;
        criada = URL.createObjectURL(r.data as Blob);
        setBlob(criada);
      })
      .catch(() => vivo && setErro(true));

    return () => {
      vivo = false;
      // Sem isto o navegador segura a imagem na memória para sempre.
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [url]);

  if (erro) {
    return (
      <div className={cn('flex items-center justify-center bg-slate-100 dark:bg-navy-800', className)}>
        <ImageOff className="h-4 w-4 text-slate-400" />
      </div>
    );
  }

  if (!blob) {
    return (
      <div className={cn('flex items-center justify-center bg-slate-100 dark:bg-navy-800', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.open(blob, '_blank', 'noopener')}
      className={cn('block overflow-hidden', className)}
      title={`${alt} — clique para ver maior`}
    >
      <img src={blob} alt={alt} className="h-full w-full object-cover" />
    </button>
  );
}
