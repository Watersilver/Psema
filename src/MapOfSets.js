const emptySet = new Set();

class MapOfSets extends Map {
  constructor() {
    super();

    this._set = Map.prototype.set.bind(this);
    this._get = Map.prototype.get.bind(this);
    this._delete = Map.prototype.delete.bind(this);
  }

  set(key, value) {
    let set;
    if (!this.has(key)) {
      set = new Set();
      this._set(key, set);
    } else {
      set = this.get(key);
    }
    return set.add(value);
  }

  get(key) {
    const set = this._get(key);
    if (set) return set;
    else return emptySet;
  }

  delete(key, value) {
    let set = this.get(key);
    if (!set) return false;
    if (set.delete(value)) {
      if (set.size === 0) this._delete(key);
      return true;
    }
    return false;
  }
}

export default MapOfSets;