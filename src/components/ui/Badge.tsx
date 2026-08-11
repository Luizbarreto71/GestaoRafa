import { cn } from '@/lib/cn';
import { MOVEMENT_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '@/lib/format';
import type { MovementType, PaymentMethod, ProductStatus, TransferStatus } from '@/types';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'purple';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-navy-700 dark:text-slate-300',
  success: 'bg-success-bg text-success dark:bg-success/15 dark:text-success-soft',
  danger: 'bg-danger-bg text-danger dark:bg-danger/15 dark:text-danger-soft',
  warning: 'bg-warning-bg text-warning dark:bg-warning/15 dark:text-warning-soft',
  info: 'bg-blue-100 text-blue-700 dark:bg-accent/15 dark:text-accent-soft',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<ProductStatus, Tone> = {
  EM_ESTOQUE: 'success',
  RESERVADO: 'warning',
  VENDIDO: 'neutral',
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const MOVEMENT_TONE: Record<MovementType, Tone> = {
  ENTRADA: 'success',
  SAIDA: 'info',
  TRANSFERENCIA: 'purple',
  AJUSTE: 'warning',
};

const TRANSFER_TONE: Record<TransferStatus, Tone> = {
  PENDENTE: 'warning',
  EM_TRANSITO: 'info',
  RECEBIDA: 'success',
  CANCELADA: 'danger',
};

const TRANSFER_LABEL: Record<TransferStatus, string> = {
  PENDENTE: 'Pendente',
  EM_TRANSITO: 'Em trânsito',
  RECEBIDA: 'Recebida',
  CANCELADA: 'Cancelada',
};

export function TransferBadge({ status }: { status: TransferStatus }) {
  return <Badge tone={TRANSFER_TONE[status]}>{TRANSFER_LABEL[status]}</Badge>;
}

/** Nome da unidade, com um ponto colorido para diferenciar de relance. */
export function UnitBadge({ name, tone = 'neutral' }: { name: string; tone?: Tone }) {
  return <Badge tone={tone}>{name}</Badge>;
}

export function MovementBadge({ type }: { type: MovementType }) {
  return <Badge tone={MOVEMENT_TONE[type]}>{MOVEMENT_LABEL[type]}</Badge>;
}

const PAYMENT_TONE: Record<PaymentMethod, Tone> = {
  PIX: 'success',
  DINHEIRO: 'warning',
  DEBITO: 'info',
  CREDITO: 'purple',
  TRANSFERENCIA: 'neutral',
};

export function PaymentBadge({ method }: { method: PaymentMethod }) {
  return <Badge tone={PAYMENT_TONE[method]}>{PAYMENT_LABEL[method]}</Badge>;
}

/** Realça a situação do estoque de um produto. */
export function StockBadge({ quantity, minQuantity }: { quantity: number; minQuantity: number }) {
  if (quantity === 0) return <Badge tone="danger">Sem estoque</Badge>;
  if (quantity <= minQuantity) return <Badge tone="warning">Baixo · {quantity}</Badge>;
  return <Badge tone="success">{quantity} un.</Badge>;
}
