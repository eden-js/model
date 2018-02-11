'use strict';

// Require dependencies
const R   = require ('rethinkdb');
const RE2 = require ('re2');

// Require local dependencies
const DbPlug = require ('../dbplug')

/**
 * Convert a RegExp object to a RethinkDB-compatible Regex string
 */
function regexToGoodString (re) {
  // Create a string of the RegExp object from RE2
	const baseStr = (new RE2 (re)).toString ();
  // Match the base components of the Regex string
	const baseStrMatch = baseStr.match (/\/(.*)\/(.*)/);

  // Create a string that will be the appropriate format for flags
	const flagStr = baseStrMatch[2].length > 0 ? `(?${baseStrMatch[2]})` : '';

  // Return the reconstructed Regex string
	return `${flagStr}${baseStrMatch[1]}`;
}

/**
 * Swap two keys in an object around
 */
function swapKeys (key1, key2, obj) {
  // Create new copy of object so not to modify by reference
  const swappedObj = Object.assign ({}, obj);

  // Get references to existing values
  const val1 = swappedObj.hasOwnProperty (key1) ? swappedObj[key1] : null;
  const val2 = swappedObj.hasOwnProperty (key2) ? swappedObj[key2] : null;

  // Delete being-swapped values from the object
  delete swappedObj[key1];
  delete swappedObj[key2];

  // Re-apply the found references
  if (val1 != null) swappedObj[key2] = val1;
  if (val2 != null) swappedObj[key1] = val2;

  // Return the updated object
  return swappedObj;
}

/**
 * RethinkDb database plug class
 */
class RethinkPlug extends DbPlug {
  /**
   * Construct RethinkDb database plug class
   */
  constructor (config) {
		super ();

    // Store map of promises that resolve when table is ready
    this._preparedTables = new Map ();

    // Store config
    this._config = config;

    // Bind builder to self
    this._build = this._build.bind (this);

    // Bind raw methods to self
    this.getRawCursor = this.getRawCursor.bind (this);
    this.getRawTable  = this.getRawTable.bind (this);
    this.getRawDb     = this.getRawDb.bind (this);

    // Bind internal methods to self
    this._queryToCursor  = this._queryToCursor.bind (this);
    this._getTable       = this._getTable.bind (this);
    this._fetchDocs      = this._fetchDocs.bind (this);
    this._fetchDoc       = this._fetchDoc.bind (this);
    this._count          = this._count.bind (this);
    this._remove         = this._remove.bind (this);
    this._insert         = this._insert.bind (this);
    this._handleRawModel = this._handleRawModel.bind (this);

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
    // Await connecting to rethinkdb, and internally store client connection
    this._rethinkConn = await R.connect (this._config);
  }

  /**
   * Prepare database for new collection of provided collection ID
   */
  async initCollection (collectionId) {
    // If this collection has already been initiated, ignore
    if (this._preparedTables.has (collectionId)) return;

    await this._building;

    // Add promise that resolves when table created to prepared tables promise map
    this._preparedTables.set (collectionId, (async () => {
      const tableExists = await R.tableList ().contains (collectionId).run (this._rethinkConn);

      if (!tableExists) {
        await R.tableCreate (collectionId).run (this._rethinkConn);
      }
    }) ());
  }

  /**
  * Return a copy of a raw cursor by provided tableName
  */
  async getRawCursor (tableName) {
    await this._building;

    return await this._getTable (tableName);
  }

  /**
  * Return a copy of a raw table by provided table name
  */
  async getRawTable (tableName) {
    await this._building;

    return await this._getTable (tableName);
  }

  /**
  * Return a copy of the raw internal database
  */
  async getRawDb (tableName) {
    await this._building;
    return this._rethinkConn;
  }

