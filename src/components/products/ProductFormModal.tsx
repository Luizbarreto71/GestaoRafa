import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useCategories, useCreateProduct, useSuppliers, useUpdateProduct } from '@/hooks/queries';
import { formatCurrency, profitMargin, STATUS_OPTIONS, toInputDate } from '@/lib/format';
import type { Product } from '@/types';
import { CAMPOS, normalizarCampos, rotuloDoCampo, type ChaveCampo } from '@shared/campos';
import { ScanLine } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BarcodeScanner } from './BarcodeScanner';
import { PhotoUploader } from './PhotoUploader';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

/** O estado guarda tudo; a categoria decide o que aparece na tela. */
const VAZIO: Record<ChaveCampo, string> = {
  nome: '',
  marca: '',
  modelo: '',
  cor: '',
  capacidade: '',
  lote: '',
  imei: '',
  serie: '',
  codigo: '',
  quantidade: '1',
  minimo: '1',
  custo: '',
  venda: '',
  fornecedor: '',
  status: 'EM_ESTOQUE',
  entrada: toInputDate(new Date()),
  fotos: '',
  observacoes: '',
};

export function ProductFormModal({ open, onClose, product }: ProductFormModalProps) {
  const [categoriaId, setCategoriaId] = useState('');
  const [valores, setValores] = useState<Record<ChaveCampo, string>>(VAZIO);
  const [fotos, setFotos] = useState<string[]>([]);
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<Partial<Record<ChaveCampo, string>>>({});
  const [scannerAberto, setScannerAberto] = useState(false);

  const toast = useToast();
  const { data: categorias } = useCategories();
  const { data: fornecedores } = useSuppliers({ all: 'true' });
  const criarProduto = useCreateProduct();
  const atualizarProduto = useUpdateProduct();

  const editando = Boolean(product);

  useEffect(() => {
    if (!open) return;

    if (product) {
      setCategoriaId(product.categoryId);
      setValores({
        nome: product.name,
        marca: product.brand ?? '',
        modelo: product.model ?? '',
        cor: product.color ?? '',
        capacidade: product.capacity ?? '',
        lote: product.lote ?? '',
        imei: product.imei ?? '',
        serie: product.serialNumber ?? '',
        codigo: product.barcode ?? '',
        quantidade: String(product.quantity),
        minimo: String(product.minQuantity),
        custo: String(product.costPrice),
        venda: String(product.salePrice),
        fornecedor: product.supplierId ?? '',
        status: product.status,
        entrada: toInputDate(product.entryDate),
        fotos: '',
        observacoes: product.notes ?? '',
      });
      setFotos(product.photos ?? []);
    } else {
      setCategoriaId(categorias?.[0]?.id ?? '');
      setValores(VAZIO);
      setFotos([]);
    }

    setMotivo('');
    setErros({});
  }, [open, product, categorias]);

  const categoria = categorias?.find((c) => c.id === categoriaId);

  /** Campos que esta categoria mostra, na ordem configurada. */
  const camposVisiveis = useMemo(
    () => normalizarCampos(categoria?.campos, categoria?.slug),
    [categoria],
  );

  const mostra = (chave: ChaveCampo) => camposVisiveis.some((c) => c.campo === chave);
  const config = (chave: ChaveCampo) => camposVisiveis.find((c) => c.campo === chave);
  const rotulo = (chave: ChaveCampo) => {
    const c = config(chave);
    return c ? rotuloDoCampo(c) : CAMPOS[chave].rotulo;
  };
  const obrigatorio = (chave: ChaveCampo) =>
    Boolean(config(chave)?.obrigatorio) || Boolean(CAMPOS[chave].essencial);

  const definir = (chave: ChaveCampo) => (valor: string) => {
    setValores((atual) => ({ ...atual, [chave]: valor }));
    setErros((atual) => ({ ...atual, [chave]: undefined }));
  };

  const margem = useMemo(() => {
    const custo = Number(valores.custo) || 0;
    const venda = Number(valores.venda) || 0;
    if (!venda) return null;
    return { valor: venda - custo, percentual: profitMargin(custo, venda) };
  }, [valores.custo, valores.venda]);

  function validar(): boolean {
    const novos: Partial<Record<ChaveCampo, string>> = {};

    if (valores.nome.trim().length < 2) novos.nome = `Informe ${rotulo('nome').toLowerCase()}`;
    if (!categoriaId) novos.nome = novos.nome ?? 'Selecione uma categoria';
    if (valores.quantidade === '' || Number(valores.quantidade) < 0) {
      novos.quantidade = 'Quantidade inválida';
    }
    if (valores.custo !== '' && Number(valores.custo) < 0) novos.custo = 'Valor inválido';
    if (valores.venda !== '' && Number(valores.venda) < 0) novos.venda = 'Valor inválido';

    // Campos que a categoria marcou como obrigatórios.
    for (const c of camposVisiveis) {
      if (!c.obrigatorio || CAMPOS[c.campo].tipo === 'fotos') continue;
      if (!valores[c.campo]?.trim()) novos[c.campo] = `${rotuloDoCampo(c)} é obrigatório`;
    }

    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!validar()) return;

    /** Só manda o que a categoria mostra — o resto fica em branco. */
    const seVisivel = (chave: ChaveCampo, valor: string) =>
      mostra(chave) ? valor.trim() || null : null;

    const dados: Record<string, unknown> = {
      name: valores.nome.trim(),
      categoryId: categoriaId,
      brand: seVisivel('marca', valores.marca),
      model: seVisivel('modelo', valores.modelo),
      color: seVisivel('cor', valores.cor),
      capacity: seVisivel('capacidade', valores.capacidade),
      lote: seVisivel('lote', valores.lote),
      imei: seVisivel('imei', valores.imei),
      serialNumber: seVisivel('serie', valores.serie),
      barcode: seVisivel('codigo', valores.codigo),
      notes: seVisivel('observacoes', valores.observacoes),
      supplierId: mostra('fornecedor') ? valores.fornecedor || null : null,
      quantity: Number(valores.quantidade) || 0,
      minQuantity: mostra('minimo') ? Number(valores.minimo) || 0 : 1,
      costPrice: Number(valores.custo) || 0,
      salePrice: Number(valores.venda) || 0,
      status: mostra('status') ? valores.status : undefined,
      entryDate: mostra('entrada') && valores.entrada
        ? new Date(`${valores.entrada}T12:00:00`).toISOString()
        : undefined,
      photos: mostra('fotos') ? fotos : undefined,
    };

    try {
      if (editando && product) {
        await atualizarProduto.mutateAsync({
          id: product.id,
          data: { ...dados, reason: motivo.trim() || undefined },
        });
        toast.success('Produto atualizado', `${valores.nome} foi salvo.`);
      } else {
        await criarProduto.mutateAsync(dados);
        toast.success('Produto cadastrado', `${valores.nome} entrou no estoque.`);
      }
      onClose();
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro ao salvar';

      if (mensagem === 'OFFLINE_QUEUED') {
        toast.warning('Salvo offline', 'Enviaremos assim que a internet voltar.');
        onClose();
        return;
      }
      toast.error('Não foi possível salvar', mensagem);
    }
  }

  /** Desenha um campo conforme o tipo definido no catálogo. */
  function desenhar(chave: ChaveCampo) {
    const definicao = CAMPOS[chave];
    const props = {
      label: rotulo(chave),
      required: obrigatorio(chave),
      error: erros[chave],
      hint: definicao.ajuda,
    };

    switch (definicao.tipo) {
      case 'texto-longo':
        return (
          <Textarea
            key={chave}
            {...props}
            value={valores[chave]}
            onChange={(e) => definir(chave)(e.target.value)}
            wrapperClassName="sm:col-span-2 lg:col-span-4"
          />
        );

      case 'inteiro':
        return (
          <Input
            key={chave}
            {...props}
            type="number"
            min={0}
            value={valores[chave]}
            onChange={(e) => definir(chave)(e.target.value)}
          />
        );

      case 'dinheiro':
        return (
          <Input
            key={chave}
            {...props}
            type="number"
            min={0}
            step="0.01"
            placeholder="0,00"
            value={valores[chave]}
            onChange={(e) => definir(chave)(e.target.value)}
          />
        );

      case 'data':
        return (
          <Input
            key={chave}
            {...props}
            type="date"
            value={valores[chave]}
            onChange={(e) => definir(chave)(e.target.value)}
          />
        );

      case 'fornecedor':
        return (
          <Select
            key={chave}
            {...props}
            value={valores[chave]}
            onChange={(e) => definir(chave)(e.target.value)}
            options={(fornecedores?.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
            placeholder="Sem fornecedor"
          />
        );

      case 'status':
        return (
          <Select
            key={chave}
            {...props}
            value={valores[chave]}
            onChange={(e) => definir(chave)(e.target.value)}
            options={STATUS_OPTIONS}
          />
        );

      case 'codigo-barras':
        return (
          <div key={chave} className="relative">
            <Input
              {...props}
              value={valores[chave]}
              onChange={(e) => definir(chave)(e.target.value)}
              placeholder="Escaneie ou digite"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setScannerAberto(true)}
              className="absolute right-2 top-[30px] rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-accent dark:hover:bg-navy-700"
              title="Ler com a câmera"
            >
              <ScanLine className="h-4 w-4" />
            </button>
          </div>
        );

      case 'fotos':
        return (
          <div key={chave} className="sm:col-span-2 lg:col-span-4">
            <PhotoUploader value={fotos} onChange={setFotos} />
          </div>
        );

      default:
        return (
          <Input
            key={chave}
            {...props}
            value={valores[chave]}
            onChange={(e) => definir(chave)(e.target.value)}
            placeholder={definicao.exemplo}
            wrapperClassName={chave === 'nome' ? 'sm:col-span-2' : undefined}
          />
        );
    }
  }

  const salvando = criarProduto.isPending || atualizarProduto.isPending;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editando ? 'Editar produto' : 'Cadastrar produto'}
        description={
          editando
            ? product?.name
            : categoria
              ? `Formulário de ${categoria.name}`
              : 'Escolha a categoria para começar'
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" form="form-produto" loading={salvando}>
              {editando ? 'Salvar alterações' : 'Cadastrar produto'}
            </Button>
          </>
        }
      >
        <form id="form-produto" onSubmit={enviar} className="space-y-5">
          {/* A categoria vem primeiro: é ela que define o resto do formulário. */}
          <Select
            label="Categoria"
            required
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            options={(categorias ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Selecione…"
            hint={
              editando
                ? undefined
                : 'Cada categoria tem seu próprio formulário — ajuste em Configurações → Categorias'
            }
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {camposVisiveis.map((c) => desenhar(c.campo))}
          </div>

          {margem && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-2.5 text-xs dark:bg-navy-800">
              <span className="text-slate-500 dark:text-slate-400">
                Lucro por unidade:{' '}
                <strong className={margem.valor >= 0 ? 'text-success' : 'text-danger'}>
                  {formatCurrency(margem.valor)}
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Margem:{' '}
                <strong className={margem.percentual >= 0 ? 'text-success' : 'text-danger'}>
                  {margem.percentual.toFixed(1)}%
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Total em estoque:{' '}
                <strong className="text-navy-900 dark:text-slate-200">
                  {formatCurrency((Number(valores.venda) || 0) * (Number(valores.quantidade) || 0))}
                </strong>
              </span>
            </div>
          )}

          {editando && (
            <Input
              label="Motivo da alteração"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: correção de preço, nova remessa"
              hint="Aparece no histórico de movimentações"
            />
          )}
        </form>
      </Modal>

      <BarcodeScanner
        open={scannerAberto}
        onClose={() => setScannerAberto(false)}
        onDetected={(codigo) => {
          definir('codigo')(codigo);
          toast.success('Código lido', codigo);
        }}
      />
    </>
  );
}
