const dgram = require('dgram');
const server = dgram.createSocket('udp4')


// example packet
// 5eee 10 12 <00000000 00000000 00000000 00000000>
// gameProtocol, localSequenceNumber, remoteSequenceNumber, ackBitField

// <00000000 00000000 00000000 00000000> <00000000 00000000 00000000 00000000> <00000000 00000000 00000000 00000000> <00000000 00000000 00000000 00000000> ...





// printing buffers as binary taken from 
// https://stackoverflow.com/questions/66702935/how-do-i-print-a-node-buffer-as-binary
// example usage console.log([...buffer].map(byteToBinaryString).join(" "));
function byteToBinaryString(s) {
   return s.toString(2).padStart(8, '0');
}

// This converts a 4 byte or larger buffer to a number assuming big endian
//code taken from
// https://stackoverflow.com/questions/14963182/how-to-convert-last-4-bytes-in-an-array-to-an-integer
function convertBufferToNumber(buffer) {
   var count = 0;
   // assuming the buffer has at least four elements
   for (var i = buffer.length - 4; i <= buffer.length - 1; i++) {
      count = count << 8 + buffer[i];
   }
   return count
}

//buffer bitshifting code taken from a library that does it
// https://github.com/cjdelisle/buffershift/blob/master/index.js

//an easy way to shift a buffer left
const shl = (buf /*:Buffer*/, shiftBits /*:number*/) => {
   if (shiftBits < 0) { return shr(buf, -shiftBits); }
   if (shiftBits !== (shiftBits | 0)) { throw new Error("shiftBits must be a 32 bit int"); }
   const bytes = 2 * ((shiftBits >> 4) + ((shiftBits & 15) !== 0));
   const bits = (bytes * 8) - shiftBits;
   for (let reg = 0, i = 0; i - bytes < buf.length; i += 2) {
      reg <<= 16;
      if (i < buf.length - 1) {
         reg |= buf.readUInt16BE(i);
      } else if (i < buf.length) {
         reg |= buf[i] << 8;
      }
      if (i - bytes >= 0) {
         if (i - bytes < buf.length - 1) {
            buf.writeUInt16BE((reg >>> bits) & 0xffff, i - bytes);
         } else {
            if (i - bytes !== buf.length - 1) { throw new Error(); }
            buf[i - bytes] = reg >>> (bits + 8);
         }
      } else if (i - bytes === -1) {
         buf[0] = reg >>> bits;
      }
   }
};

//an easy way to shift a buffer right
const shr = (buf /*:Buffer*/, shiftBits /*:number*/) => {
   if (shiftBits < 0) { return shl(buf, -shiftBits); }
   if (shiftBits !== (shiftBits | 0)) { throw new Error("shiftBits must be a 32 bit int"); }
   const bytes = 2 * ((shiftBits >> 4) + ((shiftBits & 15) !== 0));
   const bits = 16 - ((bytes * 8) - shiftBits);
   for (let reg = 0, i = buf.length - 2; i + bytes >= -1; i -= 2) {
      reg >>>= 16;
      if (i >= 0) {
         reg |= buf.readUInt16BE(i) << 16;
      } else if (i === -1) {
         reg |= buf[0] << 16;
      }
      if (i + bytes + 1 < buf.length) {
         if (i + bytes >= 0) {
            buf.writeUInt16BE((reg >>> bits) & 0xffff, i + bytes);
         } else {
            if (i + bytes + 1) { throw new Error(); }
            buf[0] = reg >>> bits;
         }
      } else if (i + bytes + 1 === buf.length) {
         buf[i + bytes] = reg >>> (bits + 8);
      }
   }
};

server.on('error', (err) => {
   console.log(`server error:\n${err.stack}`);
   server.close();
});

// This is used to tell who is connected and how long it has been since there has been a message
const connectedPlayers = new Map()
// This keeps track of our local sequence number. That is, for every message we send, we increment add this
// This helps the game know what packets have been received and which have been dropped
const connectedPlayersSeq = new Map()

//This keeps track of the remote sequence number of the most recently seen packet from a connected player
const connectedPlayersRemoteSeq = new Map()

