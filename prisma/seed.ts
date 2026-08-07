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

const CATEGORIAS = [
  { name: 'Celulares', slug: 'celulares', color: '#3B82F6' },
  { name: 'TG (Tirzepatida)', slug: 'tg', color: '#8B5CF6' },
  { name: 'JBL', slug: 'jbl', color: '#F97316' },
  { name: 'Notebooks', slug: 'notebooks', color: '#14B8A6' },
  { name: 'Video Games', slug: 'video-games', color: '#EC4899' },
];

async function main() {
  console.log('🌱 Preparando o banco...');

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

  const fornecedores = await Promise.all(
    [
      { name: 'Distribuidora Tech SP', phone: '(11) 98888-1111' },
      { name: 'Importados Paraguai', phone: '(45) 99777-2222' },
      { name: 'Farma Import', phone: '(11) 97777-3333' },
    ].map((f) => db.supplier.create({ data: f })),
  );

  const categorias = await db.category.findMany();
  const id = (slug: string) => categorias.find((c) => c.slug === slug)!.id;

  const produtos = [
    {
      name: 'iPhone 15 Pro Max',
      brand: 'Apple',
      model: '15 Pro Max',
      color: 'Titânio Natural',
      capacity: '256GB',
      quantity: 3,
      minQuantity: 2,
      costPrice: 6200,
      salePrice: 7899,
      imei: '356938035643809',
      categoryId: id('celulares'),
      supplierId: fornecedores[0].id,
    },
    {
      name: 'Samsung Galaxy S24 Ultra',
      brand: 'Samsung',
      model: 'S24 Ultra',
      color: 'Preto',
      capacity: '512GB',
      quantity: 2,
      minQuantity: 2,
      costPrice: 5100,
      salePrice: 6499,
      imei: '351756051523999',
      categoryId: id('celulares'),
      supplierId: fornecedores[1].id,
    },
    {
      name: 'Tirzepatida 5mg',
      brand: 'Mounjaro',
      model: '5mg',
      capacity: '4 canetas',
      quantity: 12,
      minQuantity: 5,
      costPrice: 890,
      salePrice: 1450,
      categoryId: id('tg'),
      supplierId: fornecedores[2].id,
    },
    {
      name: 'JBL Boombox 3',
      brand: 'JBL',
      model: 'Boombox 3',
      color: 'Preto',
      quantity: 1,
      minQuantity: 2,
      costPrice: 1900,
      salePrice: 2799,
      serialNumber: 'JBLBB3-99201',
      categoryId: id('jbl'),
      supplierId: fornecedores[0].id,
    },
    {
      name: 'Notebook Dell Inspiron 15',
      brand: 'Dell',
      model: 'Inspiron 15 3520',
      color: 'Prata',
      capacity: '512GB SSD / 16GB RAM',
      quantity: 4,
      minQuantity: 2,
      costPrice: 2700,
      salePrice: 3699,
      serialNumber: 'DL15-2024-4412',
      categoryId: id('notebooks'),
      supplierId: fornecedores[0].id,
    },
    {
      name: 'PlayStation 5 Slim',
      brand: 'Sony',
      model: 'PS5 Slim',
      color: 'Branco',
      capacity: '1TB',
      quantity: 2,
      minQuantity: 1,
      costPrice: 3100,
      salePrice: 3999,
      serialNumber: 'PS5S-77120',
      categoryId: id('video-games'),
      supplierId: fornecedores[1].id,
    },
  ];

  for (const dados of produtos) {
    const produto = await db.product.create({ data: dados });
    await db.movement.create({
      data: {
        type: 'ENTRADA',
        quantity: produto.quantity,
        balanceAfter: produto.quantity,
        reason: 'Carga inicial de estoque',
        productId: produto.id,
        productName: produto.name,
        userId: admin?.id ?? null,
      },
    });
  }
  console.log(`✅ ${produtos.length} produtos de exemplo`);

  // Uma venda para o dashboard não nascer vazio.
  const cliente = await db.customer.create({
    data: { name: 'Maria Silva', phone: '(11) 98123-4567' },
  });
  const iphone = await db.product.findFirst({ where: { name: 'iPhone 15 Pro Max' } });

  if (iphone) {
    const venda = await db.sale.create({
      data: {
        productId: iphone.id,
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

    const atualizado = await db.product.update({
      where: { id: iphone.id },
      data: { quantity: { decrement: 1 } },
    });

    await db.movement.create({
      data: {
        type: 'SAIDA',
        quantity: 1,
        balanceAfter: atualizado.quantity,
        reason: 'Venda para Maria Silva',
        productId: iphone.id,
        productName: iphone.name,
        saleId: venda.id,
        userId: admin?.id ?? null,
      },
    });
    console.log('✅ 1 venda de demonstração');
  }

  console.log('🎉 Pronto!');
}

main()
  .catch((erro) => {
    console.error('❌ Erro no seed:', erro);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
