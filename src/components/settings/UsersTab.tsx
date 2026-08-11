import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCrudMutation, useUnits, useUsers } from '@/hooks/queries';
import { ROLE_LABEL } from '@/lib/format';
import { formatDate } from '@/lib/format';
import { userService } from '@/services';
import type { User } from '@/types';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

const EMPTY = { name: '', email: '', password: '', role: 'VENDEDOR', active: true, unitId: '' };

export function UsersTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState<User | null>(null);

  const toast = useToast();
  const { user: currentUser, isAdmin } = useAuth();
  const { data, isLoading } = useUsers({ pageSize: 50 }, isAdmin);
  const { data: unidades } = useUnits();

  const saveUser = useCrudMutation(
    (variables: { id?: string; data: Record<string, unknown> }) =>
      variables.id ? userService.update(variables.id, variables.data) : userService.create(variables.data),
    'users',
  );

  const removeUser = useCrudMutation((id: string) => userService.remove(id), 'users');

  if (!isAdmin) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Apenas administradores podem gerenciar usuários.
          </p>
        </div>
      </Card>
    );
  }

  function openForm(user?: User) {
    setEditing(user ?? null);
    setForm(
      user
        ? {
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            active: user.active ?? true,
            unitId: user.unitId ?? '',
          }
        : EMPTY,
    );
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (form.name.trim().length < 2) return toast.warning('Informe o nome do usuário');
    if (!form.email.includes('@')) return toast.warning('Informe um e-mail válido');
    if (!editing && form.password.length < 6) {
      return toast.warning('A senha deve ter ao menos 6 caracteres');
    }
    // Gerente e vendedor precisam de unidade: é ela que define o que enxergam.
    if (form.role !== 'ADMIN' && !form.unitId) {
      return toast.warning('Escolha a unidade deste usuário');
    }

    try {
      await saveUser.mutateAsync({
        id: editing?.id,
        data: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          active: form.active,
          unitId: form.role === 'ADMIN' ? null : form.unitId,
          ...(form.password ? { password: form.password } : {}),
        },
      });
      toast.success(editing ? 'Usuário atualizado' : 'Usuário criado');
      setFormOpen(false);
    } catch (error) {
      toast.error('Não foi possível salvar', error instanceof Error ? error.message : undefined);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await removeUser.mutateAsync(deleting.id);
      toast.success('Usuário excluído');
      setDeleting(null);
    } catch (error) {
      toast.error('Não foi possível excluir', error instanceof Error ? error.message : undefined);
    }
  }

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      header: 'Usuário',
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy-900 dark:text-slate-100">
              {user.name}
              {user.id === currentUser?.id && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">(você)</span>
              )}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Perfil',
      render: (user) => (
        <Badge tone={user.role === 'ADMIN' ? 'info' : user.role === 'GERENTE' ? 'purple' : 'neutral'}>
          {ROLE_LABEL[user.role]}
        </Badge>
      ),
    },
    {
      key: 'unit',
      header: 'Unidade',
      render: (user) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {user.role === 'ADMIN' ? 'Todas' : (user.unit?.name ?? '—')}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Situação',
      render: (user) => (
        <Badge tone={user.active ? 'success' : 'danger'}>{user.active ? 'Ativo' : 'Inativo'}</Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      hideOnMobile: true,
      render: (user) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{formatDate(user.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (user) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => openForm(user)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          {user.id !== currentUser?.id && (
            <Button
              size="icon"
              variant="ghost"
              className="text-danger hover:bg-danger-bg dark:hover:bg-danger/15"
              onClick={() => setDeleting(user)}
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {data?.meta.total ?? 0} usuário(s) com acesso ao sistema
        </p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm()}>
          Novo usuário
        </Button>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          rowKey={(user) => user.id}
          emptyMessage="Nenhum usuário cadastrado"
          mobileCard={(user) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">{user.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={user.role === 'ADMIN' ? 'info' : user.role === 'GERENTE' ? 'purple' : 'neutral'}>
                  {ROLE_LABEL[user.role]}
                </Badge>
                <Button size="icon" variant="ghost" onClick={() => openForm(user)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar usuário' : 'Novo usuário'}
        description={editing ? 'Deixe a senha em branco para mantê-la' : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="user-form" loading={saveUser.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            required
            value={form.name}
            onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
            autoFocus
          />
          <Input
            label="E-mail"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
          />
          <Input
            label={editing ? 'Nova senha (opcional)' : 'Senha'}
            type="password"
            required={!editing}
            value={form.password}
            onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
            hint="Mínimo de 6 caracteres"
            autoComplete="new-password"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Perfil"
              value={form.role}
              onChange={(event) => setForm((f) => ({ ...f, role: event.target.value }))}
              options={[
                { value: 'VENDEDOR', label: 'Vendedor' },
                { value: 'GERENTE', label: 'Gerente' },
                { value: 'ADMIN', label: 'Administrador' },
              ]}
            />
            <Select
              label="Situação"
              value={String(form.active)}
              onChange={(event) => setForm((f) => ({ ...f, active: event.target.value === 'true' }))}
              options={[
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ]}
            />
          </div>

          {form.role !== 'ADMIN' && (
            <Select
              label="Unidade"
              required
              value={form.unitId}
              onChange={(event) => setForm((f) => ({ ...f, unitId: event.target.value }))}
              options={(unidades ?? []).map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Selecione…"
              hint="O usuário só verá o estoque e as vendas desta unidade"
            />
          )}

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-navy-800 dark:text-slate-400">
            <p>
              <strong>Vendedor</strong> — registra vendas e vê o estoque da sua unidade.
            </p>
            <p>
              <strong>Gerente</strong> — também faz entradas, saídas e transferências da sua unidade.
            </p>
            <p>
              <strong>Administrador</strong> — vê todas as unidades, exclui registros, gerencia
              usuários e acessa backups.
            </p>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir usuário"
        message={`Remover o acesso de "${deleting?.name}"? As vendas e movimentações registradas por ele serão mantidas.`}
        loading={removeUser.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