//This keeps track of the 32 previous packets received from a connected player
// This gives us redundancy in what packets we've seen.
// If a clients sends 30 packets per second and we're sending 10 back then 
// We would have to have a packet delayed for an entire second to actually miss it
const connectedPlayersAckBitfield = new Map()

//We increment the inactivity timer for a connected player using a dedicated async loop
const checkForDisconnection =
   setInterval(() => {
      // walk through each of the connected players
      for (let [playerId, playerTimeoutCounter] of connectedPlayers.entries()) {
         // increment how long they've been connected (this gets reset on message received)
         connectedPlayers.set(playerId, playerTimeoutCounter + 1)
         // if it's been longer than 10 seconds since we've received a message from this player
         if (playerTimeoutCounter > 10) {
            console.log(`player ${playerId} disconnected`)
            //remove them from the connected players
            connectedPlayers.delete(playerId)
            //remove their sequence number counter
            connectedPlayersSeq.delete(playerId)
         }
      }
   }, 1000)

// This is the arbitrary protocol id that our client and server include so that it is known
// if packets are from the client / server for this game.
const gameProtocol = Buffer.from("5eee")

server.on('message', (msg, rinfo) => {

   // Only use this packet if it matches our game protocol
   if (msg.slice(0, 4).compare(gameProtocol) === 0) {
      const playerId = `${rinfo.address}:${rinfo.port}`
      // If this player currently is not connected
      if (!connectedPlayers.has(playerId)) {
         console.log(`player ${playerId}} connected`)
         // Save them into the connected players map
         connectedPlayersSeq.set(playerId, Buffer.alloc(4))
         connectedPlayersRemoteSeq.set(playerId, Buffer.alloc(4))
         connectedPlayersAckBitfield.set(playerId, Buffer.alloc(4))
      } 
      //parse the remote sequence number and store it so we can ack TODO
      const previousRemoteSeq = connectedPlayersRemoteSeq.get(playerId)
      connectedPlayersRemoteSeq.set(playerId, msg.slice(4, 8))
      const remoteSeqDiff = convertBufferToNumber(msg.slice(4, 8)) - convertBufferToNumber(previousRemoteSeq)
      const oldBitField = connectedPlayersAckBitfield.get(playerId)
      // console.log(remoteSeqDiff)
      // note that this is being done in place so no need to set again in the map
      shl(oldBitField,  remoteSeqDiff)
      //reset the player's inactivity timer
      connectedPlayers.set(playerId, 0)
   }
});

//Any incrementing numbers are stored using fixed length buffers in our packets
// it is difficult to use JS since all the types are handled by the engine.
// This method allows us to increment (and wrap around?) our packet numbres
function incrementBE(buffer) {
   for (var i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i]++ !== 255) break;
   }
}


// This is where we communicate back to connected clients. We try to send 10 packets per
// second to each connected player regardless of whether or not we have something to send right now.
// That is useful based on how we calculate if someone is connected or not.
const sendDataToClients =
   setInterval(() => {
      for (let [playerId, playerTimeoutCounter] of connectedPlayers.entries()) {
         const gameProtocol = Buffer.from('5eee');
         //Increment the local sequence number for this packet
         // This allows the client to ack it back to us when they get it.
         incrementBE(connectedPlayersSeq.get(playerId))
         const localSequenceNumber = connectedPlayersSeq.get(playerId)
         const ackNumber = connectedPlayersRemoteSeq.get(playerId)
         const ackBitField = connectedPlayersAckBitfield.get(playerId)
         const [playerAddress, playerPort] = playerId.split(':')
         console.log(`${[...connectedPlayersSeq].map(byteToBinaryString).join(" ")} --- local seq number`)
         console.log(`${[...ackNumber].map(byteToBinaryString).join(" ")} --- remote seq number`)
         console.log(`${[...ackBitField].map(byteToBinaryString).join(" ")} --- ack bitfield`)
         console.log()
         server.send([gameProtocol, localSequenceNumber, ackNumber, ackBitField], playerPort, playerAddress, (err) => {
            if (err) {
               console.log(err)
            }
         });
      }
   }, 500)


server.on('listening', () => {
   const address = server.address();
   console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(41234);
