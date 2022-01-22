// const { WebSocketServer } = require('ws')
// const { v4: uuidv4 } = require('uuid')
// const playerMap = {

// }

// const wss = new WebSocketServer({ port: 8080 });


// wss.on('connection', function connection(ws, req) {

//    ws.on('message', function message(data) {
//       const message = JSON.parse(data)
//       if (message.eventType == 'MoveEvent') {
//          wss.clients.forEach(function each(client) {
//             client.send(data.toString());
//          });
//       }
//    })

//    // if (!playerMap[req.socket.remoteAddress]) {
//    //    playerMap[req.socket.remoteAddress] = uuidv4()
//    // }
//    // const playerId = playerMap[req.socket.remoteAddress]
//    const playerId = uuidv4();
//    console.log(`player: ${playerId} joined`)


//    ws.send(JSON.stringify({ "playerId": playerId, "eventType": "self_connected", "eventData": "welcome to stuff" }))
//    console.log(`sending other connected event for ${wss.clients.size} number of players`)
//    wss.clients.forEach(function each(client) {
//       if (client !== ws) {
//          client.send(JSON.stringify({ playerId, eventType: "other_connected", eventData: "0,0" }));
//       }
//    });
// })

const dgram = require('dgram');
const { connect } = require('http2');

const server = dgram.createSocket('udp4')

server.on('error', (err) => {
   console.log(`server error:\n${err.stack}`);
   server.close();
});

const connectedPlayers = new Map()
const connectedPlayersSeq = new Map()

const checkForDisconnection =
   setInterval(() => {
      for (let [playerId, playerTimeoutCounter] of connectedPlayers.entries()) {
         connectedPlayers.set(playerId, playerTimeoutCounter + 1)
         if (playerTimeoutCounter > 10) {
            console.log(`player ${playerId} disconnected`)
            connectedPlayers.delete(playerId)
            connectedPlayersSeq.delete(playerId)
         }
      }
   }, 1000)
const gameProtocol = Buffer.from("5eee")
server.on('message', (msg, rinfo) => {

   console.log(msg)
   if (msg.slice(0, 4).compare(gameProtocol) === 0) {
      // console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
      if (!connectedPlayers.has(`${rinfo.address}:${rinfo.port}`)) {
         console.log(`player ${rinfo.address}:${rinfo.port} connected`)
         connectedPlayersSeq.set(`${rinfo.address}:${rinfo.port}`, Buffer.alloc(4))
      }
      connectedPlayers.set(`${rinfo.address}:${rinfo.port}`, 0)
   }
});

function incrementBE(buffer) {
   for (var i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i]++ !== 255) break;
   }
}

const sendDataToClients =
   setInterval(() => {
      for (let [playerId, playerTimeoutCounter] of connectedPlayers.entries()) {
         const buf1 = Buffer.from('5eee');
         const buf2 = connectedPlayersSeq.get(playerId)
         connectedPlayersSeq.set(incrementBE(connectedPlayersSeq.get(playerId)))
         const [playerAddress, playerPort] = playerId.split(':')
         server.send([buf1, buf2], playerPort, playerAddress, (err) => {
            if (err) {
               console.log(err)
            }
         });
      }
   }, 100)


server.on('listening', () => {
   const address = server.address();
   console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(41234);
