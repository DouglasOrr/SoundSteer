"use strict";

export const S = {
  dt: 0.01,
  ship: {
    thrust: 80,
    drag: 0.6,
    angularThrust: 8,
    angularDrag: 0.98,
  },
};

export class GameMap {
  /**
   * @param {number} width
   * @param {number} height
   * @param {Array<boolean>} walls
   */
  constructor(width, height, walls) {
    this.width = width;
    this.height = height;
    this.walls = walls;
  }

  /**
   * @param {ImageData} img
   * @returns {GameMap}
   */
  static load(img) {
    const data32 = new Uint32Array(img.data.buffer);
    const walls = new Array(img.height * img.width);
    for (let j = 0; j < img.height; ++j) {
      for (let i = 0; i < img.width; ++i) {
        const px = data32[j * img.width + i];
        walls[j * img.width + i] = px == 0xff000000;
      }
    }
    return new GameMap(img.width, img.height, walls);
  }
}

export class Ship {
  constructor() {
    this.position = [384, 384];
    this.velocity = [0, 0];
    this.orientation = Math.PI;
    this.angularVelocity = 0;
  }

  /**
   * @param {{left: number, forward: number, right: number}} control
   */
  update(control) {
    const c = S.ship;
    this.velocity[0] *= Math.pow(1 - c.drag, S.dt);
    this.velocity[1] *= Math.pow(1 - c.drag, S.dt);
    const acceleration =
      c.thrust *
      (1 * control.forward + 0.5 * control.left + 0.5 * control.right);
    this.velocity[0] += S.dt * acceleration * -Math.sin(this.orientation);
    this.velocity[1] += S.dt * acceleration * Math.cos(this.orientation);

    this.position[0] += S.dt * this.velocity[0];
    this.position[1] += S.dt * this.velocity[1];

    this.angularVelocity *= Math.pow(1 - c.angularDrag, S.dt);
    this.angularVelocity +=
      (control.right - control.left) * S.dt * c.angularThrust;
    this.orientation += S.dt * this.angularVelocity;
  }
}
