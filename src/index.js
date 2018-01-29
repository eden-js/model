'use strict';

// Require dependencies
const pluralize = require ('pluralize');

// Require local dependencies
const DbModel     = require ('./model');
const MongoPlug   = require ('./plugs/mongo');
const RethinkPlug = require ('./plugs/rethink');

function modelCollectionId (Model) {
  return pluralize (Model.name.toLowerCase ());
}

function modelInstanceCollectionId (model) {
  return pluralize (model.constructor.name.toLowerCase ());
}

class DbApi {
  constructor (dbPlug) {
    this._plug = dbPlug;

    this.saveModel       = this.saveModel.bind (this);
    this.findModelById   = this.findModelById.bind (this);
    this.findModels      = this.findModels.bind (this);
    this.findModel       = this.findModel.bind (this);
    this.countModels     = this.countModels.bind (this);
    this.removeModelById = this.removeModelById.bind (this);
    this.removeModels    = this.removeModels.bind (this);
  }

  async saveModel (model) {
  const collectionId = modelInstanceCollectionId (model);

    if (model.id == null) {
      model.id = await this._plug.insert (collectionId, model.get ());
    } else {
      await this._plug.replaceById (collectionId, model.id, model.get ());
    }
  }

  async findModelById (Model, id) {
    const collectionId = modelCollectionId (Model);
    const foundValue = await this._plug.findById (collectionId, id);

    if (foundValue == null) {
      return null;
    }

    return new Model (foundValue, id);
  }

  async findModels (Model, query) {
    const collectionId = modelCollectionId (Model);
    const foundValues = await this._plug.find (collectionId, query);

    const models = [];

    for (const foundValue of foundValues) {
      models.push (new Model (foundValue.object, foundValue.id));
    }

    return models;
  }

  async findModel (Model, query) {;
    const collectionId = modelCollectionId (Model)
    const foundValue = await this._plug.findOne (collectionId, query);

    if (foundValue == null) {
      return null;
    }

    return new Model (foundValue.object, foundValue.id);
  }

  async countModels (Model, query) {
    const collectionId = modelCollectionId (Model);
    return await this._plug.count (collectionId, query);
  }

  async removeModelById (Model, id) {
    const collectionId = modelCollectionId (Model);
    await this._plug.removeById (collectionId, id);
  }

  async removeModels (Model, query) {
    const collectionId = modelCollectionId (Model);
    await this._plug.removeById (collectionId, query);
  }
}

class Db {
  constructor (dbPlug) {
    this._dbApi = new DbApi (dbPlug);

    this.register = this.register.bind (this);
  }

  register (Model) {
    Model._$_db = this._dbApi;
  }
}

module.exports = exports = {
  Db      : Db,
  DbModel : DbModel,

  plugs: {
    MongoPlug   : MongoPlug,
    RethinkPlug : RethinkPlug,
  },
};
