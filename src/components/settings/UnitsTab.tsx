import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCrudMutation, useUnits } from '@/hooks/queries';
import { unitService } from '@/services';
import type { Unit } from '@/types';
import { Building2, Pencil, Plus, ShieldCheck, Store, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

const VAZIO = { name: '', type: 'FILIAL' as 'MATRIZ' | 'FILIAL', active: true };

/** Cadastro das lojas. Cada uma tem seu estoque, independente das outras. */
export function UnitsTab() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data: unidades, isLoading } = useUnits();

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Unit | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [excluindo, setExcluindo] = useState<Unit | null>(null);

  const salvar = useCrudMutation(
    (v: { id?: string; data: Record<string, unknown> }) =>
      v.id ? unitService.update(v.id, v.data) : unitService.create(v.data),
    'units',
  );
  const remover = useCrudMutation((id: string) => unitService.remove(id), 'units');

  if (!isAdmin) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Apenas administradores podem gerenciar as unidades.
          </p>
        </div>
      </Card>
    );
  }

  function abrir(unidade?: Unit) {
    setEditando(unidade ?? null);
    setForm(unidade ? { name: unidade.name, type: unidade.type, active: unidade.active } : VAZIO);
    setFormOpen(true);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.warning('Informe o nome da unidade');

    try {
      await salvar.mutateAsync({ id: editando?.id, data: { ...form, name: form.name.trim() } });
      toast.success(editando ? 'Unidade atualizada' : 'Unidade criada');
      setFormOpen(false);
    } catch (erro) {
      toast.error('Não foi possível salvar', erro instanceof Error ? erro.message : undefined);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    try {
      const r = await remover.mutateAsync(excluindo.id);
      toast.success(r.deactivated ? 'Unidade desativada' : 'Unidade excluída', r.message);
      setExcluindo(null);
    } catch (erro) {
      toast.error('Não foi possível excluir', erro instanceof Error ? erro.message : undefined);
    }
  }

  const colunas: TableColumn<Unit>[] = [
    {
      key: 'name',
      header: 'Unidade',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400">
            {u.type === 'MATRIZ' ? <Building2 className="h-4 w-4" /> : <Store className="h-4 w-4" />}
          </div>
          <div>
            <p className="font-semibold text-navy-900 dark:text-slate-100">{u.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {u.type === 'MATRIZ' ? 'Matriz' : 'Filial'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Produtos com estoque',
      align: 'center',
      render: (u) => (
        <span className="font-semibold text-navy-900 dark:text-slate-100">{u._count?.stock ?? 0}</span>
      ),
    },
    {
      key: 'sales',
      header: 'Vendas',
      align: 'center',
      render: (u) => (
        <span className="font-semibold text-navy-900 dark:text-slate-100">{u._count?.sales ?? 0}</span>
      ),
    },
    {
      key: 'active',
      header: 'Situação',
      render: (u) => <Badge tone={u.active ? 'success' : 'neutral'}>{u.active ? 'Ativa' : 'Inativa'}</Badge>,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => abrir(u)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-danger hover:bg-danger-bg dark:hover:bg-danger/15"
            onClick={() => setExcluindo(u)}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cada unidade tem seu próprio estoque. O que está na Matriz não se mistura com a Sede.
        </p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => abrir()}>
          Nova unidade
        </Button>
      </div>

      <Card>
        <DataTable
          columns={colunas}
          data={unidades ?? []}
          loading={isLoading}
          rowKey={(u) => u.id}
          emptyMessage="Nenhuma unidade cadastrada"
          mobileCard={(u) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">{u.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {u._count?.stock ?? 0} produto(s) · {u._count?.sales ?? 0} venda(s)
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => abrir(u)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editando ? 'Editar unidade' : 'Nova unidade'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-unidade" loading={salvar.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="form-unidade" onSubmit={enviar} className="space-y-4">
          <Input
            label="Nome"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Matriz, Sede, Loja Centro…"
            autoFocus
          />
          <Select
            label="Tipo"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'MATRIZ' | 'FILIAL' }))}
            options={[
              { value: 'MATRIZ', label: 'Matriz' },
              { value: 'FILIAL', label: 'Filial' },
            ]}
          />
          <Select
            label="Situação"
            value={String(form.active)}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === 'true' }))}
            options={[
              { value: 'true', label: 'Ativa' },
              { value: 'false', label: 'Inativa' },
            ]}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(excluindo)}
        title="Excluir unidade"
        message={`Excluir "${excluindo?.name}"? Se houver estoque, vendas ou movimentações, ela será apenas desativada — apagar levaria junto o histórico.`}
        loading={remover.isPending}
        onConfirm={() => void confirmarExclusao()}
        onCancel={() => setExcluindo(null)}
      />
    </div>
  );
}
