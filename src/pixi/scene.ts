/**
 * Создание PIXI.Application и тестовой сцены.
 *
 * По ТЗ: используется pixi.js версии 7.2.4 (legacy-сборка), а PIXI.Application
 * создаётся с флагом forceCanvas=true — то есть Pixi рисует через Canvas2D
 * (не WebGL). Это нужно, чтобы сравнение с Skia-рендером было «канвас в канвас».
 */
import { Application, Container, Graphics } from 'pixi.js-legacy';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 360;

/** Создаёт PIXI.Application с Canvas-рендерером. */
export function createPixiApp(): Application {
  return new Application({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: 0xffffff,
    forceCanvas: true, // ТЗ: обязательно forceCanvas=true
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
}

/**
 * Строит пример Pixi-сцены из ТЗ: вложенный контейнер с эллипсом,
 * прямоугольником и двумя линиями. Контейнер слегка уменьшен и сдвинут,
 * чтобы целиком помещаться в канвас 480×360.
 */
export function buildExampleScene(): Container {
  const mainContainer = new Container();
  const subContainer = new Container();

  const g1 = new Graphics();
  const g2 = new Graphics();
  const g3 = new Graphics();
  const g4 = new Graphics();

  // g1 — красный эллипс, сдвиг + поворот
  g1.beginFill(0xff0000).drawEllipse(0, 0, 200, 100).endFill();
  g1.position.set(200, 100);
  g1.angle = 30;

  // g2 — синий прямоугольник, сдвиг + поворот + масштаб
  g2.beginFill(0x0000ff).drawRect(-50, -75, 100, 150).endFill();
  g2.position.set(120, 60);
  g2.angle = 15;
  g2.scale.set(1.5, 1.7);

  // g3, g4 — белая и жёлтая линии внутри вложенного контейнера
  g3.lineStyle(10, 0xffffff, 1).moveTo(0, 0).lineTo(150, 100);
  g3.angle = -20;

  g4.lineStyle(10, 0xffff00, 1).moveTo(0, 70).lineTo(150, -30);
  g4.angle = 20;

  subContainer.position.set(75, 50);
  subContainer.addChild(g3, g4);

  mainContainer.addChild(subContainer, g1, g2);

  // Вписываем всю сцену в размеры канваса
  mainContainer.scale.set(0.75);
  mainContainer.position.set(30, 60);

  return mainContainer;
}
