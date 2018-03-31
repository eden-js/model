const MONGO_URL = process.env.MONGO_URL || 'localhost:27017';
const RETHINK_URL = process.env.RETHINK_URL || 'localhost:28015';

const assert  = require ('chai').assert;

const { Db, DbModel, plugs: { RethinkPlug, MongoPlug } } = require ('./index');

const rethinkPlug = new RethinkPlug ({ host: RETHINK_URL.split (':')[0], port: RETHINK_URL.split (':')[1], db: 'test', });
const mongoPlug = new MongoPlug ({ url: `mongodb://${MONGO_URL}/`, db: 'test' });

async function testQueryActions (opts) {
	opts.ignores     = opts.ignores || [];
	opts.checkOrder  = opts.checkOrder || false;

	if (opts.ignores.indexOf ('count') === -1) {
		const modelCount = await opts.query.count ();
		assert.strictEqual (modelCount, opts.models.length, 'Count of models is wrong');
	}

	if (opts.ignores.indexOf ('find') === -1) {
		const models = await opts.query.find ();
		assert.isArray (models, 'Return from find is not an array');

		const modelsData = models.map (model => model.get ());

		if (opts.checkOrder) {
			assert.deepEqual (modelsData, opts.models, 'Found models are not the same as expected models')
		} else {
			assert.sameDeepMembers (modelsData, opts.models, 'Found models are not the same as expected');
		}
	}

	if (opts.ignores.indexOf ('sum') === -1) {
		const modelSum = await opts.query.sum ('val');
		assert.strictEqual (modelSum, opts.models.length * 2, 'Sum of fetched model\'s `val` is the wrong amount');
	}

	if (opts.ignores.indexOf ('findOne') === -1) {
		const model = await opts.query.findOne ();

		if (opts.models.length > 0) {
			assert.isNotNull (model, 'Single model request returned null, expected model');

			if (opts.checkOrder) {
				assert.deepEqual (model.get (), opts.models[0]);
			} else {
				// For lack of a better method?
				assert.includeDeepMembers (opts.models, [model.get ()], 'Found single model matched none of the expected');
			}
		} else {
			assert.isNull (model, 'Single model request returned model, expected null');
		}
	}
}

async function testSimpleQuery (opts) {
	await opts.Model.remove ({});

	for (const entriesArr of [opts.testMatches, opts.testMatchEntries, opts.testNotMatchEntries]) {
		if (entriesArr == null) continue;

		for (const entry of entriesArr) {
			entry.val = 2;
		}
	}

	if (opts.testNotMatchEntries.length > 0) {
		await Promise.all (opts.testNotMatchEntries.map (async (testEntry) => {
			await (new opts.Model (testEntry)).save ();
		}));
	}

	await testQueryActions ({
		ignores : opts.ignores,
		query   : opts.query,
		models  : [],
	});

	await Promise.all (opts.testMatchEntries.map (async (testEntry) => {
		await (new opts.Model (testEntry)).save ();
	}));

	await testQueryActions ({
		ignores     : opts.ignores,
		query       : opts.query,
		models      : opts.testMatches || opts.testMatchEntries,
		checkOrder  : opts.checkOrder,
	});
}

async function testWhere (Model) {
	console.log ('-- Testing where');

	await testSimpleQuery ({
		Model               : Model,
		query               : Model.where ({ a: { b: 1 }, b: 2, c: null }),
		testMatchEntries    : [
			{ a: { b: 1 }, b: 2 },
			{ a: { a: 1, b: 1 }, b: 2 },
		],
		testNotMatchEntries : [
			{ },
			{ a: { b: 1 }, b: 2, c: true },
			{ a: { b: 1 }, b: 3 },
			{ a: { a: 1, b: 1 }, b: 3 },
			{ a: { b: 1 } },
			{ a: { a: 1, b: 1 } },
			// { a: 1 },
			// { a: [1] },
		],
	});

	await testSimpleQuery ({
		Model               : Model,
		query               : Model.where ({ a: 1 }),
		testMatchEntries    : [
			{ a: 1, b: 2 },
			{ a: 1 },
		],
		testNotMatchEntries : [
			{ },
			{ a: 2, b: 2 },
			{ a: 2 },
			// { a: [1] },
		],
	});
}

