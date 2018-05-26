var request = require('request');
var url = require('url');

var isFunction = (obj) => (!!(obj && obj.constructor && obj.call && obj.apply))
var functionProto = (name, func) => (name + func.toString().match(/\(.*\)/)[0])

function describeObject(obj) {
  var ret = []
  var consts = []
  Object.keys(obj).forEach(function(attr) {
    if (obj.hasOwnProperty(attr)) {
      if (isFunction(obj[attr])) {
        ret.push(functionProto(attr, obj[attr]))
      } else {
        consts.push(attr)
      }
    }
  })
  ret.push({constants: consts})
  return ret
}

var SamanageAPI = {
  Filters: function() {},
  validateParams: function(func, all, conds) {
    if (!SamanageAPI.debug) return
    conds.forEach(function(cond, index) {
      var type = typeof all[index]
      if (!type) throw func + ': parameter ' + index + ' is missing'
      if (!type.match(cond)) throw func + ': parameter ' + index + ' must match ' + cond
    })
  },
  get: function(object_type, scope) {
    return function(filters) {
      SamanageAPI.validateParams('get(filters)', arguments, [/object/])
      return {
        path: url.resolve(scope || '', object_type + 's.json?', filters.to_query()),
        method: request.get
      }
    }
  },
  create: function(object_type, scope) {
    return function(object) {
      SamanageAPI.validateParams('create(object)', arguments, [/object/])
      var wrapper = {}
      wrapper[object_type] = object
      return {
        path: url.resolve(scope || '', object_type +'s.json'),
        body: JSON.stringify(wrapper),
        method: request.post
      }
    }
  },
  update: function(object_type, scope) {
    return function(object_id, object) {
      SamanageAPI.validateParams('update(object_id, object)', arguments, [/string|number/, /object/])
      var wrapper = {}
      wrapper[object_type] = object
      return {
        path: url.resolve(scope || '', object_type + 's/' + object_id + '.json'),
        body: JSON.stringify(wrapper),
        method: request.put
      }
    }
  },
  Connection: function(token, origin = 'https://api.samanage.com') {
    this.connection = this
    this.origin = origin
    this.headers = {
      'X-Samanage-Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.samanage.v2.1+json'
    }
    this.addMetadata('ItsmStates','itsm_state')
  },
  debug: false,
  log: function() {
    if (SamanageAPI.debug) console.log('DEBUG', ...arguments)
  }
}

SamanageAPI.Connection.prototype = {
  addMetadata: function(object_name, rest_name) {
    this[object_name] = {
      filters: null,
      init: (filters = null) => {
        this.filters = filters
      },
      then: (after_resolve) => {
        var connection = this
        var object_name = object_name
        var filters = this.filters || new SamanageAPI.Filters()
        connection[object_name] = new Promise(function(resolve, reject) {
          connection.callSamanageAPI(
            SamanageAPI.get(rest_name)( filters )
          ).then(function({data}) {
            SamanageAPI.log('metadata result:', data)
            var obj = {}
            data.forEach(function(item) {
              obj[item.id] = item
            })
            resolve(obj)
          }).catch(
            reject
          )
        })
        this.connection[object_name].then(after_resolve)
        return this.connection[object_name]
      }
    }
  },
  callSamanageAPI: function(action, ref) {
    var connection = this
    return new Promise(function(resolve, reject) {
      var options = {
        url: url.resolve(connection.origin, action.path),
        headers: connection.headers
      }
      ref = ref || options.url
      if (action.body) options['body'] = action.body
      SamanageAPI.log('callSamanageAPI:', ref, options, action)
      action.method(options, function(error, response, body) {
        SamanageAPI.log('callSamanageAPI result:', ref, error)
        if (response && response.statusCode != 200) {
          reject({error: 'HTTP Error', httpStatus: (response && response.statusCode), info: body, ref: ref})
        } else if (error) {
          reject({error: error, ref: ref})
        } else try {
          resolve({data: JSON.parse(body), ref: ref})
        } catch(e) {
          reject({error: 'Invalid JSON response data', info: body, ref: ref, exception: e})
        }
      })
    })
  }
}



SamanageAPI.Filters.prototype = {
  DESC: false,
  ASC: true,
  add: function(filters_hash) {
    var obj = this
    Object.keys(filters_hash).forEach(function(key) {
      var value = filters_hash[key]
      if ((typeof value == 'object') && key.match(/created|updated/)){ // Date Range
        obj[key + '_custom_gte[]'] = value[0]
        obj[key + '_custom_lte[]'] = value[1]
      } else {
        obj[key] = value
      }
    })
    return this
  },
  between_dates: function(column, date1, date2) {
    this[column + '_custom_gte[]'] = date1
    this[column + '_custom_lte[]'] = date2
    return this
  },
  sort_by: function(column) {
    this['sort_by'] = column
    return this
  },
  sort_order: function(order) {
    this['sort_order'] = (order?'ASC':'DESC')
    return this
  },
  page: function(page) {
    this['page'] = page
    return this
  },
  per_page: function(per_page) {
    this['per_page'] = per_page
    return this
  },
  to_query: function() {
    var obj = this
    return Object.keys(obj).map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key])
    }).join('&')
  }
}

SamanageAPI.help = describeObject(SamanageAPI)
SamanageAPI.Connection.help = describeObject(SamanageAPI.Connection.prototype)
SamanageAPI.Filters.help = describeObject(SamanageAPI.Filters.prototype)

module.exports = SamanageAPI

