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
    this._config = config;
    this._building = this._build ();
  }

  /**
   * Async method that resolves on internal API build completion
   */
  async _build () {
    this._rethinkConn = await R.connect ({ host: this._config.host, port: this._config.port });
    this._rethinkConn.use (this._config.dbName);
  }

  /**
   * Get a table by provided table name, ensuring table exists
   */
  async _getTable (tableName) {
    // TODO: Cache known existing tables

    try {
      await R.tableCreate (tableName).run (this._rethinkConn);
    } catch (err) {  }

    return R.table (tableName);
  }

  /**
   * Fetch docs by a provided cursor
   */
  async _fetchDocs (cursor) {
    const docCursor = await cursor.run (this._rethinkConn);
    const docs = await docCursor.toArray ();

    return docs;
  }

  /**
   * Fetch single doc by provided cursor
   */
  async _fetchDoc (cursor) {
    const docCursor = await cursor.limit (1).run (this._rethinkConn);

    const docs = await docCursor.toArray ();

    return docs[0];
  }

  /**
   * Count docs by provided cursor
   */
  async _count (cursor) {
    return await cursor.count ().run (this._rethinkConn);
  }

  /**
   * Remove docs by provided cursor
   */
  async _remove (cursor) {
    return await cursor.delete ().run (this._rethinkConn);
  }

  /**
   * Replace docs by provided cursor and replacement object
   */
  async _replace (cursor, newObject) {
    return await cursor.replace (newObject).run (this._rethinkConn);
  }

  /**
   * Insert provided doc object into provided table
   */
  async _insert (table, object) {
    const insertRes = await table.insert ({ data: object }).run (this._rethinkConn);
    return insertRes['generated_keys'][0];
  }

  /**
   * Convert a standard constructed query to a RethinkDb cursor
   */
  _queryToCursor (cursor, query) {
    for (const queryPt of query.pts) {
      if (queryPt.type === 'filter') {
        cursor = cursor.filter ({ data: queryPt.filter });
      } else if (queryPt.type === 'whereEquals') {
        cursor = cursor.filter ({ data: { [queryPt.match.prop]: queryPt.match.value } });
      } else if (queryPt.type === 'limit') {
        cursor = cursor.limit (queryPt.limitAmount);
      } else if (queryPt.type === 'skip') {
        cursor = cursor.skip (queryPt.skipAmount);
      } else if (queryPt.type === 'sort') {
        cursor = cursor.orderBy (queryPt.desc ? R.desc (R.row ('data') (queryPt.sortKey)) : R.asc (R.row ('data') (queryPt.sortKey)));
      } else if (queryPt.type === 'gt') {
        cursor = cursor.filter (R.row ('data') (queryPt.key).gt (queryPt.min));
      } else if (queryPt.type === 'lt') {
        cursor = cursor.filter (R.row ('data') (queryPt.key).lt (queryPt.max));
      } else if (queryPt.type === 'gte') {
        cursor = cursor.filter (R.row ('data') (queryPt.key).ge (queryPt.min));
      } else if (queryPt.type === 'lte') {
        cursor = cursor.filter (R.row ('data') (queryPt.key).le (queryPt.max));
      }
    }

    return cursor;
  }

  /**
   * Find Model data by collection ID and Model ID
   */
  async findById (collectionId, id) {
    await this._building;

    const table = await this._getTable (collectionId);
    const rawModelRes = await this._fetchDoc (table.get (id));

    if (rawModelRes == null) {
      return null;
    }

    return {
      id     : rawModelRes.id,
      object : rawModelRes.data,
    }
  }

  /**
   * Find Model data by collection ID and constructed query
   */
  async find (collectionId, query) {
    await this._building;

    const table = await this._getTable (collectionId);
    return (await this._fetchDocs (this._queryToCursor (table, query))).map ((rawModelRes) => {
      return {
        id     : rawModelRes.id,
        object : rawModelRes.data,
      }
    });
  }

  /**
   * Find single Model data by collection ID and Model ID
   */
  async findOne (collectionId, query) {
    await this._building;

    const table = await this._getTable (collectionId);
    const rawModelRes = await this._fetchDoc (this._queryToCursor (table, query));

    if (rawModelRes == null) {
      return null;
    }

    return {
      id     : rawModelRes.id,
      object : rawModelRes.data,
    }
  }

  /**
   * Get count of Model data by collection ID and constructed query
   */
  async count (collectionId, query) {
    await this._building;

    const table = await this._getTable (collectionId);
    return await this._count (this._queryToCursor (table, query));
  }

  /**
   * Remove matching Model data from database by collection ID and Model ID
   */
  async removeById (collectionId, id) {
    await this._building;

    const table = await this._getTable (collectionId);
    await this._remove (table.get (id));
  }

  /**
   * Remove matching Model data from database by collection ID and constructed query
   */
  async remove (collectionId, query) {
    await this._building;

    const table = await this._getTable (collectionId);
    await this._remove (this._queryToCursor (table, query));
  }

  /**
   * Replace matching Model data from database by collection ID, Model ID, and replacement data
   */
  async replaceById (collectionId, id, newObject) {
    await this._building;

    const table = await this._getTable (collectionId);
    await this._replace (table.get (id), newObject);
  }

  /**
   * Replace matching Model data from database by collection ID, Model ID, and constructed query
   */
  async replace (collectionId, query, newObject) {
    await this._building;

    const table = await this._getTable (collectionId);
    await this._replace (this._queryToCursor (table, query), newObject);
  }

  /**
   * Insert Model data from database by collection ID and return Model ID
   */
  async insert (collectionId, object) {
    await this._building;

    const table = await this._getTable (collectionId);
    const id = this._insert (table, object);

    return id;
  }
}

// Exports
module.exports = exports = RethinkPlug;
