"use strict"

class DbQuery {
  constructor (Model, db) {
    this._Model = Model;
    this._db = db;
    this.pts = [];
  }

  limit (amt) {
    this.pts.push ({ type: "limit", limitAmount: amt });
    return this;
  }

  skip (amt) {
    this.pts.push ({ type: "skip", skipAmount: amt });
    return this;
  }

  sort (key, directionStr) {
    directionStr = directionStr.toString ();

    let desc = null;

    if (directionStr === "1" || directionStr === "asc" || directionStr === "ascending") {
      desc = false;
    } else if (directionStr === "-1" || directionStr === "desc" || directionStr === "descending") {
      desc = true;
    } else {
      throw new Error ("Invalid sort value");
    }

    this.pts.push ({ type: "sort", sortKey: key, desc: desc });
    return this;
  }

  where (key, value = null) {
    if (key instanceof Object && value == null) {
      const filter = key;
      this.pts.push ({ type: "filter", filter: filter });
      return this;
    } else {
      this.pts.push ({ type: "whereEquals", match: { prop: key, value: value } });
      return this;
    }
  }

  gt (key, min) {
    this.pts.push ({ type: "gt", min: min, key: key });
    return this;
  }

  lt (key, max) {
    this.pts.push ({ type: "lt", max: max, key: key });
    return this;
  }

  gte (key, min) {
    this.pts.push ({ type: "gte", min: min, key: key });
    return this;
  }

  lte (key, min) {
    this.pts.push ({ type: "lte", max: max, key: key });
    return this;
  }

  async find () {
    return await this._db.findModels (this._Model, this);
  }

  async findOne () {
    return await this._db.findModel (this._Model, this);
  }

  async count () {
    return await this._db.countModels (this._Model, this);
  }

  async remove () {
    await this._db.removeModels (this._Model, this);
  }
}

module.exports = exports = DbQuery;
