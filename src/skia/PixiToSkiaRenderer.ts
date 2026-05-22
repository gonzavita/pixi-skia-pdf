/**
 * Обёртка для рендера PIXI.Container средствами Skia (CanvasKit).
 *
 * Класс обходит дерево отображаемых объектов Pixi, применяет к Skia-канвасу
 * локальные матрицы трансформаций (translate / rotate / scale — берутся прямо
 * из `PIXI.Transform.localTransform`) и рисует поддерживаемые объекты:
 *   • PIXI.Graphics — прямоугольник, круг, эллипс, скруглённый прямоугольник,
 *     полигон и линии (moveTo/lineTo);
 *   • PIXI.Sprite — растровые изображения (png).
 *
 * Тот же код используется и для экранного канваса, и для PDF-канваса —
 * Skia-канвас в обоих случаях имеет одинаковый интерфейс.
 */
import {
  Container,
  Graphics,
  Sprite,
  SHAPES,
  LINE_CAP,
  LINE_JOIN,
} from 'pixi.js-legacy';
import type {
  DisplayObject,
  Circle,
  Ellipse,
  Polygon,
  Rectangle,
  RoundedRectangle,
} from 'pixi.js-legacy';
import type {
  CanvasKit,
  Canvas as SkCanvas,
  Paint,
  Path,
  Image,
} from '@rollerbird/canvaskit-wasm-pdf';

export class PixiToSkiaRenderer {
  /** Кеш SkImage по исходному HTML-источнику — чтобы не пересоздавать на каждый кадр. */
  private readonly imageCache = new WeakMap<object, Image>();

  constructor(private readonly ck: CanvasKit) {}

  /**
   * Полностью отрисовывает контейнер в Skia-канвас.
   * @param canvas    целевой Skia-канвас (экранный или PDF)
   * @param container корневой PIXI.Container
   * @param clearWhite заливать ли фон белым (true для экрана/PDF-страницы)
   */
  render(canvas: SkCanvas, container: Container, clearWhite = true): void {
    if (clearWhite) {
      canvas.clear(this.ck.WHITE);
    }
    this.renderObject(canvas, container, 1);
  }

  // ── Рекурсивный обход дерева ──────────────────────────────────────────
  private renderObject(
    canvas: SkCanvas,
    obj: DisplayObject,
    parentAlpha: number
  ): void {
    if (!obj.visible) return;

    const alpha = parentAlpha * obj.alpha;

    // Локальная матрица объекта = его translate + rotate + scale + pivot.
    obj.transform.updateLocalTransform();
    const m = obj.transform.localTransform;

    canvas.save();
    // PIXI.Matrix {a,b,c,d,tx,ty} -> Skia 3x3 (row-major).
    canvas.concat([m.a, m.c, m.tx, m.b, m.d, m.ty, 0, 0, 1]);

    if (obj instanceof Graphics) {
      this.drawGraphics(canvas, obj, alpha);
    } else if (obj instanceof Sprite) {
      this.drawSprite(canvas, obj, alpha);
    }

    // Дочерние элементы (Container, а также вложенные дети Graphics/Sprite).
    if (obj instanceof Container) {
      for (const child of obj.children) {
        this.renderObject(canvas, child, alpha);
      }
    }

    canvas.restore();
  }

  // ── PIXI.Graphics ─────────────────────────────────────────────────────
  private drawGraphics(canvas: SkCanvas, g: Graphics, alpha: number): void {
    for (const data of g.geometry.graphicsData) {
      const path = this.buildPath(data.shape);
      if (!path) continue;

      // Заливка
      const fill = data.fillStyle;
      if (fill && fill.visible) {
        const paint = this.makePaint(fill.color, fill.alpha * alpha);
        paint.setStyle(this.ck.PaintStyle.Fill);
        canvas.drawPath(path, paint);
        paint.delete();
      }

      // Обводка / линия
      const line = data.lineStyle;
      if (line && line.visible && line.width > 0) {
        const paint = this.makePaint(line.color, line.alpha * alpha);
        paint.setStyle(this.ck.PaintStyle.Stroke);
        paint.setStrokeWidth(line.width);
        paint.setStrokeCap(this.mapCap(line.cap));
        paint.setStrokeJoin(this.mapJoin(line.join));
        canvas.drawPath(path, paint);
        paint.delete();
      }

      path.delete();
    }
  }