async function testDeepWhere (Model) {
	console.log ('-- Testing deep where');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.where ({ a: { x: 1 } }),
		testMatchEntries    : [
			{ a: { x: 1 } },
		],
		testNotMatchEntries : [
			{  },
			{ a: { x: 2 } },
			// { a: 1 },
			// { a: [1] },
		],
	});
}

async function testElemVal (Model) {
	console.log ('-- Testing elem val');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.elem ('a', 1),
		ignores             : ['sum'],
		testMatchEntries    : [
			{ a: [2, 1, 3] },
			{ a: [3, 1, 2] },
		],
		testNotMatchEntries : [
			{  },
			{ a: [2, 3, 4] },
			{ a: [4, 3, 2] },
			{ a: [{ x: 1 }] },
			// { a: 1 }
			// { a: { x: 1 } }
		],
	});
}

async function testElemObj (Model) {
	console.log ('-- Testing elem obj');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.elem ('a', { x: 1 }),
		ignores             : ['sum'],
		testMatchEntries    : [
			{ a: [{ x: 1 }, { x: 2 }] },
		],
		testNotMatchEntries : [
			{  },
			{ a: [{ x: 2 }] },
			// { a: 1 },
			// { a: { x: 1 } },
			// { a: [1] },
		],
	});
}

async function testLt (Model) {
	console.log ('-- Testing lt');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.lt ('a', 100),
		testMatchEntries    : [
			{ a: 99 },
			{ a: -1 },
		],
		testNotMatchEntries : [
			{  },
			{ a: 101 },
			{ a: 500 },
			{ a: { x: 1 } },
			// { a: [{ x: 1 }] },
			// { a: [1] },
		],
	});
}

async function testGt (Model) {
	console.log ('-- Testing gt');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.gt ('a', 100),
		testMatchEntries    : [
			{ a: 101 },
			{ a: 500 },
		],
		testNotMatchEntries : [
			{  },
			{ a: 99 },
			{ a: -1 },
			{ a: [{ x: 1 }] },
			{ a: [2] },
			// { a: { x: 1 } },
		],
	});
}

async function testLte (Model) {
	console.log ('-- Testing lte');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.lte ('a', 100),
		testMatchEntries    : [
			{ a: 100 },
			{ a: 99 },
			{ a: -1 },
		],
		testNotMatchEntries : [
			{ },
			{ a: 101 },
			{ a: 500 },
			{ a: { x: 1 } },
			// { a: [{ x: 100 }] },
			// { a: [100] },
		],
	});
}

async function testGte (Model) {
	console.log ('-- Testing gte');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.gte ('a', 100).where ({ b: 10 }),
		testMatchEntries    : [
			{ a: 100, b: 10 },
			{ a: 101, b: 10 },
			{ a: 500, b: 10 },
		],
		testNotMatchEntries : [
			{  },
			{ b: 10 },
			{ a: 100, b: 1 },
			{ a: 99 },
			{ a: -1 },
			{ a: [{ x: 100 }] },
			// { a: { x: 100 } },
			// { a: [100] },
		],
	});
}

async function testNe (Model) {
	console.log ('-- Testing ne');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.ne ('a', 'a').ne ('a', 'b').ne ('c', true),
		testMatchEntries    : [
			{  },
			{ a: 'c' },
			{ a: { x: 'a' } },
			{ a: { x: 'b' } },
			{ a: [{ x: 'a' }] },
			{ a: [{ x: 'b' }] },
			// { a: ['a'] },
			// { a: ['b'] },
		],
		testNotMatchEntries : [
			{ a: 'a' },
			{ a: 'b' },
			{ a: 'c', c: true },
		],
	});
}

async function testNin (Model) {
	console.log ('-- Testing nin');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.nin ('a', ['a', 'b']),
		testMatchEntries    : [
			{  },
			{ a: 'c' },
			{ a: { x: 'a' } },
			{ a: { x: 'b' } },
			{ a: [{ x: 'a' }] },
			{ a: [{ x: 'b' }] },
			// { a: ['a'] },
			// { a: ['b'] },
		],
		testNotMatchEntries : [
			{ a: 'a' },
			{ a: 'b' },
		],
	});
}

