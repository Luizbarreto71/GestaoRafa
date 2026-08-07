import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCrudMutation, useCustomers } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { customerService } from '@/services';
import { formatDate, formatPhone } from '@/lib/format';
import type { Customer } from '@/types';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

const EMPTY = { name: '', phone: '', email: '', document: '', notes: '' };

export default function CustomersPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('busca') ?? '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const toast = useToast();
  const { isAdmin } = useAuth();
  const debouncedSearch = useDebounce(search, 350);
  const { data, isLoading } = useCustomers({ page, pageSize, search: debouncedSearch });

  const saveCustomer = useCrudMutation(
    (variables: { id?: string; data: Record<string, unknown> }) =>
      variables.id ? customerService.update(variables.id, variables.data) : customerService.create(variables.data),
    'customers',
  );

  const removeCustomer = useCrudMutation((id: string) => customerService.remove(id), 'customers');

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  function openForm(customer?: Customer) {
    setEditing(customer ?? null);
    setForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            document: customer.document ?? '',
            notes: customer.notes ?? '',
          }
        : EMPTY,
    );
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (form.name.trim().length < 2) {
      toast.warning('Informe o nome do cliente');
      return;
    }

    try {
      await saveCustomer.mutateAsync({
        id: editing?.id,
        data: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          document: form.document.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      toast.success(editing ? 'Cliente atualizado' : 'Cliente cadastrado');
      setFormOpen(false);
    } catch (error) {
      toast.error('Não foi possível salvar', error instanceof Error ? error.message : undefined);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await removeCustomer.mutateAsync(deleting.id);
      toast.success('Cliente excluído');
      setDeleting(null);
    } catch (error) {
      toast.error('Não foi possível excluir', error instanceof Error ? error.message : undefined);
    }
  }

  const columns: TableColumn<Customer>[] = [
    {
      key: 'name',
      header: 'Cliente',
      render: (customer) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500 dark:bg-navy-800 dark:text-slate-400">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy-900 dark:text-slate-100">{customer.name}</p>
            {customer.email && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{customer.email}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (customer) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{formatPhone(customer.phone)}</span>
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      hideOnMobile: true,
      render: (customer) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{customer.document ?? '—'}</span>
      ),
    },
    {
      key: 'sales',
      header: 'Compras',
      align: 'center',
      render: (customer) => (
        <span className="font-semibold text-navy-900 dark:text-slate-100">{customer._count?.sales ?? 0}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Cadastrado em',
      hideOnMobile: true,
      render: (customer) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{formatDate(customer.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (customer) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => openForm(customer)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="text-danger hover:bg-danger-bg dark:hover:bg-danger/15"
              onClick={() => setDeleting(customer)}
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">Clientes</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {data?.meta.total ?? 0} cliente(s) — criados automaticamente a cada venda
          </p>
        </div>

        <Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm()}>
          Novo cliente
        </Button>
      </div>

      <Card>
        <div className="p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar por nome, telefone ou e-mail…"
            icon={<Search className="h-4 w-4" />}
          />
        </div>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          rowKey={(customer) => customer.id}
          emptyMessage="Nenhum cliente encontrado"
          emptyAction={
            <Button icon={<Users className="h-4 w-4" />} onClick={() => openForm()}>
              Cadastrar cliente
            </Button>
          }
          mobileCard={(customer) => (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500 dark:bg-navy-800">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                  {customer.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {formatPhone(customer.phone)} · {customer._count?.sales ?? 0} compra(s)
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => openForm(customer)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        />

        <Pagination meta={data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar cliente' : 'Novo cliente'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="customer-form" loading={saveCustomer.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="(11) 98888-7777"
            />
            <Input
              label="Documento"
              value={form.document}
              onChange={(event) => setForm((f) => ({ ...f, document: event.target.value }))}
              placeholder="CPF/CNPJ"
            />
          </div>
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
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
        title="Excluir cliente"
        message={`Excluir "${deleting?.name}"? O histórico de vendas será mantido, mas sem vínculo com o cadastro.`}
        loading={removeCustomer.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
