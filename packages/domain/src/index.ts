declare const brand: unique symbol;

export type Brand<Value, Name extends string> = Value & { readonly [brand]: Name };
export type CanvasId = Brand<string, "CanvasId">;
export type CommandId = Brand<string, "CommandId">;
export type TokenId = Brand<string, "TokenId">;

export type Result<Value, ErrorValue> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ error: ErrorValue; ok: false }>;

export const ok = <Value>(value: Value): Result<Value, never> => ({ ok: true, value });
export const err = <ErrorValue>(error: ErrorValue): Result<never, ErrorValue> => ({
  error,
  ok: false,
});

export type Point = Readonly<{ x: number; y: number }>;

export type DomainCommand =
  | Readonly<{
      canvasId: CanvasId;
      commandId: CommandId;
      name: string;
      type: "canvas.create";
    }>
  | Readonly<{
      canvasId: CanvasId;
      commandId: CommandId;
      position: Point;
      tokenId: TokenId;
      type: "token.move";
    }>;

const asId = <Name extends string>(value: string): Result<Brand<string, Name>, "invalid-id"> =>
  value.trim().length > 0 ? ok(value as Brand<string, Name>) : err("invalid-id");

export const canvasId = (value: string): Result<CanvasId, "invalid-id"> => asId<"CanvasId">(value);
export const commandId = (value: string): Result<CommandId, "invalid-id"> =>
  asId<"CommandId">(value);
export const tokenId = (value: string): Result<TokenId, "invalid-id"> => asId<"TokenId">(value);
