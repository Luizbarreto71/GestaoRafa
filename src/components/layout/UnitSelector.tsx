import { useUnit } from '@/contexts/UnitContext';
import { cn } from '@/lib/cn';
import { Building2, Check, ChevronDown, Store } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Escolhe qual unidade está sendo olhada.
 *
 * Para gerente e vendedor não é um seletor: é só a etiqueta da unidade
 * deles, já que não podem trocar.
 */
export function UnitSelector() {
  const { unidades, unidadeId, definirUnidade, podeTrocar, rotulo, carregando } = useUnit();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  if (carregando || !unidades.length) return null;

  const Icone = unidadeId ? Store : Building2;

  if (!podeTrocar) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-navy-800">
        <Icone className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <span className="text-sm font-semibold text-navy-900 dark:text-slate-100">{rotulo}</span>
      </div>
    );
  }

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy-900 transition hover:bg-slate-50 dark:border-navy-600 dark:text-slate-100 dark:hover:bg-navy-800"
      >
        <Icone className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <span className="max-w-[9rem] truncate">{rotulo}</span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-11 z-50 w-56 animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-modal dark:border-navy-700 dark:bg-navy-800">
          <Opcao
            rotulo="Todas as unidades"
            descricao="Visão consolidada"
            icone={<Building2 className="h-4 w-4" />}
            marcada={unidadeId === null}
            aoEscolher={() => {
              definirUnidade(null);
              setAberto(false);
            }}
          />

          <div className="my-1 border-t border-slate-200 dark:border-navy-700" />

          {unidades.map((u) => (
            <Opcao
              key={u.id}
              rotulo={u.name}
              descricao={u.type === 'MATRIZ' ? 'Matriz' : 'Filial'}
              icone={<Store className="h-4 w-4" />}
              marcada={unidadeId === u.id}
              aoEscolher={() => {
                definirUnidade(u.id);
                setAberto(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Opcao({
  rotulo,
  descricao,
  icone,
  marcada,
  aoEscolher,
}: {
  rotulo: string;
  descricao: string;
  icone: React.ReactNode;
  marcada: boolean;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition',
        marcada ? 'bg-accent/10' : 'hover:bg-slate-100 dark:hover:bg-navy-700',
      )}
    >
      <span className={cn('shrink-0', marcada ? 'text-accent' : 'text-slate-400')}>{icone}</span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm font-semibold',
            marcada ? 'text-accent' : 'text-navy-900 dark:text-slate-100',
          )}
        >
          {rotulo}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{descricao}</span>
      </span>
      {marcada && <Check className="h-4 w-4 shrink-0 text-accent" />}
    </button>
  );
}
