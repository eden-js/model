'use strict';

// Require dependencies
const { MongoClient, ObjectId } = require ('mongodb');
const MQuery = require ('mquery');
const p = require ('doasync');

/**
 * MongoDb database plug class
 */
class MongoPlug {
  /**
   * Construct MongoDb database plug class
   */
  constructor (config) {
    // Store config
    this._config = config;

    // Bind builder to self
    this._build = this._build.bind (this);

    // Bind raw methods to self
    this.getRawCursor = this.getRawCursor.bind (this);
    this.getRawTable  = this.getRawTable.bind (this);
    this.getRawDb     = this.getRawDb.bind (this);

    // Bind internal methods to self
    this._queryToCursor = this._queryToCursor.bind (this);

    // Bind public methods to self
    this.findById    = this.findById.bind (this);
    this.find        = this.find.bind (this);
    this.findOne     = this.findOne.bind (this);
    this.count       = this.count.bind (this);
    this.removeById  = this.removeById.bind (this);
    this.remove      = this.remove.bind (this);
    this.replaceById = this.replaceById.bind (this);
    this.insert      = this.insert.bind (this);

    // Start building internal connections and store promise
    this._building = this._build ();
  }

  /**
   * Async method that resolves on internal API build completion
   */
  async _build () {
    // Await connecting to MongoDb and internally store client connection
    this._client = await p (MongoClient).connect (this._config.url);

    // Internally store db by name provided in config
    this._db = this._client.db (this._config.db);
  }

  /**
   * Prepare database for new collection of provided collection ID
   */
  initCollection (collectionId) {
    // MongoDB just works, we dont need to do anything
  }

  /**
  * Return a copy of a raw cursor by provided collectionId
  */
  async getRawCursor (collectionId) {
    await this._building;
    return MQuery (this._db.collection (collectionId));
  }

  /**
  * Return a copy of a raw table by provided collectionId
  */
  async getRawTable (collectionId) {
    await this._building;
    return this._db.collection (collectionId);
  }

  /**
  * Return a copy of the raw internal database
  */
  async getRawDb () {
    await this._building;
    return this._db;
  }

  /**
   * Convert a standard constructed query to an MQuery cursor
   */
  _queryToCursor (cursor, query) {
    // Iterate over all parts of the query
    for (const queryPt of query.pts) {
      if (queryPt.type === 'filter') {
        // Apply filter object to `where` cursor method
        cursor = cursor.where (queryPt.filter);
      } else if (queryPt.type === 'whereEquals') {
          // Apply constructed filter from key and value object to `where` cursor method
        cursor = cursor.where ({ [queryPt.match.prop]: queryPt.match.value });
      } else if (queryPt.type === 'limit') {
          // Apply amt to `limit` cursor method
        cursor = cursor.limit (queryPt.limitAmount);
      } else if (queryPt.type === 'skip') {
          // Apply amt to `skip` cursor method
        cursor = cursor.skip (queryPt.skipAmount);
      } else if (queryPt.type === 'sort') {
        // Apply custom sort filter object to `sort` cursor method
        cursor = cursor.sort ({ [queryPt.sortKey]: queryPt.desc ? 'desc' : 'asc' });
      } else if (queryPt.type === 'gt') {
        // Apply key and max to `where` and `gt` cursor method
        cursor = cursor.where (queryPt.key).gt (queryPt.min);
      } else if (queryPt.type === 'lt') {
        // Apply key and max to `where` and `lt` cursor method
        cursor = cursor.where (queryPt.key).lt (queryPt.max);
      } else if (queryPt.type === 'gte') {
        // Apply key and max to `where` and `gte` cursor method
        cursor = cursor.where (queryPt.key).gte (queryPt.min);
      } else if (queryPt.type === 'lte') {
        // Apply key and max to `where` and `lte` cursor method
        cursor = cursor.where (queryPt.key).lte (queryPt.max);
      }
    }

    // Return the fully constructed cursor
    return cursor;
  }

  /**
   * Find Model data by collection ID and Model ID
   */
  async findById (collectionId, id) {
    // Wait for building to finish
    await this._building;

    // Construct MQuery cursor from collection ID
    const mQuery = MQuery (this._db.collection (collectionId));

    // Find single Model instance data by provided ID
    const rawModelRes = await mQuery.findOne ({ _id: ObjectId(id) }).exec ();

    // If no Model instance data found, return null
    if (rawModelRes == null) {
      return null;
    }

    // Get internal ID from returned data
    const fetchedModelId = rawModelRes._id.toString();

    // Delete internal ID from the object
    delete rawModelRes._id;

    // Get remaining now sanitized Model instance data
    const fetchedModelObject = rawModelRes;

    // Return correctly structured fetched Model instance data
    return {
      id     : fetchedModelId,
      object : fetchedModelObject,
    }
  }

