//Initialize the express 'app' object
let express = require("express");
let app = express();
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

// database
const defaultData = { berryPositions: [], weight: 0.000 };
const adapter = new JSONFile('db.json');
const db = new Low(adapter, defaultData);

/* blueberry instantiation */
const NUM_BLUEBERRIES = 20;
const WEIGHT_PER_BLUEBERRY = 0.005;
const BUCKET_RIM_TOP = 0.49; // fraction of image height estimate
const BLUEBERRY_EDGE_MARGIN_X = 0.05;
const BLUEBERRY_EDGE_MARGIN_TOP = 0.1;

function randomHelper(min, max) {
  return min + Math.random() * (max - min);
}

function makeBerry() {
  return {
    id: crypto.randomUUID(),
    x: randomHelper(BLUEBERRY_EDGE_MARGIN_X, 1 - BLUEBERRY_EDGE_MARGIN_X),
    y: randomHelper(BLUEBERRY_EDGE_MARGIN_TOP, BUCKET_RIM_TOP)
  };
}

app.use("/", express.static("public"));

//Initialize HTTP server
let http = require("http");
let server = http.createServer(app);

//Initialize socket.io
let io = require("socket.io");
io = new io.Server(server);

//'port' variable allows for deployment
let port = process.env.PORT || 3000;

// wait for data to load
async function start() {

  await db.read();

  // first time we need to create the initial berries
  while (db.data.berryPositions.length < NUM_BLUEBERRIES) {
    db.data.berryPositions.push(makeBerry());
  }
  await db.write();

  server.listen(port, () => {
    console.log("App listening at port: " + port);
  });

  //Listen for a client to connect and disconnect
  io.on("connection", (socket) => {
    console.log("We have a new client: " + socket.id);

    socket.emit('init', {
      berries: db.data.berryPositions,
      weight: db.data.weight
    });

    socket.on('pick', async (id) => {
      let index = db.data.berryPositions.findIndex((b) => b.id === id); // Returns position number
      if (index === -1) return; // Someone else already picked this berry

      // Swap the picked berry for a new one and add its weight
      let newBerry = makeBerry();
      db.data.berryPositions.splice(index, 1);   // remove the picked berry
      db.data.berryPositions.push(newBerry);     // add new berry
      db.data.weight += WEIGHT_PER_BLUEBERRY;
      await db.write();

      // Tell everyone, including the person who picked it
      io.emit('picked', {
        pickedId: id,
        newBerry: newBerry,
        weight: db.data.weight
      });
    });

    // Pass this person's cursor on to everyone else, tagged with who it's from
    socket.on('cursor', (data) => {
      socket.broadcast.emit('cursor', {
        id: socket.id,
        x: data.x,
        y: data.y,
        emoji: data.emoji
      });
    });

  //Listen for this client to disconnect
  socket.on("disconnect", () => {
    console.log("A client has disconnected: " + socket.id);
    // Remove their heart from everyone's screen
    io.emit('cursor-leave', socket.id);
  });
});
}

start();