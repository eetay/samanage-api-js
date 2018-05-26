var expect = require('expect')

SamanageAPI = require('../samanage-api.js')
var connection = new SamanageAPI.Connection(process.env.TOKEN, 'http://localhost:3000')

//SamanageAPI.debug = true
var get_incidents = SamanageAPI.get('incident')
connection.addMetadata('Users','user')

connection.Users.init()
connection.ItsmStates.init()
connection.Users.then(function(users) {
  expect(users['606133']).toHaveProperty('email')
})
Promise.all([connection.ItsmStates, connection.Users]).then(function([states, users]) {
  expect(states['25157']).toHaveProperty('itsm_type')
  expect(users['606133']).toHaveProperty('email')
})

/*
describe('help', function() {
  console.log(SamanageAPI.help)
  console.log(SamanageAPI.Filters.help)
  console.log(SamanageAPI.Connection.help)
})
*/

/*
function testAction(action, expectedOnSuccess, expectedOnFailure) {
  var unexpectedSuccess = function(obj) {
    expect('unexpectedSuccess called').toBe('not to have been called')
  }
  var unexpectedFailure = function(obj) {
    expect('unexpectedFailure called').toBe('not to have been called')
  }
  connection.callSamanageAPI(action).
    then(expectedOnSuccess || unexpectedSuccess).
    catch(expectedOnFailure || unexpectedFailure)
}

testAction(
  SamanageAPI.create('incident')({
    name: 'opened with samanage-api-js library promises'
  }),
  function(resp) {
    expect(resp).toHaveProperty('data.name', 'opened with samanage-api-js library promises')
  },
  null
)

testAction(
  SamanageAPI.update('incident')(3, {
    name:'opened with samanage-api-js library'
  }),
  null,
  function(resp) {
    expect(resp).toHaveProperty('httpStatus', 404)
  }
)

var get_incidents = SamanageAPI.get('incident')

testAction(
  get_incidents(
    new SamanageAPI.Filters().add({
      sort_order: 'ASC',
      sort_by: 'created_at',
      created: ['2018-01-01','2018-01-02']
    })
  ),
  function(resp) {
    expect(resp).toHaveProperty('data')
  },
  null
)

testAction(
  get_incidents(
    new SamanageAPI.Filters().
      sort_by('name').
      sort_order(SamanageAPI.Filters.DESC).
      between_dates('created','2018-01-01','2018-01-02').
      per_page(100).
      page(3)
  ),
  function(resp) {
    expect(resp).toHaveProperty('data')
  },
  null
)
*/
