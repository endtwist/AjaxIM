// Storage API
var store = (function(){
	var api = {},
		win = window,
		doc = win.document,
		sessionStorageName = 'sessionStorage',
		localStorageName = 'localStorage',
		globalStorageName = 'globalStorage',
		storage

	api.set = function(key, value) {}
	api.get = function(key) {}
	api.remove = function(key) {}
	api.clear = function() {}

	function serialize(value) {
		return JSON.stringify(value)
	}
	function deserialize(value) {
		if (typeof value != 'string') { return undefined }
		return JSON.parse(value)
	}

	if (sessionStorageName in win && win[sessionStorageName]) {
		storage = win[sessionStorageName]
		api.set = function(key, val) { storage[key] = serialize(val) }
		api.get = function(key) { return deserialize(storage[key]) }
		api.remove = function(key) { delete storage[key] }
		api.clear = function() { storage.clear() }

	} else if (localStorageName in win && win[localStorageName]) {
		storage = win[localStorageName]
		api.set = function(key, val) { storage[key] = serialize(val) }
		api.get = function(key) { return deserialize(storage[key]) }
		api.remove = function(key) { delete storage[key] }
		api.clear = function() { storage.clear() }

	} else if (globalStorageName in win && win[globalStorageName]) {
		storage = win[globalStorageName][win.location.hostname]
		api.set = function(key, val) { storage[key] = serialize(val) }
		api.get = function(key) { return deserialize(storage[key] && storage[key].value) }
		api.remove = function(key) { delete storage[key] }
		api.clear = function() { for (var key in storage ) { delete storage[key] } }

	} else if (doc.documentElement.addBehavior) {
		function getStorage() {
			if (storage) { return storage; }
			storage = doc.body.appendChild(doc.createElement('div'))
			storage.style.display = 'none'
			// See http://msdn.microsoft.com/en-us/library/ms531081(v=VS.85).aspx
			// and http://msdn.microsoft.com/en-us/library/ms531424(v=VS.85).aspx
			storage.addBehavior('#default#userData')
			storage.load(localStorageName)
			return storage;
		}
		api.set = function(key, val) {
			var storage = getStorage()
			storage.setAttribute(key, serialize(val))
			storage.save(localStorageName)
		}
		api.get = function(key) {
			var storage = getStorage()
			return deserialize(storage.getAttribute(key))
		}
		api.remove = function(key) {
			var storage = getStorage()
			storage.removeAttribute(key)
			storage.save(localStorageName)
		}
		api.clear = function() {
			var storage = getStorage()
			var attributes = storage.XMLDocument.documentElement.attributes;
			storage.load(localStorageName)
			for (var i=0, attr; attr = attributes[i]; i++) {
				storage.removeAttribute(attr.name)
			}
			storage.save(localStorageName)
		}
	}

	return api
})();
