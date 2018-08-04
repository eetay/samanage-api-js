var cross_fetch = require('cross-fetch')
var urlx = require('url')
var path = require('path')
var promiseRetry = require('promise-retry')

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
      per_page: response_headers.get('x-per-page'),
      current_page: response_headers.get('x-current-page'),
      total_count: response_headers.get('x-total-count'),
      total_pages: response_headers.get('x-total-pages')
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
  export: function(object_type, scope) {
    var action = function(filters) {
      SamanageAPI.validateParams('get(filters)', arguments, [/object/])
      return {
        object_type: object_type,
        scope: scope,
        path: path.join(scope || '', object_type + 's.csv?export=true&format=csv&') + filters.to_query(),
        method: 'GET',
        responseHandler: ()=>[]
      }
    }
    action.log = SamanageAPI.log
    action.object_type = object_type
    action.scope = scope
    return action
  },
  get: function(object_type, scope) {
    var action = function(filters) {
      SamanageAPI.validateParams('get(filters)', arguments, [/object/])
      return {
        object_type: object_type,
        scope: scope,
        path: path.join(scope || '', object_type + 's.json?') + filters.to_query(),
        method: 'GET'
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
        method: 'POST'
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
        method: 'PUT'
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
      //'Accept': 'application/vnd.samanage.v2.1+json'
      'Accept': '*/*'
    }
    this.valid_request_opts = ['timeout', 'mode', 'cache', 'credentials', 'referrer', 'follow', 'agent']
    this.request_opts = {
    }
    this.retry_codes = [408, 409, 429, 503, 504]
    this.retry_opts = {
      retries: 2,
      factor: 2,
      minTimeout: 1 * 1000,
      maxTimeout: 60 * 100,
      randomize: false
    }
  },
  debug: false,
  log: function() {
    // eslint-disable-next-line no-console
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
  var transaction_ref = 'GETTER REQ:' + connection.origin + '/' + state.action(current_filters).path
  if (data.length > 0) {
    log(transaction_ref + ': recieved ' + data.length + ' new items')
    data.forEach(function(item) {
      state.data[item.id] = item
    })
    var next_page_filters = current_filters.clone().next_page()
    state.filters = next_page_filters
    if (pagination_info.total_pages >= next_page_filters.attrs.page) {
      log(transaction_ref + ': next page:' + next_page_filters.attrs.page)
      connection.callSamanageAPI(state.action(next_page_filters), state).then(
        getterAddData
      ).catch(function (err) {
        log(transaction_ref + ': REJECTED: ' + err)
        state.reject(err)
      })
    }
    else {
      log(transaction_ref + ': RESOLVED (no pagination)')
      state.resolve(state.data)
    }
  }
  else {
    log(transaction_ref + ': RESOLVED (empty page)')
    state.resolve(state.data)
  }
}

Object.assign(SamanageAPI.Connection, {
  HTTP_ERROR: 'HTTP Error',
  NON_HTTP_ERROR: 'Non HTTP Error',
  GET_BODY_ERROR: 'Error getting response body',
  INVALID_JSON: 'Invalid JSON response data'
})

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
      connection.callSamanageAPI(action, state).then(getterAddData).catch(rej)
    })
    return promise
  },
  callSamanageAPI: function(request, ref, retry_opts) {
    var connection = this
    var retry_setup = (retry_opts || request.retry_opts || connection.retry_opts)
    return promiseRetry(
      function (retry, number) {
        //console.log('attempt number', number);
        return connection.singleSamanageAPI(request, ref).catch(function(err) {
          //console.log(err, connection.retry_codes)
          err.attempts = number
          if ((err.error == SamanageAPI.Connection.HTTP_ERROR) && connection.retry_codes.includes(err.httpStatus) && retry(err)) return
          throw err
        })
      },
      retry_setup
    )
  },
  processResponse: function(request, response, resolve, reject, ref) {
    var log = request.log || SamanageAPI.log
    response.text().then(function(body) {
      try {
        log('callSamanageAPI ok:', {ref: ref, body: body.substring(0,100), headers: response.headers})
        resolve({
          data: (request.responseHandler || JSON.parse)(body),
          ref: ref,
          pagination_info: SamanageAPI.getPaginationInfo(response.headers)
        })
      } catch(e) {
        log('callSamanageAPI exception:', ref, e)
        reject({
          error: SamanageAPI.Connection.INVALID_JSON,
          info: body,
          ref: ref,
          exception: e
        })
      }
    }).catch(function(error) {
      log('callSamanageAPI error:', ref, error)
      reject({
        error: SamanageAPI.Connection.GET_BODY_ERROR,
        info: error,
        ref: ref
      })
    }) // response.text().then(...).catch(...)
  },
  singleSamanageAPI: function(request, ref) {
    var connection = this
    var log = request.log || SamanageAPI.log
    return new Promise(function(resolve, reject) {
      var options = {
        redirect: 'follow',
        headers: connection.headers,
        method: request.method
      }
      var url=urlx.resolve(connection.origin, request.path)
      connection.valid_request_opts.forEach((opt) => {
        if (typeof connection.request_opts[opt] !== "undefined") {
          options[opt] = connection.request_opts[opt]
        }
      })
      ref = ref || url
      if (request.body) options['body'] = request.body
      log('callSamanageAPI:', { ref: ref, options: options, request: request })
      cross_fetch(url, options).then(function(response) {
        if ((response.status < 200) || (response.status >= 300)) {
          log('callSamanageAPI HTTP error:', ref, response.status)
          reject({
            error: SamanageAPI.Connection.HTTP_ERROR,
            httpStatus: response.status,
            info: response.statusText,
            ref: ref
          })
        } else {
          connection.processResponse(request, response, resolve, reject, ref)
        }
      }).catch(function (error) {
        log('callSamanageAPI error:', ref, error)
        reject({
          error: SamanageAPI.Connection.NON_HTTP_ERROR,
          info: error,
          ref: ref
        })
      }) // fetch.then(...).catch(...)
    }) // new Promise(...)
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

