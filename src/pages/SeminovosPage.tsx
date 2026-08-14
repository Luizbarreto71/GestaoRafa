import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import { useDebounce } from '@/hooks/useDebounce';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate } from '@/lib/format';
import { pode } from '@/lib/permissoes';
import { ARMAZENAMENTOS } from '@shared/trocas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Repeat2, Search, ShoppingBag, Smartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';

type Seminovo = {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  capacity?: string | null;
  imei?: string | null;
  costPrice: number;
  salePrice: number;
  notes?: string | null;
  createdAt: string;
  quantidade: number;
  origem: 'troca' | 'compra';
  seminovoOrigem?: string | null;
  category?: { id: string; name: string } | null;
  stock?: { unitId: string; quantity: number; unit?: { name: string } | null }[];
  tradeInAparelho?: {
    estado?: string | null;
    defeitos: string[];
    tradeIn?: { code: string; customerName: string } | null;
  } | null;
};

type Resposta = {
  data: Seminovo[];
  meta: { total: number };
  resumo: { pecas: number; investido: number };
};

const VAZIO = {
  modelo: '',
  marca: '',
  armazenamento: '',
  cor: '',
  imei: '',
  valorPago: '',
  salePrice: '',
  unitId: '',
  vendedor: '',
  observacoes: '',
};

/**
 * Os aparelhos usados que a loja tem.
 *
 * Não é um estoque paralelo: cada um destes é um produto normal, que já
 * está na prateleira e é vendido como qualquer outro. Esta tela existe
 * para responder a pergunta que o estoque geral não responde — quanto de
 * usado entrou, de onde veio e quanto a loja pagou por ele.
 */
