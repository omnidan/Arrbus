// main.js
var serialPort = require('serialport');

// scan for buspirates in all serial ports
function scanPirates(callback) {
  serialPort.list(function (err, ports) {
    var pirates = [];
    ports.forEach(function(port) {
      // BusPirate v3
      if (port.vendorId == '0x0403' &&
          port.productId == '0x6001') {
        port.buspirate = 3;
        pirates.push(port);
      }
    });
    // return list of buspirates found
    callback(pirates);
  });
}

// connect to a buspirate and return the serial connection
function connectPirate(pirate, callback) {
  var SerialPort_Obj = serialPort.SerialPort; // localize object constructor

  // initialize connection, buspirates need baudrate 115200
  // parser raw needed for command line input
  var connection = new SerialPort_Obj(pirate.comName, {
    parser: serialPort.parsers.raw,
    baudrate: 115200
  });

  // connect to the buspirate and return the result
  connection.open(function (err) {
    if (err) callback(err, null);
    else callback(null, connection);
  });
}

// parse output of the buspirate
// right now, this only outputs to the terminal
// TODO: later, we want to send this data to the GUI via IPC
function parsePirate(data) {
  process.stdout.write(data.toString('utf-8'));
}

// parse the 'i' command output from the buspirate to gather information
function queryPirate(connection, callback) {
  // send the 'i' command
  connection.write('i\n');

  // now parse the output
  var full_data = '';
  connection.on('data', function (data) {
    // add data to full_data (with utf-8 formatting)...
    var encoded_data = data.toString('utf-8');
    full_data += encoded_data;

    // ...until we hit 'HiZ>', which means it's the end of the output
    if (encoded_data.substr(encoded_data.length - 4) == 'HiZ>') { // FIXME: this might not always work, e.g. when the data is sent too slow and a new buffer is opened
      // sanitize data
      var split_data = full_data.split('\n');
      var hydration_data = split_data.slice(1, split_data.length-2);

      // parse data
      var versions = hydration_data[1].split('  ');
      var fw_string = ('v' + versions[0].match(/v(.*)$/)[1]).split(' ');
      var result = {
        bp_version: 'v' + hydration_data[0].match(/v(.*)\r$/)[1],
        firmware: {
          version: fw_string[0],
          rev: fw_string[1]
        },
        bootloader_version: 'v' + versions[1].match(/v(.*)\r$/)[1],
        idstring: hydration_data[2].substring(0, hydration_data[2].length - 1)
      };

      // return data
      callback(result);
    }
  });
}

// main functionality below
scanPirates(function (pirates) {
  console.log('Found BusPirates:', pirates);

  if (pirates.length == 1) {
    console.log('Only one BusPirate was found, connecting to it...');
    connectPirate(pirates[0], function (err, connection) {
      if (err) console.error('Error while connecting:', err);

      queryPirate(connection, function (pirate_hydration) {
        // merge pirate_hydration object into active pirate object
        for (var attr in pirate_hydration) {
          pirates[0][attr] = pirate_hydration[attr];
        }
        console.log('Hydrated BusPirate object:', pirates[0]);

        // now set the parsePirate listener (we don't want it to display the
        // output we get while gathering data from the buspirate)
        // TODO: later, we might want a solution that locks this listener while querying
        connection.on('data', parsePirate);
      });

      // parse input from command line...
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', function (chunk) {
        // ...and send it to the buspirate
        connection.write(chunk);
      });
    });
  }
});
