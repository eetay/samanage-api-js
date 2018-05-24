var request = require('request');

var SamanageAPI = {
  create: function (object_type) {
    return function (object) {
      var wrapper = {}
      wrapper[object_type] = object
      return {
        path: '/' + object_type +'s.json',
        body: JSON.stringify(wrapper),
        method: request.post
      }
    }
  },
  update: function (object_type) {
    return function (object_id, object) {
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
      body: action.body,
      headers: connection.headers
    }
    console.log('callSamanageAPI:', options)
    action.method(options, function (error, response, body) {
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
  }
}

module.exports = SamanageAPI

