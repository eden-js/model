'use strict';

// Require dependencies
const R = require ('rethinkdb');

/**
 * RethinkDb database plug class
 */
class RethinkPlug {
  /**
   * Construct RethinkDb database plug class
   */
  constructor (config) {
    // Store config
    this._config = config;

    // Start building internal connections and store promise
    this._building = this._build ();
  }

  /**
   * Async method that resolves on internal API build completion
   */
  async _build () {
    // Await connecting to rethinkdb, and internally store client connection
    this._rethinkConn = await R.connect ({ host: this._config.host, port: this._config.port });

    // Use db by name provided in config
    this._rethinkConn.use (this._config.dbName);
  }

  /**
   * Get a table by provided table name, ensuring table exists
   */
  async _getTable (tableName) {
    // TODO: Cache known existing tables

    // Attempt to create the table to ensure it exists
    try {
      await R.tableCreate (tableName).run (this._rethinkConn);
    } catch (err) {
      // Ignore all errors, since this just means it already exists
    }

    // Return table by name
    return R.table (tableName);
  }

  /**
   * Fetch docs by a provided cursor
   */
  async _fetchDocs (cursor) {
    // Get doc cursor from executing provided cursor
    const docCursor = await cursor.run (this._rethinkConn);

    // Convert doc cursor to array of docs
    const docs = await docCursor.toArray ();

    // Return fetched docs
    return docs;
  }

  /**
   * Fetch single doc by provided cursor
   */
  async _fetchDoc (cursor) {
    // Limit cursor to 1 and get doc cursor from executing provided cursor
    const docCursor = await cursor.limit (1).run (this._rethinkConn);

    // Convert doc cursor to array of docs
    const docs = await docCursor.toArray ();

    // Return only fetched doc
    return docs[0] || null;
  }

  /**
   * Count docs by provided cursor
   */
  async _count (cursor) {
    // Return executed count query using provided cursor
    return await cursor.count ().run (this._rethinkConn);
  }

  /**
   * Remove docs by provided cursor
   */
  async _remove (cursor) {
    // Execute delete query using provided cursor
    return await cursor.delete ().run (this._rethinkConn);
  }

  /**
   * Replace docs by provided cursor and replacement object
   */
  async _replace (cursor, newObject) {
    // Execute replace query using provided cursor and provided replacement object
    return await cursor.replace (newObject).run (this._rethinkConn);
  }

  /**
   * Insert provided doc object into provided table
   */
  async _insert (table, object) {
    // Insert provided object data into provided table and get response
    const insertRes = await table.insert (object).run (this._rethinkConn);

    // Return Model ID from insertation response
    return insertRes['generated_keys'][0];
  }

  /**
   * Convert a standard constructed query to a RethinkDb cursor
   */
  _queryToCursor (cursor, query) {
    for (const queryPt of query.pts) {
      if (queryPt.type === 'filter') {
        // Apply filter object to `filter` cursor method
        cursor = cursor.filter (queryPt.filter);
      } else if (queryPt.type === 'whereEquals') {
        // Apply constructed filter from key and value object to `filter` cursor method
        cursor = cursor.filter ({ [queryPt.match.prop]: queryPt.match.value });
      } else if (queryPt.type === 'limit') {
        // Apply amt to `limit` cursor method
        cursor = cursor.limit (queryPt.limitAmount);
      } else if (queryPt.type === 'skip') {
        // Apply amt to `skip` cursor method
        cursor = cursor.skip (queryPt.skipAmount);
      } else if (queryPt.type === 'sort') {
        // Create sort filter and apply to `orderBy` cursor method
        cursor = cursor.orderBy (queryPt.desc ? R.desc (R.row (queryPt.sortKey)) : R.asc (R.row (queryPt.sortKey)));
      } else if (queryPt.type === 'gt') {
        // Create `gt` filter using provided key and min and apply to `filter` cursor method
        cursor = cursor.filter (R.row (queryPt.key).gt (queryPt.min));
      } else if (queryPt.type === 'lt') {
        // Create `lt` filter using provided key and min and apply to `filter` cursor method
        cursor = cursor.filter (R.row (queryPt.key).lt (queryPt.max));
      } else if (queryPt.type === 'gte') {
        // Create `gte` filter using provided key and min and apply to `filter` cursor method
        cursor = cursor.filter (R.row (queryPt.key).ge (queryPt.min));
      } else if (queryPt.type === 'lte') {
        // Create `lte` filter using provided key and min and apply to `filter` cursor method
        cursor = cursor.filter (R.row (queryPt.key).le (queryPt.max));
      }
    }

    // Return the fully constructed cursor
    return cursor;
  }

  /**
   * Parsed DB-stored data into safe Model instance data components
   */
  _handleRawModel(rawModelObject) {
    // If no Model instance data found, return null
    if (rawModelObject == null) {
      return null;
    }

    const modelId = rawModelObject.id

    rawModelObject.id = rawModelObject._id

    // Return correctly structured fetched Model instance data
    return {
      id     : modelId,
      object : rawModelObject,
    }
  }

  /**
   * Find Model data by collection ID and Model ID
   */
  async findById (collectionId, id) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    // Fetch single Model instance data by provided ID
    const rawModelRes = await this._fetchDoc (table.get (id));

    return this._handleRawModel (rawModelRes);
  }

  /**
   * Find Model data by collection ID and constructed query
   */
  async find (collectionId, query) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    // Fetch, map, and return found Model instance data found by cursor constructed from provided query
    return (await this._fetchDocs (this._queryToCursor (table, query))).map ((rawModelRes) => {
      return this._handleRawModel (rawModelRes);
    });
  }

  /**
   * Find single Model data by collection ID and Model ID
   */
  async findOne (collectionId, query) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    // Construct cursor from provided query, and use it to fetch single Model instance data
    const rawModelRes = await this._fetchDoc (this._queryToCursor (table, query));

    return this._handleRawModel (rawModelRes);
  }

  /**
   * Get count of Model data by collection ID and constructed query
   */
  async count (collectionId, query) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);
    // Construct cursor from provided query, and use it to fetch count of matching Model instance data
    return await this._count (this._queryToCursor (table, query));
  }

  /**
   * Remove matching Model data from database by collection ID and Model ID
   */
  async removeById (collectionId, id) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);
    // Find and remove single Model instance data by provided ID
    await this._remove (table.get (id));
  }

  /**
   * Remove matching Model data from database by collection ID and constructed query
   */
  async remove (collectionId, query) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    // Find and remove matching Model instance data by provided query
    await this._remove (this._queryToCursor (table, query));
  }

  /**
   * Replace matching Model data from database by collection ID, Model ID, and replacement data
   */
  async replaceById (collectionId, id, newObject) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    // Find and update Model instance data by provided ID and replacement object
    await this._replace (table.get (id), newObject);
  }

  /**
   * Replace matching Model data from database by collection ID, Model ID, and constructed query
   */
  async replace (collectionId, query, newObject) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    // Construct cursor from provided query and update matching Model instance data with provided replacement object
    await this._replace (this._queryToCursor (table, query), newObject);
  }

  /**
   * Insert Model data from database by collection ID and return Model ID
   */
  async insert (collectionId, object) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    if (object.hasOwnProperty("id")) {
      object._id = object.id
      delete object.id
    }

    // Insert Model instance data into database and get inserted ID
    const id = this._insert (table, object);

    // Return ID of Model instance data in database
    return id;
  }
}

// Exports
module.exports = exports = RethinkPlug;
