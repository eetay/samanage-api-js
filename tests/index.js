SamanageAPI = require('../samanage-api.js')

function spy(obj_name, obj) {
  console.log('SPY:' + obj_name, obj)
  return obj
}

connection = SamanageAPI.connection(process.env.TOKEN)

success = function(){console.log('SUCCESS', arguments)}
failure = function(){console.log('ERROR', arguments)}

test(
  SamanageAPI.create('incident')({
    name:'opened with samanage-api-js library'
  })
)

test(
  SamanageAPI.update('incident')(3, {
    name:'opened with samanage-api-js library'
  })
)

var get_incidents = SamanageAPI.get('incident')

function test(expr) {
  console.log(arguments)
  // SamanageAPI.callSamanageAPI(
  //   connection,
  //   expr,
  //   success, failure
  // )
}

test(
  get_incidents(
    new SamanageAPI.Filters().add({
      sort_order: 'ASC',
      sort_by: 'created_at',
      created: ['2018-01-01','2018-01-02']
    })
  )
)

test(
  get_incidents(
    new SamanageAPI.Filters().
      sort_by('name').
      sort_order(false).
      between_dates('created','2018-01-01','2018-01-02')
  )
)

