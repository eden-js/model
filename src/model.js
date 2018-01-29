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
    this._data = data;
    this._id = id;

    this._data._id = this._id;
  }

  /**
   * Get internal data by dot-prop key
   */
  get (key = '') {
    if (key.length === 0) {
      return this._data;
    }

    DotProp.get (this._data, key);
  }

  /**
   * Set internal data by dot-prop key and value, or object containing update information
   */
  set (key, value = null) {
    if (key instanceof Object && value == null) {
      const updateObj = key;
      Object.assign (this._data, updateObj);
      return;
    }

    DotProp.set (this._data, key, value);
  }

  /**
   * Save this Model instance's data to the database
   */
  async save () {
    await this.constructor._$_db.saveModel (this);
  }

  /**
   * Remove this Model instance's data from the database
   */
  async remove () {
    // TODO: Should delete class itself too?

    if (this._id == null) {
      throw new Error ('Model not stored in database');
    }

    await this.constructor._$_db.removeModelById (this.constructor, this._id);
  }

  /**
   * Create database query builder from self and associated DB API
   */
  static query () {
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
