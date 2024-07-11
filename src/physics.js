"use strict";

export const S = {
  dt: 0.01,
  ship: {
    radius: 0.25,
    bounce: 2.5,
    thrust: 10,
    drag: 0.75,
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
   * @param {Array<Array<number>>} checkpoints
   */
  constructor(width, height, walls, start, checkpoints) {
    this.width = width;
    this.height = height;
    this.walls = walls;
    this.start = start;
    this.checkpoints = checkpoints;
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
    const checkpoints = [];
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
        if ((px & 0xfff0f0f0) === (0xff0000f0 | 0)) {
          const index = px & 0x0000000f;
          if (checkpoints[index] === undefined) {
            checkpoints[index] = [];
          }
          checkpoints[index].push(j * img.width + i);
        }
      }
    }
    start.forEach((v) => console.assert(v !== undefined));
    return new GameMap(img.width, img.height, walls, start, checkpoints);
  }
}

export class Ship {
  /**
   * @param {[number, number]} position
   * @param {number} orientation
   */
  constructor(position, orientation) {
    this.position = [...position];
    this.velocity = [0, 0];
    this.orientation = orientation;
    this.angularVelocity = 0;
    this.checkpoint = -1;
    this.lapStartTime = null;
    /**
     * @type {Array<Function<number>>}
     */
    this.lapTimeListeners = [];
    this.control = { left: 0, forward: 0, right: 0 };
  }

  /**
   * @param {{left: number, forward: number, right: number}} control
   * @param {GameMap} map
   */
  update(control, map) {
    const c = S.ship;
    const cx = Math.floor(this.position[0]);
    const cy = Math.floor(this.position[1]);
    this.control = control;

    // Progress
    for (let i = 0; i < map.checkpoints.length; ++i) {
      if (map.checkpoints[i].includes(cy * map.width + cx)) {
        if (i === (this.checkpoint + 1) % map.checkpoints.length) {
          this.checkpoint = i;
          if (this.checkpoint === 0) {
            const time = Date.now();
            if (this.lapStartTime !== null) {
              this.lapTimeListeners.forEach((listener) =>
                listener(time - this.lapStartTime)
              );
            }
            this.lapStartTime = time;
          }
        }
      }
    }

    // Acceleration
    this.velocity[0] *= Math.pow(1 - c.drag, S.dt);
    this.velocity[1] *= Math.pow(1 - c.drag, S.dt);
    const acceleration =
      c.thrust *
      (1 * control.forward + 0.5 * control.left + 0.5 * control.right);
    this.velocity[0] += S.dt * acceleration * -Math.sin(this.orientation);
    this.velocity[1] += S.dt * acceleration * Math.cos(this.orientation);

    // Collisions
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
