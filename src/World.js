// Read stuff: https://github.com/sosolimited/Entity-Component-Samples#understanding-entity-component-systems
// Valid json types:
// Number: cannot include non-numbers such as NaN.
// String: Unicode characters. Support a backslash escaping syntax.
// Boolean: either of the values true or false
// Array: an ordered list of zero or more values, each of which may be of any type.
// Object: a collection of name–value pairs where the names (also called keys) are strings.
// null: an empty value, using the word null

import MapOfSets from "./MapOfSets.js";

// Implement onComponentRemove to destroy persistent data that will exist due to third party rendering tools.
class World {
  _addEntity(entity) {
    this.entities.add(entity);
    if (entity.name) {
      this.entitiesByName.set(entity.name, entity);
    }
  }

  _removeEntity(entity) {
    this.entities.delete(entity);
    this.entitiesByName.delete(entity.name, entity);
  }

  _earlyUpdate(deltaT, now, before) {
    for (const system of this.systems) {
      if (!system.earlyUpdate) continue;
      system.earlyUpdate(deltaT, now, before);
    }
  }

  _calculus(deltaT) {
    const iterations = Math.ceil(deltaT / this.max_dt);
    const dt = deltaT / iterations;

    for (let i = 0; i < iterations; i++) {
      for (const system of this.systems) {
        if (!system.calculus) continue;
        system.calculus(dt);
      }
    }
  }

  _update(deltaT, now, before) {
    for (const system of this.systems) {
      if (!system.update) continue;
      system.update(deltaT, now, before);
    }
  }

  _draw(deltaT, now, before) {
    for (const system of this.systems) {
      if (!system.draw) continue;
      system.draw(deltaT, now, before);
    }
  }

  constructor(max_dt = 0.02, maxTimesBiggerThanMaxDt = 10) {
    const world = this;
    this.entitiesByComponentType = new MapOfSets(); // componentType: entities set
    this.entitiesByName = new MapOfSets(); // name: entities set
    this.entities = new Set(); // All existing entities
    this.max_dt = max_dt;
    this.maxTimesBiggerThanMaxDt = maxTimesBiggerThanMaxDt;

    this.systems = [];

    this.System = class System {
      constructor(methods, priority = 0) {
        for (const [name, method] of Object.entries(methods)) {
          this[name] = method;
        }

        this.priority = priority;
        this._active = false;
        this.activate();
      }

      activate() {
        if (this._active) return false;
        // Sort by priority
        let insertIndex = world.systems.length;
        for (let i = world.systems.length - 1; i >= 0; i--) {
          if (world.systems[i].priority <= this.priority) break;
          insertIndex = i;
        }
        world.systems.splice(insertIndex, 0, this);
        this._active = true;
        return true;
      }

      deactivate() {
        this._active = false;
        for (let i = 0; i < world.systems.length; i++) {
          if (world.systems[i] === this) {
            world.systems.splice(i, 1);
            break;
          }
        }
      }
    }

    this.ComponentType = class ComponentType {

      static tag = Symbol();

      constructor(name, defaultValue) {
        if (typeof name !== "string") throw TypeError("name must be string.");
        if (ComponentType[name]) throw TypeError("Component type " + name + " already exists.");
        // Validate defaultValue
        if (defaultValue !== null && typeof defaultValue === "object") throw Error("Default value can't be object. Make it a constructor function instead.");
        this.name = name;
        this.defaultValue = defaultValue === undefined ? ComponentType.tag : defaultValue;
        ComponentType[name] = this;
      }
    }

    this.Entity = class Entity {
      constructor(name) {
        if (name || name === "") {
          if (typeof name !== "string" || name === "") throw TypeError("name must be non empty string.");
          this.name = name;
        }

        world._addEntity(this);

        this.components = new Map();
      }

      die() {
        world._removeEntity(this);
      }

      addComponent(componentType, value) {
        if (!(componentType instanceof world.ComponentType)) throw TypeError("componentType must be instance of ComponentType.");
        if (this.components.has(componentType)) return false;
        if (arguments.length === 1) value = componentType.defaultValue;
        if (typeof value === "function") value = value();

        this.components.set(componentType, value);
        world.entitiesByComponentType.set(componentType, this);

        return true;
      }

      deleteComponent(componentType) {
        if (!this.components.delete(componentType)) return false;
        world.entitiesByComponentType.delete(componentType, this);

        return true;
      }

      hasComponent(componentType) {
        return this.components.has(componentType);
      }

      getComponent(componentType) {
        return this.components.get(componentType);
      }

      setComponent(componentType, newValue) {
        if (!this.hasComponent(componentType)) return false;
        if (this.getComponent(componentType) === ComponentType.tag) return false;
        this.components.set(componentType, newValue);
        return true;
      }
    }

  }

  start() {
    // restart
    this.stop();

    let usedDivRealDeltaT = 1;

    let updateBefore = performance.now();
    this._updateId = setInterval(() => {

      const updateNow = performance.now();
      let deltaT = (updateNow - updateBefore) * 0.001;
      usedDivRealDeltaT = 1;

      // If deltaT is too big, induce slowdown to avoid strain.
      if (deltaT > this.maxTimesBiggerThanMaxDt * this.max_dt) {
        const newDeltaT = this.maxTimesBiggerThanMaxDt * this.max_dt;
        usedDivRealDeltaT = newDeltaT / deltaT;
        deltaT = newDeltaT;
      };

      this._earlyUpdate(deltaT, updateNow, updateBefore);

      this._calculus(deltaT);

      this._update(deltaT, updateNow, updateBefore);

      updateBefore = updateNow;
    });

    let drawBefore = performance.now();
    const draw = drawNow => {
      const deltaT = (drawNow - drawBefore) * 0.001 * usedDivRealDeltaT;

      this._draw(deltaT, drawNow, drawBefore);

      drawBefore = drawNow;
      this._drawId = requestAnimationFrame(draw);
    };
    this._drawId = requestAnimationFrame(draw);
  }

  stop() {
    clearInterval(this._updateId);
    cancelAnimationFrame(this._drawId);
    delete this._updateId;
    delete this._drawId;
  }
}

export default World;