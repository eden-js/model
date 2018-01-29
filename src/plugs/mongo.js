"use strict";

const { MongoClient, ObjectId } = require ("mongodb");
const MQuery = require ("mquery");
const p = require ("doasync");

class MongoPlug {
  constructor (config) {
    this._config = config;
    this._building = this._build ();
  }

  async _build () {
    this._client = await p (MongoClient).connect (this._config.url);
    this._db = this._client.db (this._config.dbName);
  }

  _queryToCursor (cursor, query) {
    for (const queryPt of query.pts) {
      if (queryPt.type === "filter") {
        cursor = cursor.where (queryPt.filter);
      } else if (queryPt.type === "whereEquals") {
        cursor = cursor.where ({ [queryPt.match.prop]: queryPt.match.value });
      } else if (queryPt.type === "limit") {
        cursor = cursor.limit (queryPt.limitAmount);
      } else if (queryPt.type === "skip") {
        cursor = cursor.skip (queryPt.skipAmount);
      } else if (queryPt.type === "sort") {
        cursor = cursor.sort ({ [queryPt.sortKey]: queryPt.desc ? "desc" : "asc" });
      } else if (queryPt.type === "gt") {
        cursor = cursor.where (queryPt.key).gt (queryPt.min);
      } else if (queryPt.type === "lt") {
        cursor = cursor.where (queryPt.key).lt (queryPt.max);
      } else if (queryPt.type === "gte") {
        cursor = cursor.where (queryPt.key).gte (queryPt.min);
      } else if (queryPt.type === "lte") {
        cursor = cursor.where (queryPt.key).lte (queryPt.max);
      }
    }

    return cursor;
  }

  async findById (collectionId, id) {
    await this._building;

    const mQuery = MQuery (this._db.collection (collectionId));
    return await mQuery.findOne ({ _id: id }).exec ();
  }

  async find (collectionId, query) {
    await this._building

    const mQuery = MQuery (this._db.collection (collectionId));
    return (await this._queryToCursor (mQuery, query).find ().exec ()).map ((rawModelRes) => {
      const fetchedModelId = rawModelRes._id;

      delete rawModelRes._id;
      const fetchedModelObject = rawModelRes;

      return {
        id     : fetchedModelId,
        object : fetchedModelObject,
      }
    })
  }

  async findOne (collectionId, query) {
    await this._building;

    const mQuery = MQuery (this._db.collection (collectionId));
    const rawModelRes = await this._queryToCursor (mQuery, query).findOne ().exec ()

    if (rawModelRes == null) {
      return null;
    }

    const fetchedModelId = rawModelRes._id;

    delete rawModelRes._id;
    const fetchedModelObject = rawModelRes;

    return {
      id     : fetchedModelId,
      object : fetchedModelObject,
    }
  }

  async count (collectionId, query) {
    await this._building;

    const mQuery = MQuery (this._db.collection (collectionId));
    return await this._queryToCursor (mQuery, query).count ().exec ();
  }

  async removeById (collectionId, id) {
    await this._building

    const mQuery = MQuery (this._db.collection (collectionId));
    await mQuery.findOneAndRemove ({ _id: ObjectId (id) }).exec ();
  }

  async remove (collectionId, query) {
    await this._building

    const mQuery = MQuery (this._db.collection (collectionId));
    await this._queryToCursor (mQuery, query).remove ().exec ();
  }

  async replaceById (collectionId, id, newObject) {
    await this._building

    const mQuery = MQuery (this._db.collection (collectionId));
    await mQuery.update ({ _id: id }, newObject, { overwrite: true }).exec ();
  }

  async replace (collectionId, query, newObject) {
    await this._building;

    const mQuery = MQuery (this._db.collection (collectionId));
    await this._queryToCursor (mQuery, query).update ().setOptions ({ overwrite: true, multi: true }).exec ();
  }

  async insert (collectionId, object) {
    await this._building;

    const collection = this._db.collection (collectionId);
    const id = (await collection.insertOne (object)).insertedId;
    return id;
  }
}

module.exports = exports = MongoPlug;
