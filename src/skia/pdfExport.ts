/**
 * Экспорт сцены в PDF через Skia PDF backend.
 *
 * Результат — ВЕКТОРНЫЙ PDF: страница собирается теми же Skia-командами
 * рисования (drawPath / drawImageRect), что и экранный канвас, но рисование
 * идёт не в растровую поверхность, а в PDF-документ Skia (`Document`).
 * Фигуры попадают в PDF как векторные контуры, а не как картинка.
 *
 * Используется CanvasKit, собранный с PDF backend (@rollerbird/canvaskit-wasm-pdf).
 */
import type { CanvasKit, PDFMetadata } from '@rollerbird/canvaskit-wasm-pdf';
import type { Container } from 'pixi.js-legacy';
import { PixiToSkiaRenderer } from './PixiToSkiaRenderer';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../pixi/scene';

/**
 * Рендерит сцену в PDF и возвращает Blob (`application/pdf`).
 * @throws Error если сборка CanvasKit не содержит PDF backend.
 */
export async function exportSceneToPdf(
  ck: CanvasKit,
  scene: Container
): Promise<Blob> {
  // Проверяем, что CanvasKit действительно собран с PDF backend.
  if (!ck.pdf || typeof ck.MakePDFDocument !== 'function') {
    throw new Error(
      'Текущая сборка CanvasKit без PDF backend. Нужен @rollerbird/canvaskit-wasm-pdf.'
    );
  }

  const metadata: PDFMetadata = {
    title: 'Pixi → Skia сцена',
    creator: 'pixi-skia-pdf',
    producer: 'Skia PDF backend (CanvasKit)',
    // CanvasKit-обёртка ставит внутреннее поле `_rootTag` только при наличии
    // `rootTag`, а нативный embind требует его всегда (иначе ошибка
    // «Missing field _rootTag»). Передаём минимальный корневой тег документа.
    rootTag: {
      id: 1,
      type: 'Document',
      alt: '',
      language: 'ru',
      attributes: [],
      children: [],
    },
  };

  // Создаём PDF-документ и страницу того же размера, что и канвас сцены.
  const doc = ck.MakePDFDocument(metadata);
  const pageCanvas = doc.beginPage(CANVAS_WIDTH, CANVAS_HEIGHT);

  // Тот же рендерер, что и для экрана — гарантирует векторный результат:
  // фигуры рисуются Skia-путями напрямую в PDF-страницу.
  const renderer = new PixiToSkiaRenderer(ck);
  renderer.render(pageCanvas, scene, true);

  doc.endPage();
  const bytes = doc.close(); // Uint8Array с готовым PDF

  // Копируем в обычный ArrayBuffer — корректный BlobPart для Blob.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: 'application/pdf' });
}
