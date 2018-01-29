"use strict";

/**
 * Query builder class
 */
class DbQuery {
  /**
   * Construct query builder class
   */
  constructor (Model, db) {
    this._Model = Model;
    this._db = db;
    this.pts = [];
  }

  /**
   * Set maximum returned Model instances
   */
  limit (amt) {
    this.pts.push ({ type: "limit", limitAmount: amt });
    return this;
  }

  /**
   * Skip the first specified amount of returned Model instances
   */
  skip (amt) {
    this.pts.push ({ type: "skip", skipAmount: amt });
    return this;
  }

  /**
   * Sort returned Model instances by a key and optional direction (default descending)
   */
  sort (key, directionStr = "desc") {
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

  /**
   * Filter only Model instances where the specified key matches the specified val, can also be given a filter object
   */
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

  /**
   * Only return Model instances where the value of the specified key is greater than the specified amount
   */
  gt (key, min) {
    this.pts.push ({ type: "gt", min: min, key: key });
    return this;
  }

  /**
   * Only return model instances where the value of the specified key is less than the specified amount
   */
  lt (key, max) {
    this.pts.push ({ type: "lt", max: max, key: key });
    return this;
  }

  /**
   * Only return Model instances where the value of the specified key is greater or equal to than the specified amount
   */
  gte (key, min) {
    this.pts.push ({ type: "gte", min: min, key: key });
    return this;
  }

  /**
   * Only return model instances where the value of the specified key is less than or equal to the specified amount
   */
  lte (key, min) {
    this.pts.push ({ type: "lte", max: max, key: key });
    return this;
  }

  /**
   * Finalize this query and return all matching Model instances
   */
  async find () {
    return await this._db.findModels (this._Model, this);
  }

  /**
   * Finalize this query and return one matching Model instance
   */
  async findOne () {
    return await this._db.findModel (this._Model, this);
  }

  /**
   * Finalize this query and return the total amount of matching Model instances
   */
  async count () {
    return await this._db.countModels (this._Model, this);
  }

  /**
   * Finalize this query and remove all matching Model instances
   */
  async remove () {
    await this._db.removeModels (this._Model, this);
  }
}

// Exports
module.exports = exports = DbQuery;
