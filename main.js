var serialPort = require('serialport');

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
    callback(pirates);
  });
}

function connectPirate(pirate, callback) {
  var SerialPort_Obj = serialPort.SerialPort; // localize object constructor

  var connection = new SerialPort_Obj(pirate.comName, {
    parser: serialPort.parsers.raw,
    baudrate: 115200
  });

  connection.open(function (err) {
    if (err) callback(err, null);
    else callback(null, connection);
  });
}

function parsePirate(data) {
  process.stdout.write(data.toString('utf-8'));
}

function queryPirate(connection, callback) {
  connection.write('i\n');

  var full_data = '';
  connection.on('data', function (data) {
    var encoded_data = data.toString('utf-8');
    full_data += encoded_data;
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

        connection.on('data', parsePirate);
      });

      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', function (chunk) {
        connection.write(chunk);
      });
    });
  }
});
