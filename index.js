import Keyboard from "./Keyboard.js";
import World from "./src/World.js";

const keyboard = new Keyboard();

const world = new World();
world.start();
const {System, ComponentType, Entity} = world;

const inputSystem = new System({
  earlyUpdate() {
    keyboard.update();
  }
}, 2000);

const position = new ComponentType("position", () => ({x: 0, y: 0}));
const velocity = new ComponentType("velocity", () => ({x: 0, y: 0}));
const acceleration = new ComponentType("acceleration", () => ({x: 0, y: 0}));
const damping = new ComponentType("damping", 0.2);
const arrowKeyAccelerationTag = new ComponentType("arrowKeyAccelerationTag");
const div = new ComponentType("div", () => {
  const div = document.createElement("div");
  div.style.width = "10px";
  div.style.height = "10px";
  div.style.position = "absolute";
  div.style.backgroundColor = "red";
  document.getElementsByTagName("body")[0].append(div);
  return div;
});

const player = new Entity("player");
player.addComponent(position);
player.addComponent(velocity);
player.addComponent(acceleration);
player.addComponent(damping);
player.addComponent(arrowKeyAccelerationTag);
player.addComponent(div);

const arrowKeyAcceleration = new System({
  earlyUpdate() {
    for (const entity of world.entitiesByComponentType.get(arrowKeyAccelerationTag)) {
      if (!entity.hasComponent(position) || !entity.hasComponent(velocity) || !entity.hasComponent(acceleration)) continue
        
      const a = entity.getComponent(acceleration);
      const dirVec = [0, 0];
      if (keyboard.isHeld("ArrowLeft")) {
        dirVec[0] -= 1;
      }
      if (keyboard.isHeld("ArrowRight")) {
        dirVec[0] += 1;
      }
      if (keyboard.isHeld("ArrowUp")) {
        dirVec[1] -= 1;
      }
      if (keyboard.isHeld("ArrowDown")) {
        dirVec[1] += 1;
      }
      if (dirVec[0] || dirVec[1]) {
        const angle = Math.atan2(dirVec[1], dirVec[0]);
        a.x = 55 * Math.cos(angle);
        a.y = 55 * Math.sin(angle);
      } else {
        a.x = 0;
        a.y = 0;
      }
    }
  }
})

const accelerationSystem = new System({
  calculus(dt) {
    for (const entity of world.entitiesByComponentType.get(acceleration)) {
      if (!entity.hasComponent(velocity)) continue;

      const a = entity.getComponent(acceleration);
      const v = entity.getComponent(velocity);

      // dv = a * dt
      // vend - vstart = a * dt
      // vend = vstart + a * dt
      v.x = v.x + a.x * dt;
      v.y = v.y + a.y * dt;
    }
  }
}, 1000);

const dampingSystem = new System({
  calculus(dt) {
    for (const entity of world.entitiesByComponentType.get(damping)) {
      if (!entity.hasComponent(velocity)) continue;

      const d = entity.getComponent(damping);
      const v = entity.getComponent(velocity);

      let speed = Math.sqrt(v.x ** 2 + v.y ** 2);
      if (speed) {
        const angle = Math.atan2(v.y, v.x);
        speed = Math.max(0, speed * (1 - d * dt));
        v.x = speed * Math.cos(angle);
        v.y = speed * Math.sin(angle);
      }
    }
  }
}, 900);

const movementSystem = new System({
  calculus(dt) {
    for (const entity of world.entitiesByComponentType.get(velocity)) {
      if (!entity.hasComponent(position)) continue;

      const v = entity.getComponent(velocity);
      const p = entity.getComponent(position);

      p.x = p.x + v.x * dt;
      p.y = p.y + v.y * dt;
    }
  }
}, 800);

// const movementSystem = new System({
//   update(deltaT) {
//     const speed = 150;
//     for (const entity of world.entitiesByComponentType.get(position)) {

//       const dirVec = [0, 0];
//       if (keyboard.isHeld("ArrowLeft")) {
//         dirVec[0] -= 1;
//       }
//       if (keyboard.isHeld("ArrowRight")) {
//         dirVec[0] += 1;
//       }
//       if (keyboard.isHeld("ArrowUp")) {
//         dirVec[1] -= 1;
//       }
//       if (keyboard.isHeld("ArrowDown")) {
//         dirVec[1] += 1;
//       }
//       const angle = Math.atan2(dirVec[1], dirVec[0]);
//       if (dirVec[0] || dirVec[1]) {
//         entity.getComponent(position).x += speed * Math.cos(angle) * deltaT;
//         entity.getComponent(position).y += speed * Math.sin(angle) * deltaT;
//       }
//     }
//   }
// });

const renderSystem = new System({
  draw() {
    for (const entity of world.entitiesByComponentType.get(div)) {
      if (entity.hasComponent(position)) {
        entity.getComponent(div).style.left = `${entity.getComponent(position).x}px`;
        entity.getComponent(div).style.top = `${entity.getComponent(position).y}px`;
      }
    }
  }
})