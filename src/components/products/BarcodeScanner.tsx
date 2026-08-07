import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
}

/**
 * Leitor de código de barras / QR usando a câmera do aparelho.
 * Funciona em HTTPS (ou localhost) — exigência dos navegadores.
 */
export function BarcodeScanner({ open, onClose, onDetected, title = 'Ler código de barras' }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setError('');
    setStarting(true);

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices.length) throw new Error('Nenhuma câmera encontrada neste aparelho.');

        // Prefere a câmera traseira nos celulares.
        const back = devices.find((device) => /back|traseira|rear|environment/i.test(device.label));
        const deviceId = back?.deviceId ?? devices[devices.length - 1].deviceId;

        const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result) => {
          if (result && !cancelled) {
            onDetected(result.getText());
            controls.stop();
            onClose();
          }
        });

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStarting(false);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Não foi possível acessar a câmera';
        setError(
          message.includes('Permission') || message.includes('NotAllowed')
            ? 'Permissão de câmera negada. Libere o acesso nas configurações do navegador.'
            : message,
        );
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Aponte a câmera para o código do produto"
      size="sm"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <div className="relative overflow-hidden rounded-xl bg-navy-950">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />

        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-28 w-4/5 rounded-lg border-2 border-accent/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
          </div>
        )}

        {starting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy-950/80 text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">Iniciando câmera…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy-950/90 p-6 text-center">
            <CameraOff className="h-8 w-8 text-danger-soft" />
            <p className="text-sm font-medium text-slate-200">{error}</p>
          </div>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Camera className="h-3.5 w-3.5" />
        Aceita códigos de barras (EAN, CODE128) e QR Code.
      </p>
    </Modal>
  );
}
