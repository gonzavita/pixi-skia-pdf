/**
 * Точка входа приложения.
 *
 * Связывает воедино:
 *   • Pixi-сцену (Канвас 1, Canvas-рендерер Pixi);
 *   • Skia-рендер той же сцены (Канвас 2, CanvasKit);
 *   • события pointerDown/pointerUp на обоих канвасах;
 *   • UI: генерация фигур, сброс сцены, экспорт в PDF.
 */
import './style.css';
import { Container, Graphics, Sprite } from 'pixi.js-legacy';
import type { DisplayObject } from 'pixi.js-legacy';
import { createPixiApp, buildExampleScene } from './pixi/scene';
import { addRandomShape } from './pixi/randomShapes';
import { loadCanvasKit } from './skia/canvaskit-loader';
import { SkiaCanvasView } from './skia/SkiaCanvasView';
import { InteractionManager, attachSkiaPointerEvents } from './events/pointerEvents';
import { exportSceneToPdf } from './skia/pdfExport';

// ── DOM-элементы ────────────────────────────────────────────────────────
const pixiHost = document.getElementById('pixi-host') as HTMLElement;
const skiaCanvas = document.getElementById('skia-canvas') as HTMLCanvasElement;
const btnRandom = document.getElementById('btn-random') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLElement;
const eventLogEl = document.getElementById('event-log') as HTMLElement;

const setStatus = (text: string): void => {
  statusEl.textContent = text;
};

/** Добавляет строку в лог событий (с отметкой времени). */
const logEvent = (message: string): void => {
  const time = new Date().toLocaleTimeString('ru-RU');
  eventLogEl.textContent = `[${time}] ${message}\n${eventLogEl.textContent}`;
};

async function main(): Promise<void> {
  // 1. Загрузка Skia (CanvasKit WASM)
  setStatus('Загрузка CanvasKit (Skia)…');
  const ck = await loadCanvasKit();

  // 2. Pixi-приложение (Канвас 1) — Canvas-рендерер
  const app = createPixiApp();
  pixiHost.appendChild(app.view as unknown as HTMLCanvasElement);
  app.stage.eventMode = 'static'; // включаем систему событий Pixi

  // 3. Тестовая сцена
  let scene = buildExampleScene();
  app.stage.addChild(scene);

  // 4. Skia-вид (Канвас 2)
  const skiaView = new SkiaCanvasView(ck, skiaCanvas);

  // 5. Менеджер событий pointerDown/pointerUp
  const manager = new InteractionManager(logEvent);
  let shapeCounter = 0;

  /** Помечает все Graphics/Sprite контейнера интерактивными. */
  const registerAll = (root: Container): void => {
    let index = 0;
    const walk = (node: DisplayObject): void => {
      if (node instanceof Graphics || node instanceof Sprite) {
        index += 1;
        manager.register(node, `Объект ${index}`);
      }
      if (node instanceof Container) node.children.forEach(walk);
    };
    root.children.forEach(walk);
  };
  registerAll(scene);

  // Хит-тест событий для Skia-канваса
  attachSkiaPointerEvents(skiaCanvas, manager, () => scene);

  // 6. Перерисовка Skia (вызывается при изменениях сцены)
  const redrawSkia = (): void => skiaView.draw(scene);
  redrawSkia();
  // Pixi-канвас перерисовывается своим тикером автоматически;
  // Skia держим синхронным каждый кадр — на случай событийных изменений.
  app.ticker.add(redrawSkia);

  // ── Кнопки управления ─────────────────────────────────────────────────
  btnRandom.addEventListener('click', () => {
    const { shape, description } = addRandomShape(scene);
    shapeCounter += 1;
    manager.register(shape, `Случайная #${shapeCounter} (${description})`);
    logEvent(`＋ добавлена случайная фигура: ${description}`);
    setStatus(`Объектов в сцене: ${scene.children.length}`);
  });

  btnReset.addEventListener('click', () => {
    app.stage.removeChild(scene);
    scene.destroy({ children: true });
    shapeCounter = 0;
    scene = buildExampleScene();
    app.stage.addChild(scene);
    registerAll(scene);
    logEvent('↺ сцена сброшена к исходной');
    setStatus('Сцена сброшена');
  });

  btnExport.addEventListener('click', async () => {
    btnExport.disabled = true;
    setStatus('Генерация PDF через Skia…');
    try {
      logEvent('⏳ запуск экспорта PDF…');
      const blob = await exportSceneToPdf(ck, scene);

      // Скачиваем готовый PDF. <a> обязательно добавляем в DOM — иначе
      // в части браузеров click() по нему не срабатывает. URL отзываем
      // с задержкой, чтобы скачивание успело начаться.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pixi-skia-scene.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      logEvent(`📄 PDF экспортирован (${(blob.size / 1024).toFixed(1)} КБ)`);
      setStatus('PDF готов — файл скачан');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logEvent(`✖ ошибка экспорта PDF: ${msg}`);
      setStatus(`Ошибка PDF: ${msg}`);
    } finally {
      btnExport.disabled = false;
    }
  });

  setStatus(`Готово. Объектов в сцене: ${scene.children.length}`);
  logEvent('Приложение запущено. Pixi + Skia синхронизированы.');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  setStatus(`Критическая ошибка: ${msg}`);
  console.error(err);
});