  /** Строит Skia-путь из геометрической фигуры Pixi. */
  private buildPath(shape: unknown): Path | null {
    const ck = this.ck;
    const path = new ck.Path();
    const s = shape as { type: number };

    switch (s.type) {
      case SHAPES.RECT: {
        const r = shape as Rectangle;
        path.addRect(ck.LTRBRect(r.x, r.y, r.x + r.width, r.y + r.height));
        break;
      }
      case SHAPES.CIRC: {
        const c = shape as Circle;
        path.addOval(
          ck.LTRBRect(c.x - c.radius, c.y - c.radius, c.x + c.radius, c.y + c.radius)
        );
        break;
      }
      case SHAPES.ELIP: {
        // В PIXI.Ellipse width/height — это полуоси (radius X / radius Y).
        const e = shape as Ellipse;
        path.addOval(
          ck.LTRBRect(e.x - e.width, e.y - e.height, e.x + e.width, e.y + e.height)
        );
        break;
      }
      case SHAPES.RREC: {
        const r = shape as RoundedRectangle;
        path.addRRect(
          ck.RRectXY(
            ck.LTRBRect(r.x, r.y, r.x + r.width, r.y + r.height),
            r.radius,
            r.radius
          )
        );
        break;
      }
      case SHAPES.POLY: {
        // Полигон используется и для замкнутых фигур, и для линий (moveTo/lineTo).
        const poly = shape as Polygon;
        const pts = poly.points;
        if (pts.length < 4) {
          path.delete();
          return null;
        }
        path.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          path.lineTo(pts[i], pts[i + 1]);
        }
        if (poly.closeStroke) path.close();
        break;
      }
      default: {
        path.delete();
        return null;
      }
    }
    return path;
  }

  // ── PIXI.Sprite ───────────────────────────────────────────────────────
  private drawSprite(canvas: SkCanvas, sprite: Sprite, alpha: number): void {
    const texture = sprite.texture;
    const resource = texture.baseTexture.resource as { source?: unknown };
    const source = resource?.source;
    if (!source) return;

    const img = this.getSkImage(source as object);
    if (!img) return;

    const ck = this.ck;
    const w = texture.orig.width;
    const h = texture.orig.height;
    // Учитываем точку привязки (anchor) спрайта.
    const dx = -sprite.anchor.x * w;
    const dy = -sprite.anchor.y * h;

    const src = ck.XYWHRect(
      texture.frame.x,
      texture.frame.y,
      texture.frame.width,
      texture.frame.height
    );
    const dst = ck.XYWHRect(dx, dy, w, h);

    const paint = new ck.Paint();
    paint.setAntiAlias(true);
    paint.setAlphaf(Math.max(0, Math.min(1, alpha)));
    canvas.drawImageRect(img, src, dst, paint, false);
    paint.delete();
  }

  /** Создаёт (с кешированием) SkImage из HTML-источника изображения. */
  private getSkImage(source: object): Image | null {
    const cached = this.imageCache.get(source);
    if (cached) return cached;

    const img = this.ck.MakeImageFromCanvasImageSource(
      source as CanvasImageSource
    );
    if (img) this.imageCache.set(source, img);
    return img ?? null;
  }

  // ── Вспомогательное ───────────────────────────────────────────────────
  private makePaint(color: number, alpha: number): Paint {
    const paint = new this.ck.Paint();
    paint.setAntiAlias(true);
    paint.setColor(this.color4f(color, alpha));
    return paint;
  }

  /** Pixi-цвет (0xRRGGBB) + alpha -> Skia Color4f. */
  private color4f(color: number, alpha: number) {
    const r = ((color >> 16) & 0xff) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;
    return this.ck.Color4f(r, g, b, Math.max(0, Math.min(1, alpha)));
  }

  private mapCap(cap: LINE_CAP) {
    const ck = this.ck;
    if (cap === LINE_CAP.ROUND) return ck.StrokeCap.Round;
    if (cap === LINE_CAP.SQUARE) return ck.StrokeCap.Square;
    return ck.StrokeCap.Butt;
  }

  private mapJoin(join: LINE_JOIN) {
    const ck = this.ck;
    if (join === LINE_JOIN.ROUND) return ck.StrokeJoin.Round;
    if (join === LINE_JOIN.BEVEL) return ck.StrokeJoin.Bevel;
    return ck.StrokeJoin.Miter;
  }
}

/**
 * Функция-обёртка из ТЗ: рендерит PIXI.Container средствами Skia.
 * Требует экземпляр CanvasKit и целевой Skia-канвас.
 */
export function convertPixiContainerToSkia(
  ck: CanvasKit,
  canvas: SkCanvas,
  container: Container,
  clearWhite = true
): void {
  new PixiToSkiaRenderer(ck).render(canvas, container, clearWhite);
}
