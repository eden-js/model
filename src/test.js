const assert  = require ('chai').assert;

const { Db, DbModel, plugs: { RethinkPlug, MongoPlug } } = require ('./index');

const rethinkPlug = new RethinkPlug ({ host: 'localhost', port: 28015, db: 'test', });
const mongoPlug = new MongoPlug ({ url: 'mongodb://localhost:27017/', db: 'test' });

async function testQueryExists (query, ignores = []) {
	if (ignores.indexOf ('count') === -1) {
		const modelCount = await query.count ();
		assert.strictEqual (modelCount, 1);
	}

	if (ignores.indexOf ('find') === -1) {
		const models = await query.find ();
		assert.isArray (models);
		assert.lengthOf (models, 1);
	}

	if (ignores.indexOf ('sum') === -1) {
		const modelSum = await query.sum ('val');
		assert.strictEqual (modelSum, 1);
	}

	if (ignores.indexOf ('findOne') === -1) {
		const model = await query.findOne ();
		assert.isNotNull (model);
	}
}

async function testQueryNotExists (query, ignores = []) {
	if (ignores.indexOf ('count') === -1) {
		const modelCount = await query.count ();
		assert.strictEqual (modelCount, 0);
	}

	if (ignores.indexOf ('find') === -1) {
		const models = await query.find ();
		assert.isArray (models);
		assert.lengthOf (models, 0);
	}

	if (ignores.indexOf ('sum') === -1) {
		const modelSum = await query.sum ('val');
		assert.strictEqual (modelSum, 0);
	}

	if (ignores.indexOf ('findOne') === -1) {
		const model = await query.findOne ();
		assert.isNull (model);
	}
}

async function testQuery (Model, query, testMatchEntry, testNotMatchEntries, ignores = []) {
	await Model.remove ({});

	await Promise.all (testNotMatchEntries.map (async (testEntry) => {
		await (new Model (testEntry)).save ();
	}));

	await testQueryNotExists (query, ignores);

	await (new Model (testMatchEntry)).save ();

	await testQueryExists (query, ignores);
}

async function testWhere (Model) {
	console.log ('- Testing where');
	const query = Model.where ({ a: 1 });
	await testQuery (Model, query, { val: 1, a: 1 }, [
		{ val: 1, a: 2 },
		{ val: 1, a: { x: 1 } },
		// { val: 1, a: [1] },
	]);
}

async function testDeepWhere (Model) {
	console.log ('- Testing deep where');
	const query = Model.where ({ a: { x: 1 } });
	await testQuery (Model, query, { val: 1, a: { x: 1 } }, [
		{ val: 1, a: { x: 2 } },
		// { val: 1, a: 1 },
		// { val: 1, a: [1] },
	]);
}

async function testElemVal (Model) {
	console.log ('- Testing elem val');
	const query = Model.elem ("things", 1);
	await testQuery (Model, query, { val: 1, things: [1] }, [
		{ val: 1, things: [2] },
		{ val: 1, things: [{ x: 1 }] },
		// { val: 1, things: 1 }
		// { val: 1, things: { x: 1 } }
	], ["sum"]);
}

async function testElemObj (Model) {
	console.log ('- Testing elem obj');
	const query = Model.elem ("things", { x: 1 });
	await testQuery (Model, query, { val: 1, things: [{ x: 1 }] }, [
		{ val: 1, things: [{ x: 2 }] },
		{ val: 1, a: 1 },
		{ val: 1, a: { x: 1 } },
	], ["sum"]);
}

async function testLt (Model) {
	console.log ('- Testing lt');
	const query = Model.lt ("a", 2);
	await testQuery (Model, query, { val: 1, a: 1 }, [
		{ val: 1, a: 2 },
		{ val: 1, a: 3 },
		{ val: 1, a: { x: 1 } },
		// { val: 1, a: [{ x: 1 }] },
		// { val: 1, a: [1] },
	]);
}

async function testGt (Model) {
	console.log ('- Testing gt');
	const query = Model.gt ("a", 2);
	await testQuery (Model, query, { val: 1, a: 3 }, [
		{ val: 1, a: 2 },
		{ val: 1, a: 1 },
		// { val: 1, a: { x: 1 } },
		{ val: 1, a: [{ x: 1 }] },
		{ val: 1, a: [2] },
	]);
}

async function testLte (Model) {
	console.log ('- Testing lte');
	const query = Model.lte ("a", 2);
	await testQuery (Model, query, { val: 1, a: 2 }, [
		{ val: 1, a: 3 },
		{ val: 1, a: { x: 1 } },
		// { val: 1, a: [{ x: 1 }] },
		// { val: 1, a: [2] },
	]);
}

async function testGte (Model) {
	console.log ('- Testing gte');
	const query = Model.gte ("a", 2);
	await testQuery (Model, query, { val: 1, a: 2 }, [
		{ val: 1, a: 1 },
		// { val: 1, a: { x: 1 } },
		// { val: 1, a: [{ x: 1 }] },
		// { val: 1, a: [1] },
	]);
}

async function testNe (Model) {
	console.log ('- Testing ne');
	const query = Model.ne ("a", 1);
	await testQuery (Model, query, { val: 1, a: { x: 1 } }, [
		{ val: 1, a: 1 },
	]);
}

async function test (plug) {
	const db = new Db (plug);

	class TestModel extends DbModel {}
	await db.register (TestModel);

	let foundModels = [];
	let modelCount = [];

	await testWhere (TestModel);
	await testDeepWhere (TestModel);
	await testElemVal (TestModel);
	await testElemObj (TestModel);
	await testLt (TestModel);
	await testGt (TestModel);
	await testLte (TestModel);
	await testGte (TestModel);
	await testNe (TestModel);
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
