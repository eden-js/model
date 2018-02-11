'use strict';

// Require dependencies
const pluralize = require ('pluralize');

/**
 * Get the appropriate collection ID for a Model
 */
function modelCollectionId (Model) {
  return pluralize (Model.name.toLowerCase ());
}

/**
 * Get the appropriate collection ID for an instance of a Model
 */
function modelInstanceCollectionId (model) {
  return pluralize (model.constructor.name.toLowerCase ());
}

/**
 * Internal DB API class
 */
class DbApi {
  /**
   * Construct internal DB API class
   */
  constructor (dbPlug) {
    this._plug = dbPlug;

    // Bind API methods to self
    this.save       = this.save.bind (this);
    this.findById   = this.findById.bind (this);
    this.find       = this.find.bind (this);
    this.findOne    = this.findOne.bind (this);
    this.count      = this.count.bind (this);
    this.removeById = this.removeById.bind (this);
    this.remove     = this.remove.bind (this);

    // Bind raw methods to self
    this.getRawCursor = this.getRawCursor.bind (this);
    this.getRawTable  = this.getRawTable.bind (this);
    this.getRawDb     = this.getRawDb.bind (this);
  }

  /**
   * Get a plug-specific raw cursor
   */
  async getRawCursor (...args) {
    return this._plug.getRawCursor (...args);
  }

  /**
   * Get a plug-specific raw table
   */
  async getRawTable (...args) {
    return this._plug.getRawTable (...args);
  }

  /**
   * Get a plug-specific raw DB
   */
  async getRawDb (...args) {
    return this._plug.getRawDb (...args);
  }

  /**
   * Save a Model instance to database
   */
  async save (model, modelId = null) {
    // Get collection ID of provided Model instance
    const collectionId = modelInstanceCollectionId (model);

    // Check if provided Model instance has an ID already
    if (modelId == null) {
      // Insert Model instance data and return the associated ID
      return await this._plug.insert (collectionId, model.get ());
    } else {
      // Update stored Model instance data using existing associated ID and return null
      await this._plug.replaceById (collectionId, model.get ("_id"), model.get ());
      return null;
    }
  }

  /**
   * Find a stored Model instance by Model and an ID
   */
  async findById (Model, id) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Find single Model instance data matching provided ID
    const foundValue = await this._plug.findById (collectionId, id);

    // Return null if no data was found
    if (foundValue == null) {
      return null;
    }

    // Return Model instance constructed from fetched data
    return new Model (foundValue.object, id);
  }

  /**
   * Find a stored Model instance data by Model and an ID
   */
  async findDataById (Model, id) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Find single Model instance data matching provided ID
    const foundValue = await this._plug.findById (collectionId, id);

    // Return found instance data
    return foundValue.object;
  }

  /**
   * Find stored Model instances by Model and provided internal query
   */
  async find (Model, query) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Find Model instance data matching provided query
    const foundValues = await this._plug.find (collectionId, query);

    // Create array for storing constructed Model instances
    const models = [];

    // Iterate fetched instance data
    for (const foundValue of foundValues) {
      // Add new Model instance created from fetched data to Model instance array
      models.push (new Model (foundValue.object, foundValue.id));
    }

    // Return array of Model instances
    return models;
  }

  /**
   * Find a single stored Model instance by Model and provided internal query
   */
  async findOne (Model, query) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Find single Model instance data matching provided query
    const foundValue = await this._plug.findOne (collectionId, query);

    // Return null if no data was found
    if (foundValue == null) {
      return null;
    }

    // Return Model instance constructed from fetched data
    return new Model (foundValue.object, foundValue.id);
  }

  /**
   * Count stored Model instances by Model and provided internal query
   */
  async count (Model, query) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Return count of Model instances matching provided query
    return await this._plug.count (collectionId, query);
  }

  /**
   * Sum fields of all field values by Mode, provided internal query, and key
   */
  async sum (Model, query, key) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Return sum of all values by provided key of Model instances matching provided query
    return await this._plug.sum (collectionId, query, key);
  }

  /**
   * Remove a stored Model instance by Model and an ID
   */
  async removeById (Model, id) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Remove stored Model instance matching provided ID
    await this._plug.removeById (collectionId, id);
  }

  /**
   * Remove stored Model instances by Model and provided internal query
   */
  async remove (Model, query) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Remove Model instances matching provided query
    await this._plug.removeById (collectionId, query);
  }

  /**
   * Tell a database plug to prepare database for a new Model
   */
  async initCollection (Model) {
    // Get collection ID of provided Model
    const collectionId = modelCollectionId (Model);

    // Tell plug to prepare for new collection
    this._plug.initCollection (collectionId);
  }
}

// Export module
module.exports = exports = DbApi
