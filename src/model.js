'use strict'

// Require dependencies
const DotProp = require ('dot-prop');

// Require local dependencies
const DbQuery = require ('./query');

class DbModel {
  constructor (data, id = null) {
    this._data = data;
    this._id = id;

    this._data._id = this._id;
  }

  get (key = '') {
    if (key.length === 0) {
      return this._data;
    }

    DotProp.get (this._data, key);
  }

  set (key, value = null) {
    if (key instanceof Object && value == null) {
      const updateObj = key;
      Object.assign (this._data, updateObj);
      return;
    }

    DotProp.set (this._data, key, value);
  }

  async save () {
    await this.constructor._$_db.saveModel (this);
  }

  async remove () {
    if (this._id == null) {
      throw new Error ('Model not stored in database');
    }

    await this.constructor._$_db.removeModelById (this.constructor, this._id);
  }

  static query () {
    return new DbQuery (this, this._$_db);
  }

  static async find (filter = {}) { return await this.query ().where (filter).find () }
  static async findOne (filter = {}) { return this.query ().where (filter).findOne () }
  static async count (filter = {}) { return this.query ().where (filter).count () }
  static async remove (filter = {}) { return this.query ().where (filter).remove () }

  static limit (amt) { return this.query ().limit (amt) }
  static skip (amt) { return this.query ().skip (amt) }
  static sort (key, direction) { return this.query ().sort (key, direction) }
  static where (key, value) { return this.query ().where (key, value) }
  static gt (key, min) { return this.query ().gt (key, min) }
  static lt (key, max) { return this.query ().lt (key, max) }
  static gte (key, min) { return this.query ().gte (key, min) }
  static lte (key, max) { return this.query ().gt (key, max) }
}

module.exports = exports = DbModel;
