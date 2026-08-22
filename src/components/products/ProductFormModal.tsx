import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import { useCategories, useCreateProduct, useSuppliers, useUpdateProduct } from '@/hooks/queries';
import { opcoesDeCategoria } from '@/lib/categorias';
import { cn } from '@/lib/cn';
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
  // A condição virou subcategoria e não aparece mais no formulário; a
  // chave fica porque o catálogo ainda a conhece, para ler o que já existe.
  condicao: '',
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
  atacado: '',
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
  const { user } = useAuth();
  const { unidades, unidadeId } = useUnit();
  const [unidadeDestino, setUnidadeDestino] = useState('');

  const criarProduto = useCreateProduct();
  const atualizarProduto = useUpdateProduct();

  const editando = Boolean(product);

  useEffect(() => {
    if (!open) return;

    if (product) {
      setCategoriaId(product.categoryId);

      // A prateleira que está sendo conferida: a do filtro em que a pessoa
      // está, a do próprio usuário, ou a primeira que tem peça. Mostrar o
      // total de todas as unidades num campo editável faria a correção de
      // uma prateleira virar o número de todas.
      const daPessoa = unidadeId ?? user?.unitId ?? null;
      const comEstoque = product.stock?.find((x) => x.quantity > 0)?.unitId;
      const escolhida = daPessoa ?? comEstoque ?? product.stock?.[0]?.unitId ?? unidades[0]?.id ?? '';
      setUnidadeDestino(escolhida);

      setValores({
        ...VAZIO,
        nome: product.name,
        marca: product.brand ?? '',
        modelo: product.model ?? '',
        cor: product.color ?? '',
        capacidade: product.capacity ?? '',
        lote: product.lote ?? '',
        imei: product.imei ?? '',
        serie: product.serialNumber ?? '',
        codigo: product.barcode ?? '',
        quantidade: String(product.stock?.find((x) => x.unitId === escolhida)?.quantity ?? product.quantity),
        minimo: String(product.minQuantity),
        custo: String(product.costPrice),
        venda: String(product.salePrice),
        atacado: product.wholesalePrice != null ? String(product.wholesalePrice) : '',
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
      // Sugere onde a pessoa já está trabalhando; ela pode trocar.
      setUnidadeDestino(unidadeId ?? user?.unitId ?? unidades[0]?.id ?? '');
    }

    setMotivo('');
    setErros({});
  }, [open, product, categorias, unidadeId, user?.unitId, unidades]);

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
    const atacado = Number(valores.atacado) || 0;
    if (!venda && !atacado) return null;

    return {
      varejo: venda ? { valor: venda - custo, percentual: profitMargin(custo, venda) } : null,
      atacado: atacado ? { valor: atacado - custo, percentual: profitMargin(custo, atacado) } : null,
      total: (venda || 0) * (Number(valores.quantidade) || 0),
    };
  }, [valores.custo, valores.venda, valores.atacado, valores.quantidade]);

  function validar(): boolean {
    const novos: Partial<Record<ChaveCampo, string>> = {};

    if (valores.nome.trim().length < 2) novos.nome = `Informe ${rotulo('nome').toLowerCase()}`;
    if (!categoriaId) novos.nome = novos.nome ?? 'Selecione uma categoria';
    if (valores.quantidade === '' || Number(valores.quantidade) < 0) {
      novos.quantidade = 'Quantidade inválida';
    }
    // Obrigatórios: os essenciais do catálogo mais os que a categoria marcou.
    for (const c of camposVisiveis) {
      const definicao = CAMPOS[c.campo];
      if (definicao.tipo === 'fotos') continue;

      const valor = valores[c.campo]?.trim() ?? '';

      if (obrigatorio(c.campo) && valor === '' && c.campo !== 'nome' && c.campo !== 'quantidade') {
        novos[c.campo] = `Informe ${rotuloDoCampo(c).toLowerCase()}`;
        continue;
      }
      if (definicao.tipo === 'dinheiro' && valor !== '' && Number(valor) < 0) {
        novos[c.campo] = 'Valor inválido';
      }
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
      // Também na edição: corrigir a contagem aqui vira um ajuste de
      // estoque, e ajuste sem unidade não diz de qual prateleira é.
      unitId: unidadeDestino || undefined,
      minQuantity: mostra('minimo') ? Number(valores.minimo) || 0 : 1,
      costPrice: Number(valores.custo) || 0,
      salePrice: Number(valores.venda) || 0,
      wholesalePrice: mostra('atacado') && valores.atacado !== '' ? Number(valores.atacado) : null,
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

      case 'selecao':
        return (
          <Select
            key={chave}
            {...props}
            value={valores[chave]}
            onChange={(e) => definir(chave)(e.target.value)}
            options={(definicao.opcoes ?? []).map((o) => ({ value: o, label: o }))}
            placeholder="Selecione…"
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
  const quantidadeInformada = Number(valores.quantidade) || 0;
  const saldoAtualNaUnidade =
    product?.stock?.find((x) => x.unitId === unidadeDestino)?.quantity ?? 0;

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
          {/* O que é e onde entra — as duas decisões que mudam o resto. */}
          <div
            className={cn(
              'grid grid-cols-1 gap-4',
              !editando && unidades.length > 1 && 'sm:grid-cols-2',
            )}
          >
            <Select
              label="Categoria"
              required
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              options={opcoesDeCategoria(categorias)}
              placeholder="Selecione…"
              hint={
                editando
                  ? undefined
                  : 'Cada categoria tem seu próprio formulário — ajuste em Configurações → Categorias'
              }
            />

            {/* Com uma unidade só não há escolha a fazer. Na edição, a
                quantidade corrige a contagem de uma prateleira — e sem
                dizer qual, o ajuste não significa nada. */}
            {unidades.length > 1 && (
              <Select
                label={editando ? 'Quantidade é a de qual estoque' : 'Entra no estoque de'}
                required
                value={unidadeDestino}
                onChange={(e) => {
                  setUnidadeDestino(e.target.value);
                  // Trocar de prateleira troca o número: senão a contagem
                  // de uma unidade seria salva como a da outra.
                  if (editando && product) {
                    const saldoLa = product.stock?.find((x) => x.unitId === e.target.value)?.quantity ?? 0;
                    definir('quantidade')(String(saldoLa));
                  }
                }}
                options={unidades.map((u) => ({
                  value: u.id,
                  label: editando
                    ? `${u.name} — ${product?.stock?.find((x) => x.unitId === u.id)?.quantity ?? 0} hoje`
                    : u.name,
                }))}
                hint={
                  editando
                    ? saldoAtualNaUnidade !== quantidadeInformada
                      ? `Vai ajustar de ${saldoAtualNaUnidade} para ${quantidadeInformada}`
                      : 'Mude a quantidade para corrigir a contagem'
                    : quantidadeInformada > 0
                      ? `${quantidadeInformada} un. entram nesta unidade`
                      : 'Sem quantidade, nada entra em lugar nenhum'
                }
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {camposVisiveis.map((c) => desenhar(c.campo))}
          </div>

          {margem && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-2.5 text-xs dark:bg-navy-800">
              {margem.varejo && (
                <span className="text-slate-500 dark:text-slate-400">
                  Lucro no varejo:{' '}
                  <strong className={margem.varejo.valor >= 0 ? 'text-success' : 'text-danger'}>
                    {formatCurrency(margem.varejo.valor)} ({margem.varejo.percentual.toFixed(1)}%)
                  </strong>
                </span>
              )}
              {margem.atacado && (
                <span className="text-slate-500 dark:text-slate-400">
                  Lucro no atacado:{' '}
                  <strong className={margem.atacado.valor >= 0 ? 'text-success' : 'text-danger'}>
                    {formatCurrency(margem.atacado.valor)} ({margem.atacado.percentual.toFixed(1)}%)
                  </strong>
                </span>
              )}
              <span className="text-slate-500 dark:text-slate-400">
                Total em estoque:{' '}
                <strong className="text-navy-900 dark:text-slate-200">
                  {formatCurrency(margem.total)}
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