  /**
   * Get a table by provided table name, ensuring table exists
   */
  async _getTable (tableName) {
    await this._preparedTables.get (tableName);

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
   * Sum by provided cursor and field key
   */
  async _sum (cursor, key) {
    // Return executed count query using provided cursor
    return await cursor.sum (key).run (this._rethinkConn);
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
  async _replace (table, newObject, id) {
    // Create a copy of the provided object to avoid modifying original by reference
    const insertObject = Object.assign ({}, newObject);

    // Set `id` of the data to be the Model instance's db data ID
    insertObject.id = id;

    // Execute replace query using provided cursor and provided replacement object
    await table.get (id).replace (insertObject).run (this._rethinkConn);
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
        // Iterate all values in the filter object
        for (const [filterKey, filterVal] of Object.entries (queryPt.filter)) {
          // If value data is a RegExp match, handle seperately
          if (filterVal instanceof RegExp) {
            // Delete by key from filter object
            delete queryPt.filter[filterKey];

            // Construct a compatible Regex string from the RegExp filter value
            const regexString = regexToGoodString (filterVal).toString ();

            // Add a custom filter method to the cursor
            cursor = cursor.filter (R.row (filterKey).match (regexString));
          }
        }

        // Apply filter object to `filter` cursor method
        cursor = cursor.filter (queryPt.filter);
      } else if (queryPt.type === 'whereOr') {
        // Array for storing filter parts
        const orMatchFilters = [];

        // Iterate query part possible match objects to make RethinkDB ready filters
        for (const match of queryPt.matches) {
          // Variable for storing RethinkDB ready filter
          let filterPart = null;

          // Iterate all properties of provided object
          for (const [matchKey, matchVal] of Object.entries (match)) {
            // Create RethinkDB match for specific row in object
            let filterPartMatch = R.row (matchKey).default (null).eq (matchVal);

            // If existing filter data, append this as clause, otherwise set this as filter data
            if (filterPart != null) {
              filterPart = filterPartMatch.and (filterPart);
            } else {
              filterPart = filterPartMatch;
            }
          }

          // Push new RethinkDB ready filter
          orMatchFilters.push (filterPart);
        }

        if (orMatchFilters.length === 0) {
          // If no filters, give blank object
          cursor = cursor.filter ({});
        } else if (orMatchFilters.length === 1) {
          // If 1 filter, provide as only filter
          cursor = cursor.filter (orMatchFilters[0]);
        } else if (orMatchFilters.length > 1) {
          // If 2 or more filters, use all as `or` arguments to use in filter
          cursor = cursor.filter (R.or (...orMatchFilters));
        }
      } else if (queryPt.type === 'whereAnd') {
        // Array for storing filter parts
        const andMatchFilters = [];

        // Iterate query part possible match objects to make RethinkDB ready filters
        for (const match of queryPt.matches) {
          // Variable for storing RethinkDB ready filter
          let filterPart = null;

          // Iterate all properties of provided object
          for (const [matchKey, matchVal] of Object.entries (match)) {
            // Create RethinkDB match for specific row in object
            let filterPartMatch = R.row (matchKey).default (null).eq (matchVal);

            // If existing filter data, append this as clause, otherwise set this as filter data
            if (filterPart != null) {
              filterPart = filterPartMatch.and (filterPart);
            } else {
              filterPart = filterPartMatch;
            }
          }

          // Push new RethinkDB ready filter
          andMatchFilters.push (filterPart);
        }

        if (andMatchFilters.length === 0) {
          // If no filters, give blank object
          cursor = cursor.filter ({});
        } else if (andMatchFilters.length === 1) {
          // If 1 filter, provide as only filter
          cursor = cursor.filter (andMatchFilters[0]);
        } else if (andMatchFilters.length > 1) {
          // If 2 or more filters, use all as `and` arguments to use in filter
          cursor = cursor.filter (R.and (...andMatchFilters));
        }
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
  _handleRawModel (rawModelObject) {
    // If no Model instance data found, return null
    if (rawModelObject == null) {
      return null;
    }

    // Swap `id` and `_id` around for compatibility without possibly conflicting props
    const object = swapKeys ('id', '_id', rawModelObject);

    // Extract Model ID from raw data
    const modelId = object._id;
    delete object._id

    // Return correctly structured fetched Model instance data
    return {
      id     : modelId,
      object : object,
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

    // get doc
    const rawModelRes = await table.get (id).run (this._rethinkConn);

    // Parse raw model data to model data and return
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
      // Parse raw model data to model data
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

    // Parse raw model data to model data and return
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
   * Get sum of data by provided key of all matching Model data by collection ID and constructed query
   */
  async sum (collectionId, query, key) {
    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    // Construct cursor from provided query, and use it to fetch sum of matching Model instance data's matching fields
    return await this._sum (this._queryToCursor (table, query), key)
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
    await this._replace (table, swapKeys ('id', '_id', newObject), id);
  }

  /**
   * Insert Model data from database by collection ID and return Model ID
   */
  async insert (collectionId, object) {
    // Wait for building to finish
    await this._building;

    // Get table by provided collection ID
    const table = await this._getTable (collectionId);

    // Insert Model instance data into database and get inserted ID
    const id = this._insert (table, swapKeys ('id', '_id', object));

    // Return ID of Model instance data in database
    return id;
  }
}

// Exports
module.exports = exports = RethinkPlug;
