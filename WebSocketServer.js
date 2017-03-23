class WebSocketSocket {
  constructor(server, socket, connectionInfo) {
    this.server = server;

    socket.on("message", request => {
      try {
        request = JSON.parse(request);
        request.data.id = this.id;
        this.server.emit(socket, request.event, request.data);
      } catch (err) {
        this.server.emit(socket, request, {id: this.id});
      }
    });

    this.watchdogInterval = setInterval(() => {
      if (socket.readyState !== 1) {
        clearInterval(this.watchdogInterval);
        this.server.emit(socket, "close", {id: this.id});
        this.server.removeSocket(this.id);
      }
    }, 1000);
  }
}

class WebSocketServer {
  constructor(options) {
    this.events = {};
    this.sockets = [];

    this.server = new (require("ws")).Server(options);
    this.server.on("connection", socket => this.onConnection(socket));
  }

  onConnection(socket) {
    const info = {
      headers: socket.upgradeReq.headers,
      httpVersion: socket.upgradeReq.httpVersion,
      complete: socket.upgradeReq.complete,
      url: socket.upgradeReq.url,
      params: this.parseParams(socket.upgradeReq.url)
    };

    if (typeof this.verification === "function") {
      if (!this.verification(info)) {
        this.send("connected", {error: "rejected"});
        socket.close();
        return;
      }
    }

    const wsSocket = new WebSocketSocket(this, socket, info);
    wsSocket.id = Math.random();
    this.sockets.push(wsSocket);

    this.emit(socket, "connection", info);
  }

  removeSocket(id) {
    this.sockets.splice(this.sockets.findIndex(socket => socket.id === id), 1);
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    const id = Math.random();
    this.events[event].push({id, callback});

    return {off: () => this.events[event].splice(this.events[event].findIndex(event => event.id === id), 1)}
  }

  off(event) {
    this.events[event] = [];
  }

  emit(socket, event, data) {
    const eventArray = this.events[event];
    if (eventArray) {
      for (let i = 0; i < eventArray.length; i++) {
        const {callback} = eventArray[i];
        if (typeof callback === "function") {
          callback(data, this.buildResponse(socket));
        }
      }
    }
  }

  send(socket, event, data) {
    const string = JSON.stringify({event, data});
    socket.send(string);
  }

  broadcast(socket, event, data, others) {
    const string = JSON.stringify({event, data});
    this.server.clients.forEach(client => {
      if ((!others || client !== socket) && client.readyState === 1) {
        client.send(string)
      }
    });
  }

  acceptConnection(callback) {
    this.verification = callback;
  }

  parseParams(url) {
    let match;
    const search = /([^&=]+)=?([^&]*)/g;
    const decode = s => decodeURIComponent(s.replace(/\+/g, " "));
    const query = url.substring(url.indexOf("?") + 1);

    let urlParams = {};
    while (match = search.exec(query)) {
      urlParams[decode(match[1])] = decode(match[2]);
    }
    return urlParams;
  }

  buildResponse(socket) {
    return {
      send: (event, data) => this.send(socket, event, data),
      broadcast: (event, data) => this.broadcast(socket, event, data),
      broadcastOthers: (event, data) => this.broadcast(socket, event, data, true)
    };
  }
}

module.exports = WebSocketServer;
