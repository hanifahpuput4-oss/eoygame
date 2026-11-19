import { WORLD } from '../maps/world';

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  minX = 0;
  minY = 0;
  maxX = WORLD.width;
  maxY = WORLD.height;

  constructor(
    public viewportWidth: number,
    public viewportHeight: number,
  ) {}

  follow(targetX: number, targetY: number, smoothing = 0.12) {
    const targetCx = targetX - this.viewportWidth / (2 * this.zoom);
    const targetCy = targetY - this.viewportHeight / (2 * this.zoom);
    this.x += (targetCx - this.x) * smoothing;
    this.y += (targetCy - this.y) * smoothing;
    this.clamp();
  }

  panBy(dx: number, dy: number) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clamp();
  }

  zoomBy(delta: number) {
    const next = Math.min(2, Math.max(0.5, this.zoom + delta));
    this.zoom = next;
    this.clamp();
  }

  clamp() {
    const visibleW = this.viewportWidth / this.zoom;
    const visibleH = this.viewportHeight / this.zoom;
    this.x = Math.min(Math.max(this.x, this.minX), Math.max(this.minX, this.maxX - visibleW));
    this.y = Math.min(Math.max(this.y, this.minY), Math.max(this.minY, this.maxY - visibleH));
  }

  resize(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.clamp();
  }

  applyTransform(ctx: CanvasRenderingContext2D) {
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
}
