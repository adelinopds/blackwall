var async = require('async');
var _ = require('lodash');

function APPEND_QUERY(context, query) {
	return _.merge(context, query);
}

function FLATTEN_OBJECT(object, parent) {
	/*
		Flattens Object with key reference to produce
		a single Object capable of GET,SET through
		Lodash methods _.get , _.set , _.has
		This allows simpler storage of complex nested
		objects while maintaining the ability to
		reproduce the original Object path through
		String.split('.') method
	*/
	var store = {};
	_.each(object, function(value, key) {
		if(!_.isPlainObject(value)) {
			store[(_.isString(parent))?parent+'.'+key:key] = value;	
		}else {
			_.merge(store, FLATTEN_OBJECT(value, (_.isString(parent))?parent+'.'+key:key));
		}
	})
	return store;
}

var BLOCSTORE = function BLACKWALL_BLOCSTORE(handler) {
	// Require a handler
	if(!handler) throw new Error("No Storage Handler was passed");
	// Attach Get/Set functions to instance
	this.getterFunction = handler.get;
	this.setterFunction = handler.set;
}

BLOCSTORE.prototype.isolate = function BLACKWALL_BLOCSTORE_ISOLATE(group, name) {
	// Changes scope by prepending to key
	return APPEND_QUERY(this, {
		prepend: '_isolate_' + (group)?group+'_':'' + (group && name)?name:''
	})
}

BLOCSTORE.prototype.limit = function BLACKWALL_BLOCSTORE_LIMIT(limit) {
	return APPEND_QUERY(this, { l: limit });
}

BLOCSTORE.prototype.get = function BLACKWALL_BLOCSTORE_GET(key, callback) {
	if(!_.isFunction(callback)) {
		return APPEND_QUERY(this, {
			method: 'get',
			key: key
		});
	}else{
		this.exec.apply(APPEND_QUERY(this, {
			method: 'get',
			key: key
		}), [callback]);
	}
}

BLOCSTORE.prototype.set = function BLACKWALL_BLOCSTORE_SET(key, value, callback) {
	if(!_.isFunction(callback)) {
		return APPEND_QUERY(this, {
			method: 'set',
			key: (this.prepend)?this.prepend+key:key,
			value: value
		});
	}else{
		this.exec.apply(APPEND_QUERY(this, {
			method: 'set',
			key: (this.prepend)?this.prepend+key:key,
			value: value
		}), [callback]);
	}
}

BLOCSTORE.prototype.exec = function BLACKWALL_BLOCSTORE_EXEC(callback) {
	var _this = this;
	
	if(!this.key) return callback(new Error("Key is undefined"));
	if(!this.method) return callback(new Error("Method is undefined"));
	if(!this.getterFunction || !this.setterFunction) return callback(new Error("Merge was unsuccessful"));
	
	if(this.method === 'get') {
		this.getterFunction(_.pick(this, ['key', 'limit']), callback);
	}else if(this.method === 'set') {
		// If value is an Object break it into parts
		// Otherwise just pass the value
		if(_.isObject(this.value)) {
			// New ParallelExecutionArray
			var ParallelQueryArray = [];
			_.each(FLATTEN_OBJECT(this.value), function(ITEM, KEY) {
				ParallelQueryArray.push(function(callback){
					_this.setterFunction({
						key: KEY,
						value: ITEM
					}, callback);
				})
			})
			async.parallel(ParallelQueryArray, callback);
		}else{
			this.setterFunction(_.pick(this, ['key', 'value']), callback);	
		}
	}else{
		callback(new Error("Method not found!"));
	}
}

module.exports = BLOCSTORE;