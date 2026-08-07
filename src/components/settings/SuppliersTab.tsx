import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCrudMutation, useSuppliers } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { formatPhone } from '@/lib/format';
import { supplierService } from '@/services';
import type { Supplier } from '@/types';
import { Pencil, Plus, Search, Trash2, Truck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

const EMPTY = { name: '', phone: '', email: '', document: '', address: '', notes: '' };

export function SuppliersTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const toast = useToast();
  const { isAdmin } = useAuth();
  const debouncedSearch = useDebounce(search, 350);
  const { data, isLoading } = useSuppliers({ page, pageSize: 20, search: debouncedSearch });

  const saveSupplier = useCrudMutation(
    (variables: { id?: string; data: Record<string, unknown> }) =>
      variables.id ? supplierService.update(variables.id, variables.data) : supplierService.create(variables.data),
    'suppliers',
  );

  const removeSupplier = useCrudMutation((id: string) => supplierService.remove(id), 'suppliers');

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  function openForm(supplier?: Supplier) {
    setEditing(supplier ?? null);
    setForm(
      supplier
        ? {
            name: supplier.name,
            phone: supplier.phone ?? '',
            email: supplier.email ?? '',
            document: supplier.document ?? '',
            address: supplier.address ?? '',
            notes: supplier.notes ?? '',
          }
        : EMPTY,
    );
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (form.name.trim().length < 2) {
      toast.warning('Informe o nome do fornecedor');
      return;
    }

    try {
      await saveSupplier.mutateAsync({
        id: editing?.id,
        data: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          document: form.document.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      toast.success(editing ? 'Fornecedor atualizado' : 'Fornecedor cadastrado');
      setFormOpen(false);
    } catch (error) {
      toast.error('Não foi possível salvar', error instanceof Error ? error.message : undefined);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const result = await removeSupplier.mutateAsync(deleting.id);
      toast.success(
        (result as { deactivated?: boolean }).deactivated ? 'Fornecedor desativado' : 'Fornecedor excluído',
        (result as { message?: string }).message,
      );
      setDeleting(null);
    } catch (error) {
      toast.error('Não foi possível excluir', error instanceof Error ? error.message : undefined);
    }
  }

  const columns: TableColumn<Supplier>[] = [
    {
      key: 'name',
      header: 'Fornecedor',
      render: (supplier) => (
        <div>
          <p className="font-semibold text-navy-900 dark:text-slate-100">{supplier.name}</p>
          {supplier.email && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{supplier.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (supplier) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{formatPhone(supplier.phone)}</span>
      ),
    },
    {
      key: 'document',
      header: 'CNPJ/CPF',
      hideOnMobile: true,
      render: (supplier) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{supplier.document ?? '—'}</span>
      ),
    },
    {
      key: 'products',
      header: 'Produtos',
      align: 'center',
      render: (supplier) => (
        <span className="font-semibold text-navy-900 dark:text-slate-100">
          {supplier._count?.products ?? 0}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Situação',
      render: (supplier) => (
        <Badge tone={supplier.active ? 'success' : 'neutral'}>{supplier.active ? 'Ativo' : 'Inativo'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (supplier) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => openForm(supplier)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="text-danger hover:bg-danger-bg dark:hover:bg-danger/15"
              onClick={() => setDeleting(supplier)}
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar fornecedor…"
          icon={<Search className="h-4 w-4" />}
          wrapperClassName="max-w-sm"
        />
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm()}>
          Novo fornecedor
        </Button>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          rowKey={(supplier) => supplier.id}
          emptyMessage="Nenhum fornecedor cadastrado"
          emptyAction={
            <Button icon={<Truck className="h-4 w-4" />} onClick={() => openForm()}>
              Cadastrar fornecedor
            </Button>
          }
          mobileCard={(supplier) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                  {supplier.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {formatPhone(supplier.phone)} · {supplier._count?.products ?? 0} produto(s)
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => openForm(supplier)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="supplier-form" loading={saveSupplier.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            required
            value={form.name}
            onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
            autoFocus
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Telefone"
              value={form.phone}
              onChange={(event) => setForm((f) => ({ ...f, phone: event.target.value }))}
            />
            <Input
              label="CNPJ/CPF"
              value={form.document}
              onChange={(event) => setForm((f) => ({ ...f, document: event.target.value }))}
            />
          </div>
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
          />
          <Input
            label="Endereço"
            value={form.address}
            onChange={(event) => setForm((f) => ({ ...f, address: event.target.value }))}
          />
          <Textarea
            label="Observações"
            value={form.notes}
            onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir fornecedor"
        message={`Excluir "${deleting?.name}"? Se houver produtos vinculados, ele será apenas desativado.`}
        loading={removeSupplier.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
