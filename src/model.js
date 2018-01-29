'use strict'

// Require dependencies
const DotProp = require ('dot-prop');

// Require local dependencies
const DbQuery = require ('./query');

/**
 * Extendable Model class
 */
class DbModel {
  /**
   * Construct Model class
   */
  constructor (data, id = null) {
    // Set internal data from provided argument
    this._data = data;

    // Set internal ID from provided argument
    this._id = id;

    // Set `_id` property of internal data to be own ID
    this._data._id = this._id;
  }

  /**
   * Get internal data by dot-prop key
   */
  get (key = '') {
    // Return full internal data if key not provided
    if (key.length === 0) {
      return this._data;
    }

    // Return stored value selected by dot-prop key
    return DotProp.get (this._data, key);
  }

  /**
   * Set internal data by dot-prop key and value, or object containing update information
   */
  set (key, value = null) {
    // If only argument is an Object, merge Object with internal data
    if (key instanceof Object && value == null) {
      const updateObj = key;
      Object.assign (this._data, updateObj);
      return;
    }

    // Set internal value selected by dot-prop key
    DotProp.set (this._data, key, value);
  }

  /**
   * Save this Model instance's data to the database
   */
  async save () {
    // Call internal DB API to save this Model instance
    await this.constructor._$_db.saveModel (this);
  }

  /**
   * Remove this Model instance's data from the database
   */
  async remove () {
    // TODO: Should delete class itself too?

    // Throw error if not stored in database
    if (this._id == null) {
      throw new Error ('Model not stored in database');
    }

    // Nullify internal ID as no longer exists in database
    this._id = null;

    // Call internal DB API to remove the data associated with this Model instance by ID
    await this.constructor._$_db.removeModelById (this.constructor, this._id);
  }

  /**
   * Create database query builder from self and associated DB API
   */
  static query () {
    // Return a newly constructed DbQuery given `this` and internal DB API
    return new DbQuery (this, this._$_db);
  }

  /**
   * Query-less database actions using simple filter
   */
  // Find Model instances by simple filter
  static async find (filter = {}) { return await this.query ().where (filter).find () }
  // Find single Model instance by simple filter
  static async findOne (filter = {}) { return this.query ().where (filter).findOne () }
  // Count stored Model instances by simple filter
  static async count (filter = {}) { return this.query ().where (filter).count () }
  // Remove stored Model instance by simple filter
  static async remove (filter = {}) { return this.query ().where (filter).remove () }

  /**
   * Query constructor methods
   */
  // Create a query builder with initial `limit` set
  static limit (amt) { return this.query ().limit (amt) }
  // Create a query builder with initial `skip` set
  static skip (amt) { return this.query ().skip (amt) }
  // Create a query builder with initial `sort` set
  static sort (key, direction) { return this.query ().sort (key, direction) }
  // Create a query builder with initial `where` set
  static where (key, value) { return this.query ().where (key, value) }
  // Create a query builder with initial `gt` set
  static gt (key, min) { return this.query ().gt (key, min) }
  // Create a query builder with initial `lt` set
  static lt (key, max) { return this.query ().lt (key, max) }
  // Create a query builder with initial `gte` set
  static gte (key, min) { return this.query ().gte (key, min) }
  // Create a query builder with initial `gt` set
  static lte (key, max) { return this.query ().gt (key, max) }
}

module.exports = exports = DbModel;
