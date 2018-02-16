"use strict";

/**
 * Query builder class
 */
class DbQuery {
  /**
   * Construct query builder class
   */
  constructor (Model, db) {
    // Store internal copy of the Model protoype
    this._Model = Model;

    // Store internal copy of the DB API
    this._db = db;

    // Query parts
    this.pts = [];

    // Bind all public building methods to self
    this.gt    = this.gt.bind (this);
    this.or    = this.or.bind (this);
    this.lt    = this.lt.bind (this);
    this.gte   = this.gte.bind (this);
    this.lte   = this.lte.bind (this);
    this.skip  = this.skip.bind (this);
    this.sort  = this.sort.bind (this);
    this.limit = this.limit.bind (this);
    this.elem  = this.elem.bind (this);
    this.where = this.where.bind (this);
    this.match = this.match.bind (this);
    this.ne    = this.ne.bind (this);
    this.or    = this.or.bind (this);
    this.and   = this.and.bind (this);

    // Bind all public finalization methods to self
    this.sum     = this.sum.bind (this);
    this.find    = this.find.bind (this);
    this.count   = this.count.bind (this);
    this.remove  = this.remove.bind (this);
    this.findOne = this.findOne.bind (this);
  }

  /**
   * Set maximum returned Model instances
   */
  limit (amt) {
    // Push query part for `limit` and return self
    this.pts.push ({ type: "limit", limitAmount: amt });
    return this;
  }

  /**
   * Filter by if element matches in array
   */
  elem (arrKey, filter) {
    // Push query part for `elem` and return self
    this.pts.push ({ type: "elem", arrKey: arrKey, filter: filter });
    return this;
  }

  /**
   * Skip the first specified amount of returned Model instances
   */
  skip (amt) {
    // Push query part for `skip` and return self
    this.pts.push ({ type: "skip", skipAmount: amt });
    return this;
  }

  /**
   * Sort returned Model instances by a key and optional direction (default descending)
   */
  sort (key, directionStr = "desc") {
    // Ensure directionStr is a String value
    directionStr = directionStr.toString ();

    // Create scoped variable for wether the order is descending or not
    let desc = null;

    // Parse directionStr into value to apply to `desc`
    if (directionStr === "1" || directionStr === "asc" || directionStr === "ascending") {
      // Sort by ascending
      desc = false;
    } else if (directionStr === "-1" || directionStr === "desc" || directionStr === "descending") {
      // Sort by descending
      desc = true;
    } else {
      // directionStr is unparseable, so throw error
      throw new Error ("Invalid sort value");
    }

    // Push query part for `sort` and return self
    this.pts.push ({ type: "sort", sortKey: key, desc: desc });
    return this;
  }

  /**
   * Filter only Model instances where the specified key matches the specified val, can also be given a filter object
   */
  where (key, value = null) {
    // If only argument is an Object, handle as a filter object
    if (key instanceof Object && value == null) {
      // Handle arg
      const filter = key;
      // Push query part for `filter` and return self
      this.pts.push ({ type: "filter", filter: filter });
      return this;
    }

    // Push query part for `filter` and return self
    this.pts.push ({ type: "filter", filter: { [key]: value } });
    return this;
  }

  /**
   * Filter only Model instances where the specified key does not match the specified val
   */
  ne (key, value) {
    // Push query part for `ne` and return self
    this.pts.push ({ type: "ne", val: value, key: key });
    return this;
  }

  /**
   * Alias of `where`
   */
  match (key, value = null) {
    return this.where (key, value);
  }

  /**
   * Filter only Model instances by filter using multiple filter objects, where only one has to match
   */
  or (...matches) {
    // Push query part for `whereOr` and return self
    this.pts.push ({ type: "whereOr", matches: matches });
    return this;
  }


  /**
   * Filter only Model instances by filter using multiple filter objects, where all have to match
   */
  and (...matches) {
    // Push query part for `whereAnd` and return self
    this.pts.push ({ type: "whereAnd", matches: matches });
    return this;
  }

  /**
   * Only return Model instances where the value of the specified key is greater than the specified amount
   */
  gt (key, min) {
    // Push query part for `gt` and return self
    this.pts.push ({ type: "gt", min: min, key: key });
    return this;
  }

  /**
   * Only return model instances where the value of the specified key is less than the specified amount
   */
  lt (key, max) {
    // Push query part for `lt` and return self
    this.pts.push ({ type: "lt", max: max, key: key });
    return this;
  }

  /**
   * Only return Model instances where the value of the specified key is greater or equal to than the specified amount
   */
  gte (key, min) {
    // Push query part for `gte` and return self
    this.pts.push ({ type: "gte", min: min, key: key });
    return this;
  }

  /**
   * Only return model instances where the value of the specified key is less than or equal to the specified amount
   */
  lte (key, max) {
    // Push query part for `lte` and return self
    this.pts.push ({ type: "lte", max: max, key: key });
    return this;
  }

  /**
   * Finalize this query and return all matching Model instances
   */
  async find () {
    // Call internally stored DB API to return models matching self query
    return await this._db.find (this._Model, this);
  }

  /**
   * Finalize this query and return one matching Model instance
   */
  async findOne () {
    // Call internally stored DB API to return one model matching self query
    return await this._db.findOne (this._Model, this);
  }

  /**
   * Finalize this query and return the total amount of matching Model instances
   */
  async count () {
    // Call internally stored DB API to return the amount of models matching self query
    return await this._db.count (this._Model, this);
  }

  /**
   * Finalize this query and return the sum of matching Model instances' fields by provided key
   */
  async sum (key) {
    // Call internally stored DB API to return the amount of models matching self query
    return await this._db.sum (this._Model, this, key);
  }

  /**
   * Finalize this query and remove all matching Model instances
   */
  async remove () {
    // Call internally stored DB API to remove all models matching self query
    await this._db.remove (this._Model, this);
  }
}

// Exports
module.exports = exports = DbQuery;
