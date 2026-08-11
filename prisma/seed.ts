import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { camposParaJson, PADRAO_GENERICO, PADROES } from '../shared/campos';

dotenv.config();

const db = new PrismaClient();

/**
 * Prepara o banco para uso.
 *
 *   npm run db:seed        → só as categorias (banco limpo, pronto para a loja)
 *   npm run db:exemplos    → também cria produtos e uma venda de demonstração
 *
 * O administrador é criado com `npm run criar-admin`.
 */
const criarExemplos = process.argv.includes('--exemplos');

/// As duas unidades da loja. Sem elas não há onde guardar estoque.
const UNIDADES = [
  { name: 'Matriz', type: 'MATRIZ' },
  { name: 'Sede', type: 'FILIAL' },
];

const CATEGORIAS = [
  { name: 'Celulares', slug: 'celulares', color: '#3B82F6' },
  { name: 'TG (Tirzepatida)', slug: 'tg', color: '#8B5CF6' },
  { name: 'JBL', slug: 'jbl', color: '#F97316' },
  { name: 'Notebooks', slug: 'notebooks', color: '#14B8A6' },
  { name: 'Video Games', slug: 'video-games', color: '#EC4899' },
  { name: 'TVs', slug: 'tvs', color: '#6366F1' },
];

async function main() {
  console.log('🌱 Preparando o banco...');

  for (const unidade of UNIDADES) {
    await db.unit.upsert({
      where: { name: unidade.name },
      update: { type: unidade.type },
      create: unidade,
    });
  }
  console.log(`✅ ${UNIDADES.length} unidades: ${UNIDADES.map((u) => u.name).join(', ')}`);

  for (const categoria of CATEGORIAS) {
    const padrao = camposParaJson(PADROES[categoria.slug] ?? PADRAO_GENERICO);
    const existente = await db.category.findUnique({ where: { slug: categoria.slug } });

    await db.category.upsert({
      where: { slug: categoria.slug },
      update: {
        name: categoria.name,
        color: categoria.color,
        // Só preenche se ainda não houver formulário salvo — nunca sobrescreve
        // o que você ajustou em Configurações → Categorias.
        ...(existente?.campos ? {} : { campos: padrao }),
      },
      create: { ...categoria, campos: padrao },
    });
  }
  console.log(`✅ ${CATEGORIAS.length} categorias com seus formulários`);

  // Nenhum usuário é criado automaticamente: quem cria é o `criar-admin`,
  // para não deixar um login padrão conhecido em produção.
  const usuarios = await db.user.count();
  if (usuarios === 0) {
    console.log('\n⚠️  Ainda não existe nenhum usuário. Crie o administrador com:');
    console.log('   npm run criar-admin -- "Nome do Dono" email@dominio.com\n');
  } else {
    console.log(`✅ ${usuarios} usuário(s) já cadastrados`);
  }

  if (!criarExemplos) {
    console.log('🎉 Banco pronto para uso.');
    return;
  }

  if ((await db.product.count()) > 0) {
    console.log('ℹ️  Já existem produtos — pulando os dados de exemplo.');
    return;
  }

  const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
  const matriz = await db.unit.findUniqueOrThrow({ where: { name: 'Matriz' } });
  const sede = await db.unit.findUniqueOrThrow({ where: { name: 'Sede' } });

  const fornecedores = await Promise.all(
    [
      { name: 'Distribuidora Tech SP', phone: '(11) 98888-1111' },
      { name: 'Importados Paraguai', phone: '(45) 99777-2222' },
      { name: 'Farma Import', phone: '(11) 97777-3333' },
    ].map((f) => db.supplier.create({ data: f })),
  );

  const categorias = await db.category.findMany();
  const id = (slug: string) => categorias.find((c) => c.slug === slug)!.id;

  /** Estoque dividido entre as duas unidades, para dar o que olhar. */
  const produtos = [
    { dados: { name: 'iPhone 15 Pro Max', brand: 'Apple', model: '15 Pro Max', color: 'Titânio Natural', capacity: '256GB', minQuantity: 2, costPrice: 6200, salePrice: 7899, imei: '356938035643809', categoryId: id('celulares'), supplierId: fornecedores[0].id }, matriz: 5, sede: 2 },
    { dados: { name: 'Samsung Galaxy S24 Ultra', brand: 'Samsung', model: 'S24 Ultra', color: 'Preto', capacity: '512GB', minQuantity: 2, costPrice: 5100, salePrice: 6499, imei: '351756051523999', categoryId: id('celulares'), supplierId: fornecedores[1].id }, matriz: 2, sede: 1 },
    { dados: { name: 'Tirzepatida 5mg', brand: 'Mounjaro', model: '5mg', lote: 'LT-2026-04', minQuantity: 5, costPrice: 890, salePrice: 1450, categoryId: id('tg'), supplierId: fornecedores[2].id }, matriz: 8, sede: 4 },
    { dados: { name: 'JBL Boombox 3', brand: 'JBL', model: 'Boombox 3', color: 'Preto', minQuantity: 2, costPrice: 1900, salePrice: 2799, serialNumber: 'JBLBB3-99201', categoryId: id('jbl'), supplierId: fornecedores[0].id }, matriz: 1, sede: 0 },
    { dados: { name: 'Notebook Dell Inspiron 15', brand: 'Dell', model: 'Inspiron 15 3520', capacity: '512GB SSD / 16GB RAM', minQuantity: 2, costPrice: 2700, salePrice: 3699, serialNumber: 'DL15-2024-4412', categoryId: id('notebooks'), supplierId: fornecedores[0].id }, matriz: 3, sede: 1 },
    { dados: { name: 'PlayStation 5 Slim', brand: 'Sony', model: 'PS5 Slim', color: 'Branco', capacity: '1TB', minQuantity: 1, costPrice: 3100, salePrice: 3999, serialNumber: 'PS5S-77120', categoryId: id('video-games'), supplierId: fornecedores[1].id }, matriz: 2, sede: 0 },
  ];

  for (const { dados, matriz: naMatriz, sede: naSede } of produtos) {
    const produto = await db.product.create({ data: dados });

    for (const [unidade, quantidade] of [
      [matriz, naMatriz],
      [sede, naSede],
    ] as const) {
      if (quantidade <= 0) continue;

      await db.stock.create({
        data: { productId: produto.id, unitId: unidade.id, quantity: quantidade },
      });
      await db.stockMovement.create({
        data: {
          type: 'ENTRADA',
          reason: 'CADASTRO',
          quantity: quantidade,
          previousQuantity: 0,
          newQuantity: quantidade,
          notes: 'Carga inicial de estoque',
          productId: produto.id,
          productName: produto.name,
          unitId: unidade.id,
          userId: admin?.id ?? null,
        },
      });
    }
  }
  console.log(`✅ ${produtos.length} produtos com estoque na Matriz e na Sede`);

  // Uma venda na Sede, para o dashboard não nascer vazio.
  const cliente = await db.customer.create({
    data: { name: 'Maria Silva', phone: '(11) 98123-4567' },
  });
  const iphone = await db.product.findFirst({ where: { name: 'iPhone 15 Pro Max' } });

  if (iphone) {
    const venda = await db.sale.create({
      data: {
        productId: iphone.id,
        unitId: sede.id,
        customerId: cliente.id,
        customerName: cliente.name,
        customerPhone: cliente.phone,
        quantity: 1,
        unitPrice: iphone.salePrice,
        totalPrice: iphone.salePrice,
        costAtSale: iphone.costPrice,
        paymentMethod: 'PIX',
        userId: admin?.id ?? null,
        notes: 'Venda de demonstração',
      },
    });

    const linha = await db.stock.update({
      where: { productId_unitId: { productId: iphone.id, unitId: sede.id } },
      data: { quantity: { decrement: 1 } },
    });

    await db.stockMovement.create({
      data: {
        type: 'SAIDA',
        reason: 'VENDA',
        quantity: 1,
        previousQuantity: linha.quantity + 1,
        newQuantity: linha.quantity,
        notes: 'Venda para Maria Silva',
        productId: iphone.id,
        productName: iphone.name,
        unitId: sede.id,
        saleId: venda.id,
        userId: admin?.id ?? null,
      },
    });
    console.log('✅ 1 venda de demonstração (na Sede)');
  }

  console.log('🎉 Pronto!');
}

main()
  .catch((erro) => {
    console.error('❌ Erro no seed:', erro);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
