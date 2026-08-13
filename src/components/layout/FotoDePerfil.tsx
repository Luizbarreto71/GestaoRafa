import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Camera, Trash2, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';

/** O tamanho que a foto passa a ter no banco — círculo pequeno, nada além. */
const LADO = 256;

/**
 * Reduz e corta a imagem no navegador, antes de subir.
 *
 * A foto do celular tem vários megabytes e vira um círculo de 40 pixels na
 * tela. Mandar o arquivo inteiro entope o banco e a conexão sem melhorar
 * nada — e a conexão é justamente o que a loja tem de mais escasso.
 */
function prepararImagem(arquivo: File): Promise<string> {
  return new Promise((resolver, recusar) => {
    const leitor = new FileReader();
    leitor.onerror = () => recusar(new Error('Não deu para ler o arquivo'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => recusar(new Error('Esse arquivo não é uma imagem'));
      img.onload = () => {
        // Corte quadrado pelo centro: é assim que ela vai aparecer.
        const lado = Math.min(img.width, img.height);
        const tela = document.createElement('canvas');
        tela.width = LADO;
        tela.height = LADO;

        const ctx = tela.getContext('2d');
        if (!ctx) return recusar(new Error('Não deu para preparar a imagem'));

        ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
        resolver(tela.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}

/** O círculo com a foto, ou a inicial de quem ainda não pôs uma. */
export function Avatar({
  nome,
  foto,
  tamanho = 36,
  className,
}: {
  nome?: string | null;
  foto?: string | null;
  tamanho?: number;
  className?: string;
}) {
  const estilo = { width: tamanho, height: tamanho };

  if (foto) {
    return (
      <img
        src={foto}
        alt={nome ?? 'Foto de perfil'}
        style={estilo}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <div
      style={estilo}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-accent/20 font-bold text-accent-soft',
        className,
      )}
    >
      {nome?.charAt(0).toUpperCase() ?? <UserRound className="h-1/2 w-1/2" />}
    </div>
  );
}

/**
 * Troca a foto de perfil de quem está logado.
 *
 * Cada pessoa muda a sua — não passa pelo administrador. Quem opera o
 * balcão precisa se reconhecer na tela em que passa o dia.
 */
export function FotoDePerfil({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);

  async function escolher(arquivo?: File) {
    if (!arquivo) return;
    try {
      setPrevia(await prepararImagem(arquivo));
    } catch (erro) {
      toast.error('Não deu para usar essa imagem', getErrorMessage(erro));
    }
  }

  async function salvar() {
    if (!previa) return;
    setEnviando(true);
    try {
      await api.put('/auth/me/foto', { foto: previa });
      await refreshUser();
      toast.success('Foto atualizada');
      setPrevia(null);
      aoFechar();
    } catch (erro) {
      toast.error('Não foi possível salvar', getErrorMessage(erro));
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    setEnviando(true);
    try {
      await api.delete('/auth/me/foto');
      await refreshUser();
      toast.success('Foto removida');
      setPrevia(null);
      aoFechar();
    } catch (erro) {
      toast.error('Não foi possível remover', getErrorMessage(erro));
    } finally {
      setEnviando(false);
    }
  }

  const mostrando = previa ?? user?.foto ?? null;

  return (
    <Modal
      open={aberto}
      onClose={() => {
        setPrevia(null);
        aoFechar();
      }}
      title="Sua foto"
      description="Aparece na barra lateral e para quem administra o sistema"
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              setPrevia(null);
              aoFechar();
            }}
          >
            Fechar
          </Button>
          {user?.foto && !previa && (
            <Button
              variant="ghost"
              className="text-danger"
              loading={enviando}
              onClick={() => void remover()}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Remover
            </Button>
          )}
          <Button disabled={!previa} loading={enviando} onClick={() => void salvar()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-5 py-2">
        <Avatar nome={user?.name} foto={mostrando} tamanho={132} className="text-4xl" />

        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void escolher(e.target.files?.[0])}
        />

        <Button variant="outline" onClick={() => entrada.current?.click()} icon={<Camera className="h-4 w-4" />}>
          {mostrando ? 'Escolher outra' : 'Escolher foto'}
        </Button>

        <p className="max-w-xs text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          A imagem é cortada em quadrado pelo centro e reduzida antes de subir — pode mandar a
          foto direto do celular.
        </p>
      </div>
    </Modal>
  );
}
