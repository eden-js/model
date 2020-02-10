
// events
const money = require('money-math');
const Events  = require('events');
const dotProp = require('dot-prop');
const { assert } = require('chai');

// import local
const DB = require('./db');
const Query = require('./query');

// data
const DATA = {
  db   : null,
  plug : null,
};

/**
 * eden model
 */
class EdenModel extends Events {
  /**
   * 
   * @param  {...any} args
   */
  constructor(data = {}, id = null) {
    // run super
    super();

    // Set internal data from provided argument
    this.__data = data;

    // Internal array for storing updates
    this.__updates = new Set();

    // Set internal ID from provided argument
    this.__id = id;

    // data methods
    ['get', 'set', 'unset', 'push', 'add', 'subtract', 'increment', 'decrement'].forEach((method) => {
      // bind
      this[method] = this[method].bind(this);
    });

    // save/remove methods
    ['save', 'replace', 'remove', 'refresh'].forEach((method) => {
      // bind
      this[method] = this[method].bind(this);
    });
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // INIT METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * init database
   *
   * @param {*} plug 
   */
  static init(plug) {
    // init database plug
    DATA.db = new DB(plug);
    DATA.plug = plug;
  }

  /**
   * creates index
   *
   * @param {*} Model 
   * @param {*} name 
   * @param {*} indexes 
   */
  static async index(Model, name, indexes) {
    // init database plug
    return DATA.db.createIndex(Model, name, indexes);
  }

  /**
   * registers collection
   *
   * @param {*} Model 
   */
  static async register(Model) {
    // init database plug
    return DATA.db.initCollection(Model);
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // DATA METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * gets value
   *
   * @param {*} key 
   */
  get(key) {
    // return copied set of data
    if (!key) {
      return Object.assign({}, this.__data);
    }

    // return stringified id
    if (key === '_id') {
      return this.__id;
    }

    // return dotprop key
    return dotProp.get(this.__data, key);
  }

  /**
   * sets value
   *
   * @param {*} key 
   * @param {*} value 
   */
  set(key, value = null) {
    // if object, set each key
    if (key instanceof Object && value == null) {
      // keys map
      Object.keys(key).forEach((k) => {
        // set
        this.set(k, key[k]);
      });

      // return
      return;
    }

    // add change to internal updates set
    this.__updates.add(key);

    // set internal value selected by dot-prop key
    dotProp.set(this.__data, key, value);
  }

  /**
   * adds to field
   *
   * @param {*} key 
   * @param {*} amt 
   */
  add(key, amt = '0.00') {
    // get current value of prop selected by dot-prop key
    let currValue = dotProp.get(this.__data, key) || '0.00';

    // set amount
    if (typeof amt === Number) amt = money.floatToAmount(amt);
    if (typeof currValue === Number) currValue = money.floatToAmount(currValue);

    // add change to internal updates set
    this.__updates.add(key);

    // set
    dotProp.set(this.__data, key, money.add(amt, currValue));
  }

  /**
   * subtracts from field
   *
   * @param {*} key 
   * @param {*} amt 
   */
  subtract(key, amt = '0.00') {
    // get current value of prop selected by dot-prop key
    let currValue = dotProp.get(this.__data, key) || '0.00';

    // set amount
    if (typeof amt === Number) amt = money.floatToAmount(amt);
    if (typeof currValue === Number) currValue = money.floatToAmount(currValue);

    // add change to internal updates set
    this.__updates.add(key);

    // set
    dotProp.set(this.__data, key, money.subtract(amt, currValue));
  }

  /**
   * unsets key
   *
   * @param {*} key 
   */
  unset(key = null) {
    // if only argument is an Array, iterate it as array of keys to remove
    if (key instanceof Array) {
      // each
      key.forEach((k) => {
        dotProp.delete(this.__data, k);
        this.__updates.add(k);
      });

      // return
      return;
    }

    // delete prop by key
    dotProp.delete(this.__data, key);

    // add change to internal updates set
    this.__updates.add(key);
  }

  /**
   * increments field
   *
   * @param {*} key 
   * @param {*} amt 
   */
  increment(key, amt = 1) {
    // get current value of prop selected by dot-prop key
    const currValue = dotProp.get(this.__data, key) || 0;

    // set value of prop selected by dot-prop key to be plus the increment amount (default 1)
    dotProp.set(this.__data, key, currValue + amt);

    // add change to internal updates set
    this.__updates.add(key);
  }

  /**
   * decrement
   *
   * @param {*} key 
   * @param {*} amt 
   */
  decrement(key, amt = 1) {
    // get current value of prop selected by dot-prop key
    const currValue = dotProp.get(this.__data, key) || 0;

    // set value of prop selected by dot-prop key to be minus the increment amount (default 1)
    dotProp.set(this.__data, key, currValue - amt);

    // Add change to internal updates set
    this.__updates.add(key);
  }

  /**
   * push to array
   *
   * @param {*} key 
   * @param {*} val 
   */
  push(key, val) {
    // Get current value of prop selected by dot-prop key
    const currValue = dotProp.get(this.__data, key) || [];

    // Ensure currValue is not an existing non-array field
    assert.instanceOf(currValue, Array, "Can't push to non-array field");

    // Push to array
    currValue.push(val);

    // Set value of prop to be array
    dotProp.set(this.__data, key, currValue);

    // Add change to internal updates set
    this.__updates.add(key);
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // PERSIST METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Save this Model instance's data updates to the database
   */
  async save() {
    // call internal DB API to save changes to this Model instance
    const id = await db.save(this, this.__updates, this.__id);

    // set ID if ID returned
    if (id != null) {
      this.__id = id;
    }

    // reset internally stored updates
    this.__updates = new Set();
  }

  /**
   * Save this Model instance's data to the database
   */
  async replace() {
    // Call internal DB API to replace this Model instance
    const id = await db.replace(this, this.__id);

    // set ID if ID returned
    if (id != null) {
      this.__id = id;
    }

    // reset internally stored updates
    this.__updates = new Set();
  }

  /**
   * Remove this Model instance's data from the database
   */
  async remove() {
    // call internal DB API to remove the data associated with this Model instance by ID
    await db.removeById(this.constructor, this.__id);

    // nullify internal ID as no longer exists in database
    this.__id = null;
  }

  /**
   * Refresh this Model instance's internal data by re-fetching from the database
   */
  async refresh() {
    // Replace this Model instance's internal data with fetched data from the database
    this.__data = await db.findDataById(this.constructor, this.__id);

    // Reset internally stored updates
    this.__updates = new Set();
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // QUERY METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Create database query builder from self and associated DB API
   */
  static __query() {
    // Ensure model is registered before creating query
    assert.instanceOf(DATA.db, DbApi, 'Model must be registered.');

    // Return a newly constructed DbQuery given `this` and internal DB API
    return new Query(this, DATA.db);
  }

  /**
   * Find model by ID
   */
  static async findById(id) {
    // Ensure model is registered before finding by ID
    assert.instanceOf(DATA.db, DbApi, 'Model must be registered.');

    // Return model found by ID
    return await DATA.db.findById(this, id);
  }

  /**
   * Query-less database actions using simple filter
   */
  // Find Model instances by simple filter
  static async find(filter = {}) { return await this.__query().where(filter).find(); }

  // Find single Model instance by simple filter
  static async findOne(filter = {}) { return await this.__query().where(filter).findOne(); }

  // Count stored Model instances by simple filter
  static async count(filter = {}) { return await this.__query().where(filter).count(); }

  // Sum stored Model instance values by simple filter
  static async sum(key, filter = {}) { return await this.__query().where(filter).sum(key); }

  // Remove stored Model instance by simple filter
  static async remove(filter = {}) { return await this.__query().where(filter).remove(); }

  /**
   * Query constructor methods
   */
  // Create a query builder with initial `limit` set
  static limit(...args) { return this.__query().limit(...args); }

  // Create a query builder with initial `elem` set
  static elem(...args) { return this.__query().elem(...args); }

  // Create a query builder with initial `skip` set
  static skip(...args) { return this.__query().skip(...args); }

  // Create a query builder with initial `sort` set
  static sort(...args) { return this.__query().sort(...args); }

  // Create a query builder with initial `where` set
  static where(...args) { return this.__query().where(...args); }

  // Create a query builder with initial `ne` set
  static ne(...args) { return this.__query().ne(...args); }

  // Create a query builder with initial `nin` set
  static nin(...args) { return this.__query().nin(...args); }

  // Create a query builder with initial `in` set
  static in(...args) { return this.__query().in(...args); }

  // Create a query builder with initial `match` set
  static match(...args) { return this.__query().match(...args); }

  // Create a query builder with initial `or` set
  static or(...args) { return this.__query().or(...args); }

  // Create a query builder with initial `and` set
  static and(...args) { return this.__query().and(...args); }

  // Create a query builder with initial `gt` set
  static gt(...args) { return this.__query().gt(...args); }

  // Create a query builder with initial `lt` set
  static lt(...args) { return this.__query().lt(...args); }

  // Create a query builder with initial `gte` set
  static gte(...args) { return this.__query().gte(...args); }

  // Create a query builder with initial `lte` set
  static lte(...args) { return this.__query().lte(...args); }
}

// export model
exports = module.exports = EdenModel;