# Service Cloud - Client

Allow to call Service Cloud services (instances of `service-cloud-service`) actions.

## Usage

Let's say there is a serivce called `hello-world` in the service cloud (`service-cloud-service`) and this service has an action called `say` which produces a message with the sentence `Hello World!` depending on the language given in the options of the action.

This action can be called 3 different ways :

```javascript
const client = require('service-cloud-client');

const serviceName = 'hello-world'; // Name of the service
const actionName = 'say'; // Name of the action of the service
const data = { // Options of the action
    language: 'fr'
};
const remote = 'http://localhost:1900'; // Entry point of the service cloud

// Direct call
client.ServiceCloudClient.call(serviceName, actionName, remote, data, (e, result) => {
    if(e)
        return console.error(e);

    console.log(result.message);
});

// Call with instance
const helloWorld = new client.ServiceCloudClient(serviceName, remote);
helloWorld.call(actionName, data, (e, result) => {
    if(e)
        return console.error(e);

    console.log(result.message);
});

// Call with expanded methods (methods dynamically added to the object from the information of the remote service)
const helloWorldExpanded = new client.ServiceCloudClient(serviceName, remote);
helloWorldExpanded.expandActions((e) => {
    if(e)
        return console.error(e);
        
    helloWorldExpanded.say(data, (e, result) => {
        if(e)
            return console.error(e);
    
        console.log(result.message);
    });
});
```