async function testIn (Model) {
	console.log ('-- Testing in');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.in ('a', ['a', 'b']),
		testMatchEntries    : [
			{ a: 'a' },
			{ a: 'b' },
			{ a: 'a', b: 'a' },
		],
		testNotMatchEntries : [
			{  },
			{ a: 'c' },
			// { a: ['a'] },
		],
	});
}

async function testDeepIn (Model) {
	console.log ('-- Testing deep in');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.in ('a.a', ['a', 'b']),
		testMatchEntries    : [
			{ a: { a: 'a' } },
			{ a: { a: 'b' } },
		],
		testNotMatchEntries : [
			{  },
			{ a: { a: 'c' } },
			{ a: { b: 'a' } },
			// { a: 'a' },
			// { a: ['a'] },
		],
	});
}

async function testMatch (Model) {
	console.log ('-- Testing match');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.match ('a', /^[Ww][aoe]+w( lad)?$/),
		testMatchEntries    : [
			{ a: 'wew lad' },
			{ a: 'Weeeeew' },
			{ a: 'waaaw lad' },
		],
		testNotMatchEntries : [
			{  },
			{ a: 'wewee' },
			{ a: 'WEW LAD' },
			{ a: 'wAw' },
			// { a: { } },
			// { a: ['wew'] },
			// { a: 1 },
		],
	});
}

async function testOr (Model) {
	console.log ('-- Testing or');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.or ({ a: 1, b: 2 }, { a: 2, b: 1 }, { c: 'a' }, { c: 'b' }),
		ignores             : ['sum'],
		testMatchEntries    : [
			{ a: 1, b: 2 },
			{ a: 2, b: 1 },
			{ a: 1, b: 1, c: 'a' },
			{ a: 1, b: 1, c: 'b' },
		],
		testNotMatchEntries : [
			{  },
			{ c: 'c' },
			{ a: 1 },
			{ b: 1 },
			{ a: 2 },
			{ b: 2 },
			{ a: 2, b: 2 },
			{ a: 1, b: 1 },
			{ a: { a: 1 } },
			{ a: [{ a: 1 }] },
			// { a: [1] },
		],
	});
}

async function testAnd (Model) {
	console.log ('-- Testing and');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.and ({ a: 1 }, { b: 2 }),
		ignores             : ['sum'],
		testMatchEntries    : [
			{ a: 1, b: 2 },
		],
		testNotMatchEntries : [
			{  },
			{ a: 1, b: 3 },
			{ a: 2, b: 2 },
			{ a: { x: 1 } },
			{ a: [{ x: 1 }] },
			// { a: [1] },
		],
	});
}

async function testLimit (Model) {
	console.log ('-- Testing limit');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.limit (2),
		testMatches         : [{ }, { }],
		testMatchEntries    : [
			{ },
			{ },
			{ },
			{ },
		],
		testNotMatchEntries : [],
	});
}

async function testSort (Model) {
	console.log ('-- Testing sort');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.sort ('a'),
		checkOrder          : true,
		testMatches         : [
			{ a: 5 },
			{ a: 4 },
			{ a: 3 },
			{ a: 2 },
			{ a: 1 },
		],
		testMatchEntries    : [
			{ a: 2 },
			{ a: 4 },
			{ a: 1 },
			{ a: 5 },
			{ a: 3 },
		],
		testNotMatchEntries : [],
	});
}

async function testSortSkip (Model) {
	console.log ('-- Testing sort-skip');
	await testSimpleQuery ({
		Model               : Model,
		query               : Model.sort ('a').skip (1),
		checkOrder          : true,
		testMatches         : [
			{ a: 4 },
			{ a: 3 },
			{ a: 2 },
			{ a: 1 },
		],
		testMatchEntries    : [
			{ a: 2 },
			{ a: 4 },
			{ a: 1 },
			{ a: 5 },
			{ a: 3 },
		],
		testNotMatchEntries : [],
	});
}

