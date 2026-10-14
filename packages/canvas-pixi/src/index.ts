import type { Point, Rectangle } from "@arcane-table/canvas-core";
import type { Container, Graphics } from "pixi.js";

export type PixiAdapter = Readonly<{
  drawRectangle: (rectangle: Rectangle, color: number) => Graphics;
  setPosition: (displayObject: Container, point: Point) => void;
}>;

export type PixiAdapterDependencies = Readonly<{
  createGraphics: () => Graphics;
  stage: Container;
}>;

export const createPixiAdapter = ({
  createGraphics,
  stage,
}: PixiAdapterDependencies): PixiAdapter => ({
  drawRectangle: (rectangle, color) => {
    const graphics = createGraphics();
    graphics.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height).fill(color);
    stage.addChild(graphics);
    return graphics;
  },
  setPosition: (displayObject, point) => {
    displayObject.position.set(point.x, point.y);
  },
});
