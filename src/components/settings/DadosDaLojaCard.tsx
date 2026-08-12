import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/contexts/ToastContext';
import { api, getErrorMessage } from '@/lib/api';
import { LOJA_PADRAO, type DadosDaLoja } from '@shared/loja';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Store } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

/**
 * Cabeçalho e rodapé do comprovante que o cliente leva.
 *
 * Fica em configuração, e não no código, porque endereço e telefone mudam —
 * e comprovante com contato errado é pior do que sem contato.
 */
export function DadosDaLojaCard() {
  const [form, setForm] = useState<DadosDaLoja>(LOJA_PADRAO);
  const [mexeu, setMexeu] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['dados-da-loja'],
    queryFn: async () => {
      const { data } = await api.get<DadosDaLoja>('/settings/loja');
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setForm(data);
      setMexeu(false);
    }
  }, [data]);

  const salvar = useMutation({
    mutationFn: async (dados: DadosDaLoja) => {
      const { data } = await api.put<{ message: string }>('/settings/loja', dados);
      return data;
    },
    onSuccess: (r) => {
      toast.success('Dados salvos', r.message);
      setMexeu(false);
      void queryClient.invalidateQueries({ queryKey: ['dados-da-loja'] });
    },
    onError: (erro) => toast.error('Não foi possível salvar', getErrorMessage(erro)),
  });

  const alterar = (campo: keyof DadosDaLoja, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setMexeu(true);
  };

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (form.nome.trim().length < 2) return toast.warning('Informe o nome da loja');
    salvar.mutate(form);
  }

  return (
    <Card>
      <CardHeader
        title="Dados da loja"
        subtitle="Aparecem no cabeçalho do comprovante de venda"
        action={
          <Button
            size="sm"
            disabled={!mexeu}
            loading={salvar.isPending}
            onClick={() => salvar.mutate(form)}
            icon={<Save className="h-3.5 w-3.5" />}
          >
            Salvar
          </Button>
        }
      />

      <CardBody>
        <form onSubmit={enviar} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Nome da loja"
              required
              value={form.nome}
              onChange={(e) => alterar('nome', e.target.value)}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label="CNPJ ou CPF"
              value={form.documento}
              onChange={(e) => alterar('documento', e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Endereço"
              value={form.endereco}
              onChange={(e) => alterar('endereco', e.target.value)}
              placeholder="Av. Beira Mar, 1200"
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label="Bairro"
              value={form.bairro}
              onChange={(e) => alterar('bairro', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input
              label="Cidade"
              value={form.cidade}
              onChange={(e) => alterar('cidade', e.target.value)}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label="UF"
              value={form.uf}
              onChange={(e) => alterar('uf', e.target.value.toUpperCase().slice(0, 2))}
              placeholder="SE"
            />
            <Input label="CEP" value={form.cep} onChange={(e) => alterar('cep', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(e) => alterar('telefone', e.target.value)}
              placeholder="(79) 99999-1234"
            />
            <Input
              label="E-mail"
              value={form.email}
              onChange={(e) => alterar('email', e.target.value)}
            />
          </div>

          <Textarea
            label="Linha do rodapé"
            value={form.rodape}
            onChange={(e) => alterar('rodape', e.target.value)}
            placeholder="Garantia de 90 dias para aparelhos seminovos."
            hint="Texto livre no fim do comprovante — garantia, trocas, redes sociais"
          />

          {/* Como o cliente vai ver, sem precisar gerar um PDF para conferir. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              <Store className="h-3.5 w-3.5" />
              Cabeçalho do comprovante
            </p>
            <p className="text-base font-bold text-navy-900 dark:text-slate-100">
              {form.nome.toUpperCase() || 'NOME DA LOJA'}
            </p>
            {[form.endereco, form.bairro].filter(Boolean).length > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {[form.endereco, form.bairro].filter(Boolean).join(' - ')}
              </p>
            )}
            {[form.cidade, form.cep].filter(Boolean).length > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {[[form.cidade, form.uf].filter(Boolean).join('/'), form.cep && `CEP: ${form.cep}`]
                  .filter(Boolean)
                  .join(' - ')}
              </p>
            )}
            {form.documento && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                CNPJ/CPF: {form.documento}
              </p>
            )}
            {(form.telefone || form.email) && (
              <p className="mt-1 text-xs font-semibold text-navy-900 dark:text-slate-200">
                {[form.telefone, form.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