  /**
   * Find Model data by collection ID and constructed query
   */
  async find (collectionId, query) {
    // Wait for building to finish
    await this._building;

    // Construct MQuery cursor from collection ID
    const mQuery = MQuery (this._db.collection (collectionId));

    // Fetch, map, and return found Model instance data found by cursor constructed from provided query
    return (await this._queryToCursor (mQuery, query).find ().exec ()).map ((rawModelRes) => {
      // Get internal ID from returned data
      const fetchedModelId = rawModelRes._id.toString();

      // Delete internal ID from the object
      delete rawModelRes._id;

      // Get remaining now sanitized Model instance data
      const fetchedModelObject = rawModelRes;

      // Return correctly structured fetched Model instance data
      return {
        id     : fetchedModelId,
        object : fetchedModelObject,
      }
    })
  }

  /**
   * Find single Model data by collection ID and Model ID
   */
  async findOne (collectionId, query) {
    // Wait for building to finish
    await this._building;

    // Construct MQuery cursor from collection ID
    const mQuery = MQuery (this._db.collection (collectionId));

    // Construct cursor from provided query, and use it to fetch single Model instance data
    const rawModelRes = await this._queryToCursor (mQuery, query).findOne ().exec ()

    // If no Model instance data found, return null
    if (rawModelRes == null) {
      return null;
    }

    // Get internal ID from returned data
    const fetchedModelId = rawModelRes._id.toString();

    // Delete internal ID from the object
    delete rawModelRes._id;

    // Get remaining now sanitized Model instance data
    const fetchedModelObject = rawModelRes;

    // Return correctly structured fetched Model instance data
    return {
      id     : fetchedModelId,
      object : fetchedModelObject,
    }
  }

  /**
   * Get count of Model data by collection ID and constructed query
   */
  async count (collectionId, query) {
    // Wait for building to finish
    await this._building;

    // Construct MQuery cursor from collection ID
    const mQuery = MQuery (this._db.collection (collectionId));

    // Construct cursor from provided query, and use it to fetch count of matching Model instance data
    return await this._queryToCursor (mQuery, query).count ().exec ();
  }

  /**
   * Get sum of data by provided key of all matching Model data by collection ID and constructed query
   */
  async sum (collectionId, query, key) {
    // Wait for building to finish
    await this._building;

    // Construct MQuery cursor from collection ID
    const mQuery = MQuery (this._db.collection (collectionId));

    // Construct cursor from provided query, and use it to get sum of data by provided key of all matching Model data
    return await this._queryToCursor (mQuery, query).sum (key).exec ();
  }

  /**
   * Remove matching Model data from database by collection ID and Model ID
   */
  async removeById (collectionId, id) {
    // Wait for building to finish
    await this._building

    // Construct MQuery cursor from collection ID
    const mQuery = MQuery (this._db.collection (collectionId));

    // Find and remove single Model instance data by provided ID
    await mQuery.findOneAndRemove ({ _id: ObjectId (id) }).exec ();
  }

  /**
   * Remove matching Model data from database by collection ID and constructed query
   */
  async remove (collectionId, query) {
    // Wait for building to finish
    await this._building

    // Construct MQuery cursor from collection ID
    const mQuery = MQuery (this._db.collection (collectionId));

    // Find and remove matching Model instance data by provided query
    await this._queryToCursor (mQuery, query).remove ().exec ();
  }

  /**
   * Replace matching Model data from database by collection ID, Model ID, and replacement data
   */
  async replaceById (collectionId, id, newObject) {
    // Wait for building to finish
    await this._building

    // Construct MQuery cursor from collection ID
    const mQuery = MQuery (this._db.collection (collectionId));

    // Find and update Model instance data by provided ID and replacement object
    await mQuery.where ({ _id: ObjectId(id) }).setOptions ({ overwrite: true }).update (newObject).exec ();
  }

  /**
   * Insert Model data from database by collection ID and return Model ID
   */
  async insert (collectionId, object) {
    // Wait for building to finish
    await this._building;

    // Get DB collection from collection ID
    const collection = this._db.collection (collectionId);

    // Insert Model instance data into database and get inserted ID
    const id = (await collection.insertOne (object)).insertedId.toString();

    // Return ID of Model instance data in database
    return id;
  }
}

// Exports
module.exports = exports = MongoPlug;
