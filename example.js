const express = require('express');
const http = require('http');
const srv = http.createServer();
const api = express();
const wss = new (require("./WebSocketServer"))({server: srv});

srv.on('request', api);

wss.verify(info => {
  return true; //do verification...
});

wss.on('connection', (connectionInfo, response) => {
  console.log('connection', connectionInfo);
  response.broadcastOthers("new user online", connectionInfo.params.username);
});

wss.on('example', (data, response) => {
  console.log('example', data);

  response.send('yeah');
  response.broadcast('example');
});

srv.listen(3000, () => console.log("The Server is lisening on port 3000."));