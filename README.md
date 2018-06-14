# samanage-api

<script src="https://embed.runkit.com" data-element-id="my-element"></script>

<!-- anywhere else on your page -->
<div id="my-element">// GeoJSON!
var getJSON = require("async-get-json");

await getJSON("https://storage.googleapis.com/maps-devrel/google.json");</div>


This is my personal helper code for performing API calls to Samanage Helpdesk Service. The code is provided as-is, without any warrenty.
It is a work in progress and may not support all the options offered by the Samanage API
Feel free to contact me with requests, issues or questions.

## Installation
```sh
npm install samanage-api
```

## Initialize
```javascrip
var SamanageAPI = require('samanage-api')
var connection = new SamanageAPI.Connection(process.env.TOKEN)
```

## Making a call
```javascrip
var success = function(data) {...}
var failure = function(error) {...}
var request = ...  
connection.callSamanageAPI(request).then(success).catch(failure)
```

## Retrieval with filters
```javascript
var get_incidents = SamanageAPI.get('incident')
var request = get_incidents(
  new SamanageAPI.Filters().add({
    sort_order: 'ASC',
    sort_by: 'created_at',
    created: ['2018-01-01','2018-01-02']
  })
)
connection.callSamanageAPI(...)
```

### Building filters
```javascript
var get_incidents = SamanageAPI.get('incident')
var filters = new SamanageAPI.Filters().
  sort_by('name').
  sort_order(SamanageAPI.Filter.DESC).
  between_dates('created','2018-01-01','2018-01-02').
  per_page(100).
  page(3)
var request = get_incidents(filters)
```

## Update
```javascript
var request = SamanageAPI.update('incident')(3, {
  name:'opened with samanage-api-js library'
})
```

## Create
```javascript
var request = SamanageAPI.create('incident')({
  name:'opened with samanage-api-js library'
})
```

## help

```javascript
console.log(SamanageAPI.help)
console.log(SamanageAPI.Filters.help)
console.log(SamanageAPI.ItsmStates.help)
console.log(SamanageAPI.Connection.help)
```

### define getter objects
getter objects are promises to get all items of certain type
be careful not to try retrieving too many items; currently there's no check on
number of items which will cause long retrieval process

```javascript
var users_filter = new SamanageAPI.Filter()
var users = connection.getter('user', users_filter)

var itsm_states = connection.getter('itsm_state')
```

### do something when users and itsm states are both available
```javascript
Promise.all([itsm_states, users]).then(
  function([states, users]) {...}
)
```



## Migrating from 1.x to 2.x
Changes in version 2.0
- works with promises
- conenction is now instantiated (you can open connections to multiple accounts or mulitple users in same account)
- support for ItsmStates

```javascript
var connection = new SamanageAPI.connection(process.env.TOKEN)
SamanageAPI.callSamanageAPI(connection, request, success, failure)
```
=>
```javascript
var connection = new SamanageAPI.Connection(process.env.TOKEN)
connection.callSamanageAPI(request).then(success).catch(failure)
```
