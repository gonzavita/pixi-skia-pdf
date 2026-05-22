/**
 * Загрузчик CanvasKit (WASM-сборка Skia) — версия с PDF backend.
 *
 * Используется пакет @rollerbird/canvaskit-wasm-pdf — это CanvasKit,
 * скомпилированный с включённым `skia_enable_pdf`, поэтому доступен
 * Skia PDF backend (`ck.MakePDFDocument`). Стандартный `canvaskit-wasm`
 * PDF-поддержки не содержит (она отключена на этапе компиляции wasm).
 *
 * Сам .wasm-файл лежит в `public/canvaskit-pdf.wasm` и копируется в сборку
 * как есть — CanvasKit подгружает его в рантайме через `locateFile`.
 */
import CanvasKitInit from '@rollerbird/canvaskit-wasm-pdf';
import type { CanvasKit } from '@rollerbird/canvaskit-wasm-pdf';

const WASM_URL = `${import.meta.env.BASE_URL}canvaskit-pdf.wasm`;

let cached: Promise<CanvasKit> | null = null;

/** Возвращает (и при первом вызове инициализирует) экземпляр CanvasKit с PDF. */
export function loadCanvasKit(): Promise<CanvasKit> {
  if (!cached) {
    cached = CanvasKitInit({ locateFile: () => WASM_URL });
  }
  return cached;
}
