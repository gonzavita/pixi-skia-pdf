/**
 * Поддержка событий pointerDown / pointerUp для объектов PIXI.DisplayObject.
 *
 * События должны работать на ОБОИХ канвасах:
 *   • Pixi-канвас  — используется штатная система событий Pixi (eventMode);
 *   • Skia-канвас  — Skia рисует статичную картинку и событий не имеет,
 *     поэтому реализован ручной хит-тест: координаты клика переводятся
 *     в локальную систему объекта и проверяются методом containsPoint().
 *
 * В обоих случаях вызывается один и тот же слушатель объекта (`obj.on(...)`),
 * поэтому поведение канвасов идентично.
 */
import { Container, Graphics, Sprite, Point } from 'pixi.js-legacy';
import type { DisplayObject } from 'pixi.js-legacy';

export type PointerType = 'pointerdown' | 'pointerup';
export type EventLogger = (message: string) => void;

export class InteractionManager {
  constructor(private readonly log: EventLogger) {}

  /**
   * Делает объект интерактивным и вешает слушатели pointerDown/pointerUp.
   * Слушатели срабатывают и от Pixi-канваса, и от Skia-хит-теста.
   */
  register(obj: DisplayObject, label: string): void {
    obj.eventMode = 'static';
    obj.cursor = 'pointer';
    obj.on('pointerdown', () => this.log(`▼ ${label} — pointerDown`));
    obj.on('pointerup', () => this.log(`▲ ${label} — pointerUp`));
  }

  /**
   * Обрабатывает клик по Skia-канвасу: находит верхний объект под точкой
   * и эмулирует на нём то же событие, что сгенерировал бы Pixi.
   */
  handleSkiaPointer(
    root: Container,
    x: number,
    y: number,
    type: PointerType
  ): void {
    // Гарантируем актуальность мировых матриц перед хит-тестом.
    root.updateTransform();
    const hit = this.hitTest(root, new Point(x, y));
    if (hit) hit.emit(type, undefined as never);
  }

  /** Рекурсивный хит-тест: дети проверяются сверху вниз (с конца массива). */
  private hitTest(node: DisplayObject, global: Point): DisplayObject | null {
    if (!node.visible) return null;

    if (node instanceof Container) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const hit = this.hitTest(node.children[i], global);
        if (hit) return hit;
      }
    }

    if (node instanceof Graphics || node instanceof Sprite) {
      const local = node.worldTransform.applyInverse(global);
      if (node.containsPoint(local)) return node;
    }
    return null;
  }
}

/**
 * Привязывает хит-тест к HTML-канвасу Skia.
 * @param canvas  DOM-элемент Skia-канваса
 * @param manager менеджер взаимодействия
 * @param getRoot функция, возвращающая актуальный корневой контейнер
 */
export function attachSkiaPointerEvents(
  canvas: HTMLCanvasElement,
  manager: InteractionManager,
  getRoot: () => Container
): void {
  const toLocal = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    // Переводим координаты курсора в систему координат канваса (CSS-пиксели).
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    const p = toLocal(e);
    manager.handleSkiaPointer(getRoot(), p.x, p.y, 'pointerdown');
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = toLocal(e);
    manager.handleSkiaPointer(getRoot(), p.x, p.y, 'pointerup');
  });
}
