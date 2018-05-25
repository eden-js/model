'use strict'

// Require dependencies
const DotProp = require ('dot-prop');
const assert  = require ('chai').assert;

// Require local dependencies
const DbQuery = require ('./query');
const DbApi   = require ('./dbapi');

/**
 * Extendable Model class
 */
class DbModel {
  /**
   * Construct Model class
   */
  constructor (data = {}, id = null) {
    // Set internal data from provided argument
    this.__data = data;

    // Internal array for storing updates
    this.__updates = new Set ();
    this.__fullUpdate = true;

    // Set internal ID from provided argument
    this.__id = id;

    // Bind public methods to self
    this.get        = this.get.bind (this);
    this.set       = this.set.bind (this);
    this.unset     = this.unset.bind (this);
    this.increment = this.increment.bind (this);
    this.decrement = this.decrement.bind (this);
    this.save      = this.save.bind (this);
    this.remove    = this.remove.bind (this);
    this.refresh   = this.refresh.bind (this);
  }

  /**
   * Model prop of methods for getting raw plug-specific components
   */
  static get raw () {
    // return raw
    return {
      'db'     : async (...args) => await this.__db.getRawDb (...args),
      'table'  : async (...args) => await this.__db.getRawTable (...args),
      'cursor' : async (...args) => await this.__db.getRawCursor (...args),
    };
  }

  static async createIndex (name, indexes) {
    await this.__db.createIndex (this, name, indexes);
  }

  /**
   * Model instance prop of methods for getting raw plug-specific components
   */
  get raw () {
    // return raw constructor
    return this.constructor.raw;
  }

  /**
   * Get internal data by dot-prop key
   */
  get (key = '') {
    // Return full internal data if key not provided
    if (key.length === 0) {
      return Object.assign({}, this.__data);
    }

    // Return database ID of Model instance
    if (key === "_id") {
      return this.__id;
    }

    // Return stored value selected by dot-prop key
    return DotProp.get (this.__data, key);
  }

  /**
   * Set internal data by dot-prop key and value, or object containing update information
   */
  set (key, value = null) {
    // If only argument is an Object, merge Object with internal data
    if (key instanceof Object && value == null) {
      const updateObj = key;
      Object.assign (this.__data, updateObj);
      this.__fullUpdate = true;
      return;
    }

    // Add change to internal updates set
    this.__updates.add (key);

    // Set internal value selected by dot-prop key
    DotProp.set (this.__data, key, value);
  }

  /**
   * Un-set internal data by dot-prop key, array if dot-prop keys, or no argument to remove all data
   */
  unset (key = null) {
    // If only argument is an Array, iterate it as array of keys to remove
    if (key instanceof Array) {
      const keys = key;

      for (const key of keys) {
        // Delete prop by key
        DotProp.delete (this.__data, key);
        this.__updates.add (key);
      }

      return;
    }

    // Delete all internal data if provided key is not defined
    if (key == null) {
      // Redefine internal data object
      this.__data = {};
      this.__fullUpdate = true;
      return;
    }

    // Delete prop by key
    DotProp.delete (this.__data, key);

    // Add change to internal updates set
    this.__updates.add (key);
  }

  /**
   * Increment fields in internal data by dot-prop key and optional amount
   */
  increment (key, amt = 1) {
    // TODO: Support incrementing multiple using an object

    // Get current value of prop selected by dot-prop key
    const currValue = DotProp.get (this.__data, key);
    // Set value of prop selected by dot-prop key to be plus the increment amount (default 1)
    DotProp.set (this.__data, key, currValue + amt);

    // Add change to internal updates set
    this.__updates.add (key);
  }

  /**
   * Decrement fields in internal data by dot-prop key and optional amount
   */
  decrement (key, amt = 1) {
    // TODO: Support decrementing multiple using an object

    // Get current value of prop selected by dot-prop key
    const currValue = DotProp.get (this.__data, key);
    // Set value of prop selected by dot-prop key to be minus the increment amount (default 1)
    DotProp.set (this.__data, key, currValue - amt);

    // Add change to internal updates set
    this.__updates.add (key);
  }

  /**
   * Save this Model instance's data updates to the database
   */
  async save () {
    // Use replace instead of has been fully updated in any way
    if (this.__fullUpdate) {
      return await this.replace ();
    }

    // Ensure model is registered before saving model data
    assert.instanceOf(this.constructor.__db, DbApi, "Model must be registered.")

    // Call internal DB API to save changes to this Model instance
    const id = await this.constructor.__db.save (this, this.__updates, this.__id);

    // Set ID if ID returned
    if (id != null) {
      this.__id = id;
    }

    // Reset internally stored updates
    this.__updates = new Set ();
  }

