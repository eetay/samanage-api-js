var request = require('request')
var urlx = require('url')
var path = require('path')

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
  if (consts.length > 0) ret.push({constants: consts})
  return ret
}

var SamanageAPI = {
  getPaginationInfo: function (response_headers) {
    return {
      per_page: response_headers['x-per-page'],
      current_page: response_headers['x-current-page'],
      total_count: response_headers['x-total-count'],
      total_pages: response_headers['x-total-pages']
    }
  },
  Filters: function() { this.attrs={} },
  validateParams: function(func, all, conds) {
    if (!SamanageAPI.debug) return
    conds.forEach(function(cond, index) {
      var type = typeof all[index]
      if (!type) throw func + ': parameter ' + index + ' is missing'
      if (!type.match(cond)) throw func + ': parameter ' + index + ' must match ' + cond
    })
  },
  get: function(object_type, scope) {
    var action = function(filters) {
      SamanageAPI.validateParams('get(filters)', arguments, [/object/])
      return {
        object_type: object_type,
        scope: scope,
        path: path.join(scope || '', object_type + 's.json?') + filters.to_query(),
        method: request.get
      }
    }
    action.log = SamanageAPI.log
    action.object_type = object_type
    action.scope = scope
    return action
  },
  create: function(object_type, scope) {
    var action = function(object) {
      SamanageAPI.validateParams('create(object)', arguments, [/object/])
      var wrapper = {}
      wrapper[object_type] = object
      return {
        object_type: object_type,
        scope: scope,
        path: path.join(scope || '', object_type +'s.json'),
        body: JSON.stringify(wrapper),
        method: request.post
      }
    }
    action.log = SamanageAPI.log
    action.object_type = object_type
    action.scope = scope
    return action
  },
  update: function(object_type, scope) {
    var action = function(object_id, object) {
      SamanageAPI.validateParams('update(object_id, object)', arguments, [/string|number/, /object/])
      var wrapper = {}
      wrapper[object_type] = object
      return {
        object_type: object_type,
        scope: scope,
        path: path.join(scope || '', object_type + 's/' + object_id + '.json'),
        body: JSON.stringify(wrapper),
        method: request.put
      }
    }
    action.log = SamanageAPI.log
    action.object_type = object_type
    action.scope = scope
    return action
  },
  Connection: function(token, origin = 'https://api.samanage.com') {
    if (!(origin && origin.match(/^https|localhost/))) throw "origin must start with 'https://'"
    this.debug = false
    this.connection = this
    this.origin = origin
    this.headers = {
      'X-Samanage-Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.samanage.v2.1+json'
    }
  },
  debug: false,
  log: function() {
    if (SamanageAPI.debug) console.log('DEBUG', ...arguments)
  }
}

function getterAddData({data, ref, pagination_info}) {
  var state = ref
  //console.log('add_data: ', data, 'state: ', state)
  var connection = state.connection
  var log = state.log
  var filters = state.filters
  var current_filters = filters ? filters.clone() : new SamanageAPI.Filters()
  var ref = 'ADD_DATA_URL:' + connection.origin + '/' + state.action(current_filters).path
  if (data.length > 0) {
    log(ref + ': recieved ' + data.length + ' new items')
    data.forEach(function(item) {
      state.data[item.id] = item
    })
    var next_page_filters = current_filters.clone().next_page()
    state.filters = next_page_filters
    if (pagination_info.total_pages >= next_page_filters.attrs.page) {
      log(ref + ': next page:' + next_page_filters.attrs.page)
      connection.callSamanageAPI(state.action(next_page_filters), state).then(
        getterAddData
      ).catch(function (err) {
        log(ref + ': REJECTED: ' + err)
        state.reject(err)
      })
    }
    else {
      log(ref + ': RESOLVED (no pagination)')
      state.resolve(state.data)
    }
  }
  else {
    log(ref + ': RESOLVED (empty page)')
    state.resolve(state.data)
  }
}

SamanageAPI.Connection.prototype = {
  getter: function(object_type, filters, scope, getter_log) {
    var connection = this
    var promise = new Promise(function(res, rej) {
      var state = {
        data: {},
        action: SamanageAPI.get(object_type, scope),
        filters: filters,
        connection: connection,
        resolve: res,
        reject: rej
      }
      var action = state.action(filters || new SamanageAPI.Filters())
      state.log = getter_log || SamanageAPI.log
      connection.callSamanageAPI(action, state).then(getterAddData)
    })
    return promise
  },
  callSamanageAPI: function(action, ref) {
    var connection = this
    var log = action.log || SamanageAPI.log
    return new Promise(function(resolve, reject) {
      var options = {
        followAllRedirects: true,
        url: urlx.resolve(connection.origin, action.path),
        headers: connection.headers
      }
      ref = ref || options.url
      if (action.body) options['body'] = action.body
      log('callSamanageAPI:', { ref: ref, options: options, action: action })
      action.method(options, function(error, response, body) {
        if (response && response.statusCode != 200) {
          log('callSamanageAPI HTTP error:', ref, response.statusCode)
          reject({error: 'HTTP Error', httpStatus: (response && response.statusCode), info: body, ref: ref})
        } else if (error) {
          log('callSamanageAPI error:', ref, error)
          reject({error: error, ref: ref})
        } else try {
          log('callSamanageAPI ok:', {ref: ref, body: body.substring(0,100), headers: response.headers})
          var pagination_info = SamanageAPI.getPaginationInfo(response.headers)
          resolve({data: JSON.parse(body), ref: ref, pagination_info: pagination_info})
        } catch(e) {
          log('callSamanageAPI exception:', ref, e)
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
    var obj = this.attrs
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
    this.attrs[column + '_custom_gte[]'] = date1
    this.attrs[column + '_custom_lte[]'] = date2
    return this
  },
  sort_by: function(column) {
    this.attrs['sort_by'] = column
    return this
  },
  sort_order: function(order) {
    this.attrs['sort_order'] = (order?'ASC':'DESC')
    return this
  },
  page: function(page) {
    this.attrs['page'] = page
    return this
  },
  next_page: function() {
    this.attrs['page'] = (this.attrs['page'] || 1) + 1
    return this
  },
  per_page: function(per_page) {
    this.attrs['per_page'] = per_page
    return this
  },
  department: function(department_id) {
    this.attrs['department'] = department_id
    return this
  },
  title: function(title) {
    this.attrs['title'] = title
    return this
  },
  to_query: function() {
    var obj = this.attrs
    return Object.keys(obj).map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key])
    }).join('&')
  },
  clone: function() {
    var obj = new SamanageAPI.Filters()
    Object.assign(obj.attrs, this.attrs)
    return obj
  }
}

SamanageAPI.help = describeObject(SamanageAPI)
SamanageAPI.Connection.help = describeObject(SamanageAPI.Connection.prototype)
SamanageAPI.Filters.help = describeObject(SamanageAPI.Filters.prototype)

module.exports = SamanageAPI

