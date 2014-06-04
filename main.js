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

scanPirates(function (pirates) {
  console.log('Found BusPirates:', pirates);

  if (pirates.length == 1) {
    console.log('Only one BusPirate was found, connecting to it...');
    connectPirate(pirates[0], function (err, connection) {
      if (err) console.error('Error while connecting:', err);
      connection.on('data', parsePirate);

      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', function (chunk) {
        connection.write(chunk);
      });

      connection.write('i\n');
    });
  }
});
