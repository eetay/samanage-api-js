jest.setTimeout(120000)
function log() {
  //console.log('DEBUG', ...arguments)
}
process.on('unhandledRejection', function(error, promise) {
  console.error('UNHANDLED REJECTION - Promise: ', promise, ', Error: ', error, ').');
});
var SamanageAPI = require('../samanage-api.js')
if (typeof process.env.TOKEN == 'undefined') throw 'Error: for tests api token must be set using "export TOKEN=" shell command to account #5 in production'

var connection = new SamanageAPI.Connection(process.env.TOKEN, 'https://api.samanage.com')

var get_incidents = SamanageAPI.get('incident')
var export_incidents = SamanageAPI.export('incident')

/*
var Incidents = connection.getter('incident', (new SamanageAPI.Filters()).page(50).per_page(100), undefined, console.log)
Incidents.then(function (incidents) {
  console.log('DONE!!!!:', Object.keys(incidents).length)
})
*/
test('Export incidents created between dates', ()=>{
  return connection.callSamanageAPI(
    export_incidents(
      new SamanageAPI.Filters().between_dates('created','2017-01-01','2018-07-07').add({http_integration: 13174}).per_page(25)
    )
  ).then(function(data) {
    expect(data).toEqual(
      expect.objectContaining({
        'pagination_info': expect.objectContaining({
          per_page: '25'
        }),
        'ref': expect.stringContaining('export=true'),
        'data': []
      })
    )
  })
})
test('Incident getter by title with comments getter', () => {
  expect.assertions(1)
  var Incidents = connection.getter('incident', (new SamanageAPI.Filters()).title('*new*'))
  Incidents.then(function (incidents) {
    var incident = incidents[Object.keys(incidents)[0]]
    expect(incident).toEqual(expect.objectContaining({name: expect.stringContaining('new')}))
    log(incident)
    expect.assertions(1)
    var Comments = connection.getter('comment', (new SamanageAPI.Filters()), 'incidents/' + incident.id)
    Comments.then(function(comments) {
      var bodies = Object.keys(comments).map(x=>(comments[x].body))
      expect(bodies.length).toEqual(2)
      log(bodies)
    })
  })
  return Incidents
})

test('Users getter', () => {
  //expect.assertions(1)
  var Users = connection.getter('user', (new SamanageAPI.Filters()).page(1))
  Users.then(function(users) {
    var emails = Object.keys(users).map(x=>(users[x].email))
    expect(users['3024324']).toHaveProperty('email', 'eetay.natan+qualys@samanage.com')
    log(emails)
  })
  return Users
})

test('Users & States', () => {
  var ItsmStates = connection.getter('itsm_state')
  var Users = connection.getter('user', (new SamanageAPI.Filters()).page(1))
  return Promise.all([ItsmStates, Users]).then(function([states, users]) {
    var states_array = Object.keys(states).map((x)=>states[x])
    expect(states_array).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          'value': 'Awaiting Input',
          'original_key': 'Awaiting_Input',
          'itsm_type': 'Incident'
        })
      ])
    )
    expect(users['761231']).toHaveProperty('email', 'bkim@qualys.com')
  })
})

test('create Incident', ()=>{
  const name = 'opened with samanage-api-js library promises ' + Date.now()
  return expect(connection.callSamanageAPI(
    SamanageAPI.create('incident')({ name: name })
  )).resolves.toHaveProperty('data.name', name)
})

var prev_test
test('Incident which does not exist return 404 without retries', ()=>{
  return expect(prev_test = connection.callSamanageAPI(
    SamanageAPI.update('incident')(3, {
      name:'opened with samanage-api-js library'
    })
  )).rejects.toEqual(
    expect.objectContaining({
      error: SamanageAPI.Connection.HTTP_ERROR,
      httpStatus: 404,
      attempts: 1
    })
  )
})

test('Failed request with retryable codes', async ()=>{
  try { await prev_test } catch(e) {} // wait for previous test
  connection.retry_codes=[404]
  var request = SamanageAPI.update('incident')(3, {
    name:'opened with samanage-api-js library'
  })
  request.retry_opts = {
    retries: 2,
    factor: 2,
    minTimeout: 1 * 100,
    maxTimeout: 60 * 100,
    randomize: true
  }
  const codes = connection.retry_codes
  result = expect(connection.callSamanageAPI(request, 'ref')).rejects.toEqual(
    expect.objectContaining({
      error: SamanageAPI.Connection.HTTP_ERROR,
      httpStatus: 404,
      attempts: 3
    })
  )
  return result
})

test('Export incidents created between dates', ()=>{
  return connection.callSamanageAPI(
    export_incidents(
      new SamanageAPI.Filters().between_dates('created','2017-01-01','2018-07-07')
    )
  ).then(function(data) {
    expect(data).toEqual(
      expect.objectContaining({
        'pagination_info': expect.objectContaining({
          per_page: '25',
          current_page: '1'
        }),
        'ref': expect.stringContaining('export=true'),
        'data': []
      })
    )
  })
})

test('Get incidents created between dates', ()=>{
  return expect(connection.callSamanageAPI(
    get_incidents(
      new SamanageAPI.Filters().add({
        sort_order: 'ASC',
        sort_by: 'created_at',
        created: ['2018-01-01','2018-01-02']
      })
    )
  )).resolves.toHaveProperty('data')
})

test('Get incidents created between dates with pagination', ()=>{
  return connection.callSamanageAPI(
    get_incidents(
      new SamanageAPI.Filters().
        sort_by('name').
        sort_order(SamanageAPI.Filters.DESC).
        between_dates('created','2017-01-01','2018-07-07').
        per_page(25).
        page(1)
    ),
    'REF5'
  ).then(function(data) {
    log(data)
    expect(data).toEqual(
      expect.objectContaining({
        'ref': 'REF5',
        'data': expect.arrayContaining([
          expect.objectContaining({'id':expect.anything()})
         ])
      })
    )
  })
})

test('Generated help', function() {
  [SamanageAPI, SamanageAPI.Filters, SamanageAPI.Connection].forEach(function(obj) {
    expect(typeof obj.help).toBe('object')
  })
  expect(SamanageAPI.Connection.help).toEqual(expect.arrayContaining([expect.stringContaining('callSamanageAPI(request, ref, retry_opts)')]))
})

