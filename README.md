# samanage-api

This is my personal API library for performing calls to [The Samanage Service Platform](https://www.samanage.com/service-desk/). The code is provided as-is, without any warrenty.
It is a work in progress and may not support all the options offered by the Samanage API
Feel free to contact me with requests, issues or questions.

samanage-api code is reviewed with [![Codacy Badge](https://api.codacy.com/project/badge/Grade/b37abcd47e7a4753811ab872e644211a)](https://www.codacy.com/app/eetay/samanage-api-js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=eetay/samanage-api-js&amp;utm_campaign=Badge_Grade)
and unit tested with <img src="./spec/jest.png" alt="Jest" width="32px"/>

[Try it](https://npm.runkit.com/samanage-api)

## Installation
```bash
npm install samanage-api
```

## Initialize
You will need a Samanage API token.  [How to get a token](https://community.samanage.com/docs/DOC-1459-encrypted-tokens-authentication-for-api-integration-overview)

```javascript
var SamanageAPI = require('samanage-api')
var connection = new SamanageAPI.Connection("your-token-here")
```

## Making a call
```javascript
var success = function({data, ref, pagination_info}) {...}
var failure = function({error, info, httpStatus, ref}) {...}
var request = ... // see below different requests
connection.callSamanageAPI(request).then(success).catch(failure)
```

### Setting value for 'ref'
The 'ref' attribute in the success and failure callbacks can be set during the
call itself, like so:

```javascript
var my_ref = 'whatever custom information. can also be of any type'
connection.callSamanageAPI(request, my_ref).then(success).catch(failure)
```

### Retries
Retries are supported out of the box for certain HTTP codes which are retryable

you can configure the retry logic

```javascript
var OPTS = { // see 'retry' npm module for full documentation
  retries: 3,
  factor: 2,
  minTimeout: 1 * 100,
  maxTimeout: 60 * 100,
  randomize: true,
}

// For all requests on a specific connection
connection.retry_opts = OPTS
connection.callSamanageAPI(request, ref).then(...).catch(...)

// For a particular request
request.retry_opts = OPTS 
connection.callSamanageAPI(request, ref).then(...).catch(...)
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

## List of all functions and constants

SamanageAPI has built in help.
Open a new node console, and execute this:

```javascript
var SamanageAPI = require('samanage-api')
console.log(SamanageAPI.help)
console.log(SamanageAPI.Filters.help)
console.log(SamanageAPI.Connection.help)
```

## Getter objects
Getter objects are promises to get all items of certain type that match a specific `SamanageAPI.Filter`.
Getters are very convenient way of retrieving things like Itsm States or Users,
but may not be proper strategy for retrieving very large sets of items
(e.g. all audit logs since start of time);
Currently there's no check on number of items which will cause a very long retrieval process so just go ahead and experiment

Getters are defined like this:

```javascript
// promise to get all ITSM states:
var itsm_states = connection.getter('itsm_state')

// promise to get all users created between certain dates
var users_filter = (new SamanageAPI.Filter()).between_dates('created','2017-01-01','2018-07-07')
var users = connection.getter('user', users_filter)

// promise to get all comments of particular incident
var comments = connection.getter('comment', (new SamanageAPI.Filters()), 'incidents/' + incident.id)
```

Example: Do something after both users and itsm states are retrieved

```javascript
Promise.all([itsm_states, users]).then(
  function([states, users]) {...}
)
```