export default function SeminovosPage() {
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState('');
  const [unitId, setUnitId] = useState('');
  const [cadastrando, setCadastrando] = useState(false);

  const termo = useDebounce(busca, 300);
  const { user } = useAuth();
  const { unidades } = useUnit();
  const podeCadastrar = pode(user?.role, 'produtos.editar');

  const { data, isLoading } = useQuery({
    queryKey: ['seminovos', termo, origem, unitId],
    queryFn: async () => {
      const { data } = await api.get<Resposta>('/seminovos', {
        params: {
          ...(termo ? { search: termo } : {}),
          ...(origem ? { origem } : {}),
          ...(unitId ? { unitId } : {}),
          pageSize: 60,
        },
      });
      return data;
    },
  });

  const lista = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            <Smartphone className="h-6 w-6 text-accent" />
            Seminovos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aparelhos usados que entraram por troca ou compra. Continuam no estoque normalmente.
          </p>
        </div>

        {podeCadastrar && (
          <Button onClick={() => setCadastrando(true)} icon={<Plus className="h-4 w-4" />}>
            Comprei um aparelho
          </Button>
        )}
      </div>

      {/* ------------------------------------------------------------ resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { rotulo: 'Aparelhos cadastrados', valor: String(data?.meta.total ?? 0) },
          { rotulo: 'Peças na prateleira', valor: String(data?.resumo.pecas ?? 0) },
          { rotulo: 'Investido em usados', valor: formatCurrency(data?.resumo.investido ?? 0) },
        ].map((c) => (
          <Card key={c.rotulo}>
            <CardBody className="py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.rotulo}</p>
              <p className="mt-1 text-2xl font-extrabold text-navy-900 dark:text-slate-50">{c.valor}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* ------------------------------------------------------------ filtros */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Modelo, cor, IMEI ou de quem veio…"
          icon={<Search className="h-4 w-4" />}
        />
        <Select
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          options={[
            { value: 'troca', label: 'Vieram de troca' },
            { value: 'compra', label: 'Comprados' },
          ]}
          placeholder="Toda origem"
        />
        <Select
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          options={unidades.map((u) => ({ value: u.id, label: u.name }))}
          placeholder="Todas as unidades"
        />
      </div>

      {/* -------------------------------------------------------------- lista */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Carregando…</p>
      ) : lista.length === 0 ? (
        <Card>
          <CardBody className="py-14 text-center">
            <Smartphone className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-navy-900 dark:text-slate-100">Nenhum seminovo por aqui</p>
            <p className="mt-1 text-sm text-slate-500">
              Todo aparelho recebido em troca entra sozinho nesta lista. Os comprados sem troca você
              cadastra no botão acima.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((s) => (
            <Card key={s.id}>
              <CardBody className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy-900 dark:text-slate-100">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[s.color, s.capacity, s.brand].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <Badge tone={s.origem === 'troca' ? 'info' : 'neutral'}>
                    {s.origem === 'troca' ? (
                      <span className="flex items-center gap-1">
                        <Repeat2 className="h-3 w-3" /> troca
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" /> compra
                      </span>
                    )}
                  </Badge>
                </div>

                {s.imei && (
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">IMEI {s.imei}</p>
                )}

                {s.tradeInAparelho?.defeitos?.length ? (
                  <p className="text-xs text-warning">
                    {s.tradeInAparelho.defeitos.length} defeito(s) anotado(s) na troca
                  </p>
                ) : null}

                <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-2 dark:border-navy-800">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Pagamos</p>
                    <p className="font-bold text-navy-900 dark:text-slate-100">
                      {formatCurrency(s.costPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {s.salePrice > 0 ? 'Vende por' : 'Sem preço'}
                    </p>
                    <p
                      className={cn(
                        'font-bold',
                        s.salePrice > 0 ? 'text-success' : 'text-warning',
                      )}
                    >
                      {s.salePrice > 0 ? formatCurrency(s.salePrice) : 'a definir'}
                    </p>
                  </div>
                  <Badge tone={s.quantidade > 0 ? 'success' : 'neutral'}>
                    {s.quantidade > 0 ? `${s.quantidade} em estoque` : 'vendido'}
                  </Badge>
                </div>

                <p className="truncate text-[11px] text-slate-400">
                  {s.seminovoOrigem ?? '—'} · {formatDate(s.createdAt)}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <FormularioDeCompra aberto={cadastrando} aoFechar={() => setCadastrando(false)} />
    </div>
  );
}

/** Cadastro do aparelho que a loja comprou sem ser em troca. */
function FormularioDeCompra({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [form, setForm] = useState(VAZIO);
  const toast = useToast();
  const { unidades } = useUnit();
  const queryClient = useQueryClient();

  const alterar = (campo: keyof typeof VAZIO, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const criar = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ message: string }>('/seminovos', {
        modelo: form.modelo,
        marca: form.marca || null,
        armazenamento: form.armazenamento || null,
        cor: form.cor || null,
        imei: form.imei.replace(/\D/g, '') || null,
        valorPago: Number(form.valorPago) || 0,
        salePrice: Number(form.salePrice) || 0,
        unitId: form.unitId || unidades[0]?.id,
        vendedor: form.vendedor || null,
        observacoes: form.observacoes || null,
      });
      return data;
    },
    onSuccess: (r) => {
      toast.success('Seminovo cadastrado', r.message);
      void queryClient.invalidateQueries({ queryKey: ['seminovos'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setForm(VAZIO);
      aoFechar();
    },
    onError: (e) => toast.error('Não foi possível cadastrar', getErrorMessage(e)),
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!form.modelo.trim()) return toast.warning('Informe o modelo do aparelho');
    if (!(Number(form.valorPago) || 0)) return toast.warning('Informe quanto a loja pagou');
    criar.mutate();
  }

  return (
    <Modal
      open={aberto}
      onClose={aoFechar}
      title="Aparelho comprado"
      description="Usado que a loja comprou sem ser em troca"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-seminovo"
            loading={criar.isPending}
            icon={<Check className="h-4 w-4" />}
          >
            Cadastrar
          </Button>
        </>
      }
    >
      <form id="form-seminovo" onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Modelo"
            required
            value={form.modelo}
            onChange={(e) => alterar('modelo', e.target.value)}
            placeholder="iPhone 13 Pro"
            autoFocus
          />
          <Input
            label="Marca"
            value={form.marca}
            onChange={(e) => alterar('marca', e.target.value)}
            placeholder="Apple"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Input
              label="Armazenamento"
              value={form.armazenamento}
              onChange={(e) => alterar('armazenamento', e.target.value)}
              placeholder="256GB"
              list="gigas-seminovo"
            />
            <datalist id="gigas-seminovo">
              {ARMAZENAMENTOS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <Input
            label="Cor"
            value={form.cor}
            onChange={(e) => alterar('cor', e.target.value)}
            placeholder="Grafite"
          />
        </div>

        <Input
          label="IMEI"
          inputMode="numeric"
          value={form.imei}
          onChange={(e) => alterar('imei', e.target.value)}
          placeholder="15 números"
          hint={`${form.imei.replace(/\D/g, '').length}/15 · opcional, mas é o que identifica a peça`}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Quanto a loja pagou"
            type="number"
            min={0}
            step="0.01"
            required
            value={form.valorPago}
            onChange={(e) => alterar('valorPago', e.target.value)}
          />
          <Input
            label="Por quanto vai vender"
            type="number"
            min={0}
            step="0.01"
            value={form.salePrice}
            onChange={(e) => alterar('salePrice', e.target.value)}
            hint="Pode ficar para depois"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Onde o aparelho ficou"
            value={form.unitId || unidades[0]?.id || ''}
            onChange={(e) => alterar('unitId', e.target.value)}
            options={unidades.map((u) => ({ value: u.id, label: u.name }))}
          />
          <Input
            label="Comprado de quem"
            value={form.vendedor}
            onChange={(e) => alterar('vendedor', e.target.value)}
            placeholder="Nome de quem vendeu"
            hint="Serve para achar o dono se aparecer problema"
          />
        </div>

        <Input
          label="Observações"
          value={form.observacoes}
          onChange={(e) => alterar('observacoes', e.target.value)}
          placeholder="Bateria 89%, acompanha caixa…"
        />
      </form>
    </Modal>
  );
}
