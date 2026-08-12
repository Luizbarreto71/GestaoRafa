import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { DadosDaLojaCard } from './DadosDaLojaCard';
import { TaxasDeCartao } from './TaxasDeCartao';
import { useToast } from '@/contexts/ToastContext';
import { useSheetsStatus } from '@/hooks/queries';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { downloadFile, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { clearQueue, flushQueue } from '@/lib/offline';
import { importService, settingsService } from '@/services';
import { useQueryClient } from '@tanstack/react-query';
import {
  CloudOff,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  Lock,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';

export function SystemTab() {
  const { theme, setTheme } = useTheme();
  const { isAdmin } = useAuth();
  const { online, queue } = useOnlineStatus();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: sheets } = useSheetsStatus();

  const [syncing, setSyncing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    processed: number;
    errors: { row: number; message: string }[];
    dryRun: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  async function syncSheets() {
    setSyncing(true);
    try {
      const result = await settingsService.syncSheets();
      toast.success('Planilha sincronizada', result.message);
    } catch (error) {
      toast.error('Falha na sincronização', getErrorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  async function downloadBackup() {
    setBackingUp(true);
    try {
      await downloadFile('/settings/backup', {}, 'backup-rafa.json');
      toast.success('Backup gerado', 'O arquivo JSON foi baixado com todos os dados.');
    } catch (error) {
      toast.error('Não foi possível gerar o backup', getErrorMessage(error));
    } finally {
      setBackingUp(false);
    }
  }

  async function handleImport(file: File, dryRun: boolean) {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importService.products(file, dryRun);
      setImportResult(result);

      if (dryRun) {
        toast.info('Validação concluída', result.message);
      } else {
        toast.success('Importação concluída', result.message);
        void queryClient.invalidateQueries();
      }
    } catch (error) {
      toast.error('Falha na importação', getErrorMessage(error));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();

    if (passwordForm.newPassword.length < 6) {
      return toast.warning('A nova senha deve ter ao menos 6 caracteres');
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.warning('As senhas não conferem');
    }

    setChangingPassword(true);
    try {
      await settingsService.changePassword(passwordForm);
      toast.success('Senha alterada com sucesso');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error('Não foi possível alterar a senha', getErrorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {isAdmin && (
        <div className="lg:col-span-2">
          <DadosDaLojaCard />
        </div>
      )}

      {/* A tabela ocupa a largura toda: são 18 linhas com quatro colunas. */}
      {isAdmin && (
        <div className="lg:col-span-2">
          <TaxasDeCartao />
        </div>
      )}

      {/* Tema */}
      <Card>
        <CardHeader title="Aparência" subtitle="Escolha entre tema claro e escuro" />
        <CardBody className="flex gap-3">
          {(
            [
              { key: 'light' as const, label: 'Claro', icon: Sun },
              { key: 'dark' as const, label: 'Escuro', icon: Moon },
            ]
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setTheme(option.key)}
              className={cn(
                'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition',
                theme === option.key
                  ? 'border-accent bg-accent/5'
                  : 'border-slate-200 hover:border-slate-300 dark:border-navy-700 dark:hover:border-navy-600',
              )}
            >
              <option.icon
                className={cn('h-6 w-6', theme === option.key ? 'text-accent' : 'text-slate-400')}
              />
              <span
                className={cn(
                  'text-sm font-semibold',
                  theme === option.key ? 'text-accent' : 'text-slate-600 dark:text-slate-400',
                )}
              >
                {option.label}
              </span>
            </button>
          ))}
        </CardBody>
      </Card>

      {/* Alterar senha */}
      <Card>
        <CardHeader title="Alterar senha" subtitle="Atualize a senha da sua conta" />
        <CardBody>
          <form onSubmit={changePassword} className="space-y-3">
            <Input
              label="Senha atual"
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((f) => ({ ...f, currentPassword: event.target.value }))
              }
              autoComplete="current-password"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Nova senha"
                type="password"
                required
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((f) => ({ ...f, newPassword: event.target.value }))}
                autoComplete="new-password"
              />
              <Input
                label="Confirmar nova senha"
                type="password"
                required
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((f) => ({ ...f, confirmPassword: event.target.value }))
                }
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" loading={changingPassword} icon={<Lock className="h-4 w-4" />}>
              Alterar senha
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Google Sheets */}
      <Card>
        <CardHeader
          title="Integração com planilha"
          subtitle="Google Sheets"
          action={
            <Badge tone={sheets?.configured ? 'success' : 'warning'}>
              {sheets?.configured ? 'Conectado' : 'Não configurado'}
            </Badge>
          }
        />
        <CardBody className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Cada entrada, venda, alteração e exclusão gera automaticamente uma linha na planilha
            {sheets?.sheetName ? ` "${sheets.sheetName}"` : ''}.
          </p>

          {!sheets?.configured && (
            <div className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2.5 text-xs leading-relaxed text-warning dark:bg-warning/10">
              Preencha <code className="font-mono">GOOGLE_SHEETS_ID</code>,{' '}
              <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> e{' '}
              <code className="font-mono">GOOGLE_PRIVATE_KEY</code> no <code className="font-mono">.env</code>{' '}
              do backend e compartilhe a planilha com o e-mail da conta de serviço.
            </div>
          )}

          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => void syncSheets()}
              loading={syncing}
              disabled={!sheets?.configured}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Ressincronizar histórico completo
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader title="Backup do banco" subtitle="Exporte todos os dados em JSON" />
        <CardBody className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Gera um arquivo com produtos, vendas, movimentações, clientes, fornecedores e usuários.
            Guarde-o em local seguro.
          </p>

          <Button
            variant="outline"
            onClick={() => void downloadBackup()}
            loading={backingUp}
            disabled={!isAdmin}
            icon={<DatabaseBackup className="h-4 w-4" />}
          >
            Baixar backup
          </Button>

          {!isAdmin && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Somente administradores podem gerar backups.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Importação */}
      <Card>
        <CardHeader title="Importar produtos" subtitle="Planilha Excel ou CSV" />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void downloadFile('/settings/import/template', {}, 'modelo-importacao.xlsx')}
              icon={<Download className="h-4 w-4" />}
            >
              Baixar modelo
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!isAdmin || importing}
              onClick={() => fileRef.current?.click()}
              icon={<Upload className="h-4 w-4" />}
            >
              Escolher planilha
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file, false);
            }}
          />

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Use o modelo para manter os cabeçalhos. Fornecedores que não existirem serão criados
            automaticamente; a categoria precisa ser uma das já cadastradas.
          </p>

          {importing && (
            <p className="flex items-center gap-2 text-sm text-accent">
              <FileSpreadsheet className="h-4 w-4 animate-pulse" />
              Processando planilha…
            </p>
          )}

          {importResult && (
            <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-navy-700">
              <p className="font-semibold text-navy-900 dark:text-slate-100">
                {importResult.imported} de {importResult.processed} linha(s) importadas
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-danger">
                  {importResult.errors.map((error) => (
                    <li key={error.row}>
                      Linha {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modo offline */}
      <Card>
        <CardHeader
          title="Modo offline"
          subtitle="Operações salvas sem internet"
          action={
            <Badge tone={online ? 'success' : 'danger'}>{online ? 'Conectado' : 'Sem conexão'}</Badge>
          }
        />
        <CardBody className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Vendas e cadastros feitos sem internet ficam guardados no aparelho e são enviados
            automaticamente quando a conexão volta.
          </p>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-navy-800">
            <CloudOff className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {queue.length === 0
                ? 'Nenhuma operação pendente'
                : `${queue.length} operação(ões) na fila`}
            </span>
          </div>

          {queue.length > 0 && (
            <>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-400">
                {queue.map((item) => (
                  <li key={item.id} className="truncate">
                    • {item.label}
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!online}
                  onClick={() =>
                    void flushQueue().then((result) => {
                      if (result.sent) {
                        toast.success(`${result.sent} operação(ões) sincronizadas`);
                        void queryClient.invalidateQueries();
                      } else {
                        toast.info('Nada foi sincronizado');
                      }
                    })
                  }
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Sincronizar agora
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => {
                    clearQueue();
                    toast.warning('Fila offline descartada');
                  }}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Descartar fila
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
