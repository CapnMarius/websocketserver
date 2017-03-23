class WebSocketServer {
  constructor(options) {
    this.events = {};

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

    this.emit(socket, "connection", info);

    socket.on("message", request => {
      try {
        request = JSON.parse(request);
        this.emit(socket, request.event, request.data);
      } catch (err) {
        this.emit(socket, request, null);
      }
    });
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    const index = this.events[event].length;
    this.events[event].push(callback);

    return {off: () => this.events[event].splice(index, 1)}
  }

  off(event) {
    this.events[event] = [];
  }

  emit(socket, event, data) {
    const eventArray = this.events[event];
    if (eventArray) {
      for (let i = 0; i < eventArray.length; i++) {
        const callback = eventArray[i];
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
