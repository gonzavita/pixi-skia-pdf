/**
 * Управление экранным Skia-канвасом.
 *
 * Создаёт Skia Surface поверх <canvas> и перерисовывает в него
 * переданный PIXI.Container с помощью PixiToSkiaRenderer.
 */
import type { CanvasKit, Surface } from '@rollerbird/canvaskit-wasm-pdf';
import type { Container } from 'pixi.js-legacy';
import { PixiToSkiaRenderer } from './PixiToSkiaRenderer';

export class SkiaCanvasView {
  private readonly surface: Surface;
  private readonly renderer: PixiToSkiaRenderer;

  constructor(ck: CanvasKit, canvas: HTMLCanvasElement) {
    const surface = ck.MakeCanvasSurface(canvas);
    if (!surface) {
      throw new Error('Не удалось создать Skia Surface на канвасе');
    }
    this.surface = surface;
    this.renderer = new PixiToSkiaRenderer(ck);
  }

  /** Перерисовывает сцену в Skia-канвас. */
  draw(container: Container): void {
    const canvas = this.surface.getCanvas();
    this.renderer.render(canvas, container);
    this.surface.flush();
  }

  dispose(): void {
    this.surface.delete();
  }
}