function testGetSet (Model) {
	console.log ('-- Testing get/set');
	const model = new Model ({ a: 1, b: { a: 2 } });

	assert.strictEqual (model.get ('a'), 1, 'Model data should initially have `a` be 1');
	assert.strictEqual (model.get ().a, 1, 'Full model data should initially have `a` be 1');
	assert.strictEqual (model.get ('b.a'), 2, 'Model data should initially have `b.a` be 2');
	assert.strictEqual (model.get ('b').a, 2, 'Full `b` model data should initially have `a` be 2');
	assert.strictEqual (model.get ().b.a, 2, 'Full model data should initially have `b.a` be 2');

	model.set ('a', 2);
	model.set ('b.a', 1);

	assert.strictEqual (model.get ('a'), 2, 'Model data should now have `a` be 2');
	assert.strictEqual (model.get ().a, 2, 'Full model data should now have `a` be 2');
	assert.strictEqual (model.get ('b.a'), 1, 'Model data should now have `b.a` be 1');
	assert.strictEqual (model.get ('b').a, 1, 'Full `b` model data should now have `a` be 1');
	assert.strictEqual (model.get ().b.a, 1, 'Full model data should now have `b.a` be 1');
}

async function testModel (Model) {
	console.log ('-- Testing model storage');

	await Model.remove ({});

	const model = new Model ({ a: 1 });

	assert.isNull (await Model.findOne (), 'findOne returned model data when none should exist');
	assert.lengthOf (await Model.find (), 0, 'find returned a non empty array of model data when none should exist');

	await model.save ();

	const model2 = await Model.findOne ();

	assert.isNotNull (model2, 'findOne returned null when model data should exist');
	assert.lengthOf (await Model.find (), 1, 'find returned an empty array when model data should exist');

	assert.strictEqual (model.get ('a'), 1);
	assert.strictEqual (model2.get ('a'), 1);

	model.set ('b', 2);
	await model.save ();
	await model2.refresh ();

	assert.strictEqual (model.get ('b'), 2);
	assert.strictEqual (model2.get ('b'), 2);
	assert.strictEqual (model.get ('a'), 1);
	assert.strictEqual (model2.get ('a'), 1);

	model.unset ('b');
	await model.save ();
	await model2.refresh ();

	assert.strictEqual (model.get ('b'), undefined);
	assert.strictEqual (model2.get ('b'), undefined);
	assert.strictEqual (model.get ('a'), 1);
	assert.strictEqual (model2.get ('a'), 1);

	model.set ('a', 3);
	await model.replace ();
	await model2.refresh ();

	assert.strictEqual (model.get ('a'), 3);
	assert.strictEqual (model2.get ('a'), 3);
	assert.strictEqual (model.get ('b'), undefined);
	assert.strictEqual (model2.get ('b'), undefined);
}

async function test (plug) {
	const db = new Db (plug);

	class Model extends DbModel {}

	console.log ('- Testing basic model functionality...')
	testGetSet (Model);

	console.log ('- Testing standard...')
	await db.register (Model);

	await testModel (Model);

	await testWhere (Model);
	await testDeepWhere (Model);
	await testElemVal (Model);
	await testElemObj (Model);
	await testLt (Model);
	await testGt (Model);
	await testLte (Model);
	await testGte (Model);
	await testNe (Model);
	await testNin (Model);
	await testIn (Model);
	await testDeepIn (Model);
	await testMatch (Model);
	await testOr (Model);
	await testAnd (Model);
	await testLimit (Model);
	await testSort (Model);
	await testSortSkip (Model);

	console.log ('- Testing indexed...')
	class IndexModel extends DbModel {}
	await db.register (IndexModel);
	await IndexModel.createIndex ('wow', { a: -1, b: -1 });
	await IndexModel.createIndex ('wew', { 'a.b': -1, b: -1 });
	await IndexModel.createIndex ('a', { a: -1, });

	await testWhere (IndexModel);
	await testSort (IndexModel);
	await testIn (IndexModel);
	await testDeepIn (IndexModel);
}

;(async () => {
	try {
		console.log ('Testing MongoDB...')
		await test (mongoPlug);
	} catch (err) {
		console.error (err);
	}

	try {
		console.log ('Testing RethinkDB...')
		await test (rethinkPlug);
	} catch (err) {
		console.error (err);
	}

	console.log ('Done!');

	process.exit (0);
}) ();
