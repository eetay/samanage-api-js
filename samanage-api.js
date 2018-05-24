var request = require('request');

var SamanageAPI = {
  Filters: function() {},
  validate_params: function(func, all, conds) {
    if (!SamanageAPI.debug) return
    conds.forEach(function(cond, index) {
      var type = typeof all[index]
      console.log(type, conds, all)
      if (!type) throw func + ': parameter ' + index + ' is missing'
      if (!type.match(cond)) throw func + ': parameter ' + index + ' must match ' + cond
    })
  },
  get: function(object_type) {
    return function(filters) {
      SamanageAPI.validate_params('get(filters)', arguments, [/object/])
      return {
        path: '/' + object_type + 's.json?' + filters.to_query(),
        method: request.get
      }
    }
  },
  create: function(object_type) {
    return function(object) {
      SamanageAPI.validate_params('create(object)', arguments, [/object/])
      var wrapper = {}
      wrapper[object_type] = object
      return {
        path: '/' + object_type +'s.json',
        body: JSON.stringify(wrapper),
        method: request.post
      }
    }
  },
  update: function(object_type) {
    return function(object_id, object) {
      SamanageAPI.validate_params('update(object_id, object)', arguments, [/string|integer/, /object/])
      var wrapper = {}
      wrapper[object_type] = object
      return {
        path: '/' + object_type + 's/' + object_id + '.json',
        body: JSON.stringify(wrapper),
        method: request.put
      }
    }
  },
  connection: function(token, origin = 'https://api.samanage.com') {
    return {
      origin: origin,
      headers: {
        'X-Samanage-Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.samanage.v2.1+json'
      }
    }
  },
  callSamanageAPI: function(connection, action, onSuccess, onFailure) {
    var options = {
      url: connection.origin + '/' + action.path,
      headers: connection.headers
    }
    if (action.body) options['body'] = action.body
    SamanageAPI.log('callSamanageAPI:', options)
    action.method(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        try {
          onSuccess(JSON.parse(body))
        } catch(e) {
          onFailure({error: 'Invalid response data', info: body})
        }
      }
      else {
        onFailure({error: error, httpStatus: (response && response.statusCode), info: error || body})
      }
    })
  },
  debug: true,
  log: function() {
    if (SamanageAPI.debug) console.log('DEBUG', arguments)
  }
}

SamanageAPI.Filters.prototype = {
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

module.exports = SamanageAPI

