SamanageAPI = require('../index.js')

function spy(obj_name, obj) {
  console.log('SPY:' + obj_name, obj)
  return obj
}

SamanageAPI.callSamanageAPI(
  spy('CONNECTION', SamanageAPI.connection(process.env.TOKEN)),
  SamanageAPI.create('incident')({name:'opened with samanage-api-js library'}),
  function(){console.log('SUCCESS', arguments)},
  function(){console.log('ERROR', arguments)}
)


