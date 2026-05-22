# Pixi → Skia → PDF

Веб-приложение на TypeScript, объединяющее **pixi.js** и **Skia**: реализует
собственную обёртку для рендера `PIXI.Container` средствами Skia (CanvasKit)
и экспортирует сцену в **векторный PDF** через Skia PDF backend.

## Возможности

- 🎨 **Канвас 1** — сцена на pixi.js (`PIXI.Application` с `forceCanvas: true`)
- 🖼 **Канвас 2** — та же сцена, отрисованная через Skia (CanvasKit)
- 🔁 Обёртка `convertPixiContainerToSkia` — рекурсивный обход дерева Pixi
  с переносом трансформаций (translate / rotate / scale) и рендером
  `PIXI.Graphics` (прямоугольник, круг, эллипс, полигон, линии) и `PIXI.Sprite`
- 🖱 События `pointerDown` / `pointerUp` работают на **обоих** канвасах
- 🎲 Кнопка «Сгенерировать случайную линию/фигуру»
- 📄 Экспорт в **векторный PDF** через Skia PDF backend

## Стек

| Слой | Технология |
|------|------------|
| Язык | TypeScript (strict) |
| Сборка | Vite |
| Графика Pixi | `pixi.js-legacy` 7.2.4 (Canvas-рендерер) |
| Графика Skia | CanvasKit (WASM) с PDF backend — `@rollerbird/canvaskit-wasm-pdf` |

## Структура проекта

```
src/
├── main.ts                     точка входа, связывание модулей и UI
├── pixi/
│   ├── scene.ts                PIXI.Application + пример-сцена из ТЗ
│   └── randomShapes.ts         генератор случайных фигур
├── skia/
│   ├── canvaskit-loader.ts     загрузка CanvasKit (WASM)
│   ├── PixiToSkiaRenderer.ts   обёртка: рендер PIXI.Container через Skia
│   ├── SkiaCanvasView.ts       экранный Skia-канвас
│   └── pdfExport.ts            экспорт сцены в PDF через Skia PDF backend
└── events/
    └── pointerEvents.ts        события pointerDown/pointerUp на обоих канвасах
```

## Запуск

Требуется Node.js 18+.

```bash
# 1. установить зависимости
npm install

# 2. режим разработки (http://localhost:5174)
npm run dev

# 3. production-сборка в dist/
npm run build

# 4. предпросмотр собранного
npm run preview
```

## Как это работает

### Обёртка Skia (`PixiToSkiaRenderer`)

`convertPixiContainerToSkia` рекурсивно обходит дерево `PIXI.Container`.
Для каждого объекта:

1. берётся его локальная матрица `PIXI.Transform.localTransform`
   (она уже содержит translate + rotate + scale + pivot);
2. матрица применяется к Skia-канвасу через `canvas.concat(...)`;
3. `PIXI.Graphics` рисуется по `geometry.graphicsData` — каждая фигура
   превращается в Skia-`Path` (rect / oval / rrect / polygon) и заливается
   или обводится;
4. `PIXI.Sprite` рисуется как Skia-`Image` с учётом точки привязки (anchor).

### Экспорт в PDF

`pdfExport.ts` создаёт PDF-документ Skia (`ck.MakePDFDocument`), открывает
страницу (`beginPage`) и рендерит сцену **тем же** `PixiToSkiaRenderer`.
Поэтому фигуры попадают в PDF как **векторные контуры**, а не как растровая
картинка. Используется CanvasKit, собранный с `skia_enable_pdf` —
пакет `@rollerbird/canvaskit-wasm-pdf` (стандартный `canvaskit-wasm` PDF
не содержит, он отключается на этапе компиляции wasm).

### События

- **Канвас Pixi** — штатная система событий Pixi (`eventMode = 'static'`).
- **Канвас Skia** — Skia рисует статичную картинку, поэтому реализован
  ручной хит-тест: координаты клика переводятся в локальную систему объекта
  (`worldTransform.applyInverse`) и проверяются `containsPoint()`.
  Срабатывает тот же слушатель объекта — поведение канвасов идентично.

## Лицензия

Учебный проект (тестовое задание).
