export type Point = Readonly<{ x: number; y: number }>;
export type Viewport = Readonly<{ offset: Point; scale: number }>;
export type Rectangle = Readonly<{ height: number; width: number; x: number; y: number }>;
export type Circle = Readonly<{ center: Point; radius: number }>;

export const screenToWorld = (point: Point, viewport: Viewport): Point => ({
  x: (point.x - viewport.offset.x) / viewport.scale,
  y: (point.y - viewport.offset.y) / viewport.scale,
});

export const worldToScreen = (point: Point, viewport: Viewport): Point => ({
  x: point.x * viewport.scale + viewport.offset.x,
  y: point.y * viewport.scale + viewport.offset.y,
});

export const hitTestRectangle = (point: Point, rectangle: Rectangle): boolean =>
  point.x >= rectangle.x &&
  point.x <= rectangle.x + rectangle.width &&
  point.y >= rectangle.y &&
  point.y <= rectangle.y + rectangle.height;

export const hitTestCircle = (point: Point, circle: Circle): boolean => {
  const deltaX = point.x - circle.center.x;
  const deltaY = point.y - circle.center.y;
  return deltaX * deltaX + deltaY * deltaY <= circle.radius * circle.radius;
};
