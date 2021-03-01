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

    this.queries = new MapOfSets();
    this.cachedQueries = new Map();

    this.ComponentType = class ComponentType {

      static tag = Symbol();

      // TODO IMPLEMENT ONDELETE OR SOMETHING ALONG THOSE LINES
      // TO CLEAN UP SPRITES OR DOM ELEMENTS CREATED ON CREATION
      // Also on change. If I change a flat component that
      // points to a dom element with another one, the old one
      // will still exist. Think about this... Seems bad.
      constructor(name, defaultValue, onDelete) {
        if (typeof name !== "string") throw TypeError("name must be string.");
        if (ComponentType[name]) throw TypeError("Component type " + name + " already exists.");
        if (name.split(",").length > 1) throw Error("Illegal character ',' in Component name.");
        // Validate defaultValue
        if (defaultValue !== null && typeof defaultValue === "object") throw Error("Default value can't be object. Make it a constructor function instead.");
        this.name = name;
        this.defaultValue = defaultValue === undefined ? ComponentType.tag : defaultValue;
        ComponentType[name] = this;
      }
    }

    this.Query = class Query {

      constructor(components) {
        if (components instanceof world.ComponentType) components = [components];
        components = Array.from(components);
        this.components = components;
        let key = [];
        for (const component of components) {
          key.push(component.name);
        }
        key = key.sort().join(",");
        if (components.length > 1) {
          const value = world.cachedQueries.get(key);
          if (value) {
            value.queries++;
          } else {
            world.cachedQueries.set(key, {list: components, queries: 1});

            // initialize query set
            for (const entity of world.entities) {
              entity.refreshQuery(key);
            }
          }
          this.key = key;
        }
      }

      get entities() {
        if (this.key) {
          return world.queries.get(this.key);
        } else {
          return world.entitiesByComponentType(this.components[0]);
        }
      }

      destroy() {
        if (this.key) {
          const value = world.cachedQueries.get(this.key);
          value.queries--;
          if (value.queries < 1) {
            world.cachedQueries.delete(this.key);
            world.queries.clearSet(this.key);
          }
          delete this.key;
        }
      }

    }

    this.System = class System {

      _determineAfterPriority(after, afterPriority) {
        if (after instanceof world.System) {
          if (afterPriority === undefined || afterPriority >= after.priority) {
            afterPriority = after.priority - 0.1;
          }
        } else if (after) {
          // after is a list or a set
          for (const system of after) {
            if (afterPriority === undefined || afterPriority >= system.priority) {
              afterPriority = system.priority - 0.1;
            }
          }
        }

        return afterPriority;
      }

      _determineBeforePriority(before, beforePriority) {
        if (before instanceof world.System) {
          if (beforePriority === undefined || beforePriority <= before.priority) {
            beforePriority = before.priority + 0.1;
          }
        } else if (before) {
          // before is a list or a set
          for (const system of before) {
            if (beforePriority === undefined || beforePriority <= system.priority) {
              beforePriority = system.priority + 0.1;
            }
          }
        }

        return beforePriority;
      }

      constructor(components, methods, priority = 0) {

        if (!Array.isArray(components) && !(components instanceof Set) && !(components instanceof world.ComponentType)) {
          priority = methods || 0;
          methods = components;
          components = null;
        }

        for (const [name, method] of Object.entries(methods)) {
          this[name] = method;
        }

        if (components) {
          this._query = new world.Query(components);
          this.entities = this._query.entities;
        }

        if (typeof priority === "number") {
          this.priority = priority;
        } else {
          this.after = priority.after;
          this.before = priority.before;
          // Set priority from after
          let afterPriority = this._determineAfterPriority(this.after);
          // Set priority from before
          let beforePriority = this._determineBeforePriority(this.before);
          if (afterPriority && beforePriority) {
            if (afterPriority > beforePriority) throw Error(`Check your system priority, because something is wrong. before is ${beforePriority}, after is ${afterPriority}`);
            this.priority = (afterPriority + beforePriority) * 0.5;
          } else if (afterPriority) {
            this.priority = afterPriority;
          } else if (beforePriority) {
            this.priority = beforePriority;
          } else {
            this.priority = 0;
          }
        }
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

    this.Entity = class Entity {
      constructor(name) {
        if (name || name === "") {
          if (typeof name !== "string" || name === "") throw TypeError("name must be non empty string.");
          this.name = name;
        }

        world._addEntity(this);

        this.components = new Map();
        this.componentNames = new Set();
      }

      refreshQueries() {
        for (const [queryKey] of world.cachedQueries) {
          this.refreshQuery(queryKey);
        }
      }

      refreshQuery(queryKey) {
        let belongInQuery = true;
        queryKey = queryKey.split(",");
        for (const componentName of queryKey) {
          if (!this.componentNames.has(componentName)) {
            belongInQuery = false;
            break;
          }
        }
        if (belongInQuery) {
          world.queries.set(queryKey.join(","), this);
        } else {
          world.queries.delete(queryKey.join(","), this);
        }
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
        this.componentNames.add(componentType.name);
        world.entitiesByComponentType.set(componentType, this);

        this.refreshQueries();

        return true;
      }

      deleteComponent(componentType) {
        if (!this.components.delete(componentType)) return false;
        this.componentNames.delete(componentType.name);
        world.entitiesByComponentType.delete(componentType, this);

        this.refreshQueries();

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