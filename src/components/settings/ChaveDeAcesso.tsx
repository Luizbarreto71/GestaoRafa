import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { useToast } from '@/contexts/ToastContext';
import { api, getErrorMessage } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

/** Descobre se já existe chave — o valor em si nunca vem do servidor. */
export const useChaveDeAcesso = () =>
  useQuery({
    queryKey: ['chave-de-acesso'],
    queryFn: async () => {
      const { data } = await api.get<{ definida: boolean }>('/settings/chave-de-acesso');
      return data;
    },
    staleTime: 5 * 60_000,
  });

/**
 * A senha que libera vender abaixo do preço de atacado.
 *
 * Fica guardada com hash, como a senha de login: nem o administrador
 * consegue lê-la depois de salva — só trocar. Se ela vazasse do banco,
 * qualquer um poderia derrubar o preço mínimo em nome do dono.
 */
export function ChaveDeAcesso() {
  const [chave, setChave] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [removendo, setRemovendo] = useState(false);

  const toast = useToast();
  const queryClient = useQueryClient();
  const { data } = useChaveDeAcesso();

  const salvar = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<{ message: string }>('/settings/chave-de-acesso', { chave });
      return data;
    },
    onSuccess: (r) => {
      toast.success('Chave salva', r.message);
      setChave('');
      setConfirmacao('');
      void queryClient.invalidateQueries({ queryKey: ['chave-de-acesso'] });
    },
    onError: (e) => toast.error('Não foi possível salvar', getErrorMessage(e)),
  });

  const remover = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<{ message: string }>('/settings/chave-de-acesso');
      return data;
    },
    onSuccess: (r) => {
      toast.success('Chave removida', r.message);
      setRemovendo(false);
      void queryClient.invalidateQueries({ queryKey: ['chave-de-acesso'] });
    },
    onError: (e) => toast.error('Não foi possível remover', getErrorMessage(e)),
  });

  const curta = chave.length > 0 && chave.length < 4;
  const diferente = confirmacao.length > 0 && chave !== confirmacao;
  const podeSalvar = chave.length >= 4 && chave === confirmacao;

  return (
    <>
      <Card>
        <CardHeader
          title="Chave de acesso"
          subtitle="Libera vender abaixo do preço de atacado"
          action={
            data?.definida ? (
              <span className="flex items-center gap-1.5 rounded-lg bg-success-bg px-2.5 py-1.5 text-xs font-semibold text-success dark:bg-success/15">
                <ShieldCheck className="h-3.5 w-3.5" />
                Chave ativa
              </span>
            ) : (
              <span className="rounded-lg bg-warning-bg px-2.5 py-1.5 text-xs font-semibold text-warning dark:bg-warning/15">
                Sem chave
              </span>
            )
          }
        />

        <CardBody className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:bg-navy-800 dark:text-slate-400">
            O preço de atacado cadastrado é o piso de toda venda. Quando o caixa ou o vendedor tenta
            fechar abaixo disso, o sistema pede esta chave — e sem ela a venda não passa.
            {!data?.definida && (
              <strong className="mt-1.5 block text-warning">
                Enquanto nenhuma chave existir, vender abaixo do atacado fica totalmente bloqueado.
              </strong>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label={data?.definida ? 'Nova chave' : 'Criar chave'}
              type="password"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="ao menos 4 caracteres"
              error={curta ? 'Muito curta' : undefined}
              autoComplete="new-password"
            />
            <Input
              label="Repita a chave"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              error={diferente ? 'As duas não conferem' : undefined}
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!podeSalvar}
              loading={salvar.isPending}
              onClick={() => salvar.mutate()}
              icon={<KeyRound className="h-4 w-4" />}
            >
              {data?.definida ? 'Trocar a chave' : 'Criar chave'}
            </Button>

            {data?.definida && (
              <Button
                variant="ghost"
                className="text-danger"
                onClick={() => setRemovendo(true)}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Remover
              </Button>
            )}
          </div>

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            A chave é guardada cifrada e não pode ser consultada depois — nem por você. Se esquecer,
            crie outra aqui.
          </p>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={removendo}
        title="Remover a chave de acesso"
        message="Sem chave, ninguém consegue vender abaixo do preço de atacado — nem você. O bloqueio passa a ser total."
        confirmLabel="Remover"
        cancelLabel="Voltar"
        loading={remover.isPending}
        onConfirm={() => remover.mutate()}
        onCancel={() => setRemovendo(false)}
      />
    </>
  );
}