  /**
   * Save this Model instance's data to the database
   */
  async replace () {
    // Ensure model is registered before saving model data
    assert.instanceOf(this.constructor.__db, DbApi, "Model must be registered.")

    // Call internal DB API to replace this Model instance
    const id = await this.constructor.__db.replace (this, this.__id);

    // Set ID if ID returned
    if (id != null) {
      this.__id = id;
    }

    // Reset internally stored updates
    this.__updates = new Set ();
  }

  /**
   * Remove this Model instance's data from the database
   */
  async remove () {
    // TODO: Should delete class itself too?

    // Ensure model is registered before removing model data
    assert.instanceOf(this.constructor.__db, DbApi, "Model must be registered.")

    // Ensure this Model instance is stored in database
    assert.isNotNull(this.__id, "Model must be stored in database to remove.")

    // Call internal DB API to remove the data associated with this Model instance by ID
    await this.constructor.__db.removeById (this.constructor, this.__id);

    // Nullify internal ID as no longer exists in database
    this.__id = null;
  }

  /**
   * Refresh this Model instance's internal data by re-fetching from the database
   */
   async refresh () {
     // Ensure model is registered before fetching model data
     assert.instanceOf(this.constructor.__db, DbApi, "Model must be registered.")

     // Ensure this Model instance is stored in database
     assert.isNotNull(this.__id, "Model must be stored in database to refresh.")

     // Replace this Model instance's internal data with fetched data from the database
     this.__data = await this.constructor.__db.findDataById (this.constructor, this.__id)

     // Reset internally stored updates
     this.__updates = new Set ();
   }

  /**
   * Create database query builder from self and associated DB API
   */
  static __query () {
    // Ensure model is registered before creating query
    assert.instanceOf(this.__db, DbApi, "Model must be registered.")

    // Return a newly constructed DbQuery given `this` and internal DB API
    return new DbQuery (this, this.__db);
  }

  /**
   * Find model by ID
   */
  static async findById (id) {
    // Ensure model is registered before finding by ID
    assert.instanceOf(this.__db, DbApi, "Model must be registered.")

    // Return model found by ID
    return await this.__db.findById (this, id);
  }

  /**
   * Query-less database actions using simple filter
   */
  // Find Model instances by simple filter
  static async find (filter = {}) { return await this.__query ().where (filter).find () }
  // Find single Model instance by simple filter
  static async findOne (filter = {}) { return await this.__query ().where (filter).findOne () }
  // Count stored Model instances by simple filter
  static async count (filter = {}) { return await this.__query ().where (filter).count () }
  // Sum stored Model instance values by simple filter
  static async sum (key, filter = {}) { return await this.__query ().where (filter).sum (key) }
  // Remove stored Model instance by simple filter
  static async remove (filter = {}) { return await this.__query ().where (filter).remove () }

  /**
   * Query constructor methods
   */
  // Create a query builder with initial `limit` set
  static limit (...args) { return this.__query ().limit (...args) }
  // Create a query builder with initial `elem` set
  static elem (...args) { return this.__query ().elem (...args) }
  // Create a query builder with initial `skip` set
  static skip (...args) { return this.__query ().skip (...args) }
  // Create a query builder with initial `sort` set
  static sort (...args) { return this.__query ().sort (...args) }
  // Create a query builder with initial `where` set
  static where (...args) { return this.__query ().where (...args) }
  // Create a query builder with initial `ne` set
  static ne (...args) { return this.__query ().ne (...args) }
  // Create a query builder with initial `nin` set
  static nin (...args) { return this.__query ().nin (...args) }
  // Create a query builder with initial `in` set
  static in (...args) { return this.__query ().in (...args) }
  // Create a query builder with initial `match` set
  static match (...args) { return this.__query ().match (...args) }
  // Create a query builder with initial `or` set
  static or (...args) { return this.__query ().or (...args) }
  // Create a query builder with initial `and` set
  static and (...args) { return this.__query ().and (...args) }
  // Create a query builder with initial `gt` set
  static gt (...args) { return this.__query ().gt (...args) }
  // Create a query builder with initial `lt` set
  static lt (...args) { return this.__query ().lt (...args) }
  // Create a query builder with initial `gte` set
  static gte (...args) { return this.__query ().gte (...args) }
  // Create a query builder with initial `lte` set
  static lte (...args) { return this.__query ().lte (...args) }
}

// Exports
module.exports = exports = DbModel;
