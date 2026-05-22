/**
 * Генерация случайных фигур и линий — для кнопки
 * «Сгенерировать случайную линию/фигуру» (интерактивность из ТЗ).
 */
import { Container, Graphics } from 'pixi.js-legacy';

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function randomColor(): number {
  return randInt(0, 0xffffff);
}

/**
 * Создаёт случайный PIXI.Graphics (прямоугольник, эллипс, треугольник или
 * линия) со случайными трансформациями и добавляет его в контейнер.
 *
 * @returns созданный объект и текстовое описание (для лога событий)
 */
export function addRandomShape(container: Container): {
  shape: Graphics;
  description: string;
} {
  const g = new Graphics();
  const kind = randInt(0, 3);
  let description: string;

  switch (kind) {
    case 0: {
      // Прямоугольник
      const w = rand(40, 120);
      const h = rand(40, 120);
      g.beginFill(randomColor()).drawRect(-w / 2, -h / 2, w, h).endFill();
      description = 'прямоугольник';
      break;
    }
    case 1: {
      // Эллипс
      const rx = rand(25, 70);
      const ry = rand(25, 70);
      g.beginFill(randomColor()).drawEllipse(0, 0, rx, ry).endFill();
      description = 'эллипс';
      break;
    }
    case 2: {
      // Треугольник (полигон)
      g.beginFill(randomColor())
        .drawPolygon([0, -50, 50, 40, -50, 40])
        .endFill();
      description = 'треугольник';
      break;
    }
    default: {
      // Линия
      g.lineStyle(rand(4, 12), randomColor(), 1)
        .moveTo(0, 0)
        .lineTo(rand(60, 160), rand(-60, 60));
      description = 'линия';
      break;
    }
  }

  // Случайные трансформации (translate / rotate / scale)
  g.position.set(rand(40, 540), rand(40, 380));
  g.angle = rand(0, 360);
  g.scale.set(rand(0.6, 1.4));

  container.addChild(g);
  return { shape: g, description };
}
