SamanageAPI = require('../samanage-api.js')

function spy(obj_name, obj) {
  console.log('SPY:' + obj_name, obj)
  return obj
}

connection = SamanageAPI.connection(process.env.TOKEN)

success = function() { console.log('SUCCESS') }
failure = function() { console.log('ERROR', arguments[0]) }

function match(expected) {
  return function(response) {
    if (!expected) return
    var filtered_response = {}
    Object.keys(expected).forEach(function(key) {
      filtered_response[key] = response[key]
    })
    ok = (JSON.stringify(expected) == JSON.stringify(filtered_response))
    if (ok) console.log('TEST PASSED')
    else console.log(
      'EXPECTED:',
      JSON.stringify(expected),
      'RECEIVED:',
      JSON.stringify(response)
    )
  }
}

function test(expr, expectedSuccess, expectedError) {
  //console.log(arguments)
  SamanageAPI.callSamanageAPI(
    connection,
    expr,
    match(expectedSuccess), match(expectedError)
  )
}


test(
  SamanageAPI.create('incident')({
    name:'opened with samanage-api-js library'
  }),
  {name:'opened with samanage-api-js library'},
  null
)

test(
  SamanageAPI.update('incident')(3, {
    name:'opened with samanage-api-js library'
  }),
  null,
  {httpStatus: 404}
)

var get_incidents = SamanageAPI.get('incident')

console.log(SamanageAPI.help)
console.log(SamanageAPI.Filters.help)

test(
  get_incidents(
    new SamanageAPI.Filters().add({
      sort_order: 'ASC',
      sort_by: 'created_at',
      created: ['2018-01-01','2018-01-02']
    })
  ),
  {},
  null
)

test(
  get_incidents(
    new SamanageAPI.Filters().
      sort_by('name').
      sort_order(SamanageAPI.Filters.DESC).
      between_dates('created','2018-01-01','2018-01-02').
      per_page(100).
      page(3)
  ),
  {},
  null
)

