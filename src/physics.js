"use strict";

export const S = {
  dt: 0.01,
  ship: {
    radius: 0.25,
    bounce: 2,
    thrust: 4,
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
   * @param {Array<{position: [number, number], orientation: number}>} start
   */
  constructor(width, height, walls, start) {
    this.width = width;
    this.height = height;
    this.walls = walls;
    this.start = start;
  }

  /**
   * @param {ImageData} img
   * @returns {GameMap}
   */
  static load(img) {
    // Format: abgr
    const data32 = new Uint32Array(img.data.buffer);
    const walls = new Array(img.height * img.width);
    const start = [];
    for (let j = 0; j < img.height; ++j) {
      for (let i = 0; i < img.width; ++i) {
        const px = data32[j * img.width + i];
        walls[j * img.width + i] = px == 0xff000000;
        if ((px & 0xfff0f0f0) === (0xfff00000 | 0)) {
          start[(px & 0x000f0000) >> 16] = {
            position: [i + 0.5, j + 0.5],
            orientation: Math.PI * ((1 + ((px & 0x00000f00) >> 8) / 2) % 2),
          };
        }
      }
    }
    start.forEach((v) => console.assert(v !== undefined));
    return new GameMap(img.width, img.height, walls, start);
  }
}

export class Ship {
  constructor(position, orientation) {
    this.position = [...position];
    this.velocity = [0, 0];
    this.orientation = orientation;
    this.angularVelocity = 0;
  }

  /**
   * @param {{left: number, forward: number, right: number}} control
   * @param {GameMap} map
   */
  update(control, map) {
    const c = S.ship;

    // Acceleration
    this.velocity[0] *= Math.pow(1 - c.drag, S.dt);
    this.velocity[1] *= Math.pow(1 - c.drag, S.dt);
    const acceleration =
      c.thrust *
      (1 * control.forward + 0.5 * control.left + 0.5 * control.right);
    this.velocity[0] += S.dt * acceleration * -Math.sin(this.orientation);
    this.velocity[1] += S.dt * acceleration * Math.cos(this.orientation);

    // Collisions
    const cx = Math.floor(this.position[0]);
    const cy = Math.floor(this.position[1]);
    const collidex =
      map.walls[cy * map.width + Math.floor(this.position[0] + c.radius)] -
      map.walls[cy * map.width + Math.floor(this.position[0] - c.radius)];
    const collidey =
      map.walls[Math.floor(this.position[1] + c.radius) * map.width + cx] -
      map.walls[Math.floor(this.position[1] - c.radius) * map.width + cx];
    this.velocity[0] =
      (collidex === 0) * this.velocity[0] - collidex * c.bounce;
    this.velocity[1] =
      (collidey === 0) * this.velocity[1] - collidey * c.bounce;

    // Position
    this.position[0] += S.dt * this.velocity[0];
    this.position[1] += S.dt * this.velocity[1];

    // Rotation
    this.angularVelocity *= Math.pow(1 - c.angularDrag, S.dt);
    this.angularVelocity +=
      (control.right - control.left) * S.dt * c.angularThrust;
    this.orientation += S.dt * this.angularVelocity;
    this.orientation %= 2 * Math.PI;
  }
}
