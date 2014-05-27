// imports
var net = require('net')

//locals
var clients = {}
var ports = []
for (var i = 0; i < 1000; i++) { ports[i] = {port: 8088 + i, remote: null, local: null, gateway: null, flow: {rx_bytes: 0, tx_bytes: 0}} }
var requests = 0

// func
var tunnelExists = function(remote, destination) {
	var tunnel_exists = false
	ports.some(function(value, key) {
		if (value.remote == remote && value.local == destination) { tunnel_exists = true }
	})
	return tunnel_exists
}

var getTunnelKey = function(remote, destination) {
	var port_key
	ports.some(function(value, key) {
		if (value.remote == remote && value.local == destination) {
			port_key = value.port
		}
	})
	return port_key
}

var portKey = function() {
	var port_key;
	ports.some(function(value, key) {
		if (value.remote == null) {
			port_key = key
			return true
		}
	})
	return port_key
}

var createGateway = function(remote, destination, port) {
	// check if tunnel is open, no need for more than one tunnel
	if (!tunnelExists(remote, destination)) {
		console.log('Creating tunnel for remote client=>' + remote + ', destination=>' + destination + ':' + port)
		var proxyKey = portKey()
		ports[proxyKey].remote = remote
		ports[proxyKey].local = destination
		ports[proxyKey].gateway = net.createServer(function(client) {
			client.on('error', function(e) {
				console.log('Socket for endpoint ' + client.remoteAddress + ' encountered an error=>' + e)
			})
			client.on('close', function(b) {
				ports[proxyKey].flow.rx_bytes += client.bytesRead
				ports[proxyKey].flow.tx_bytes += client.bytesWritten
			})
			if (client.remoteAddress == remote) {
				// correct remote ip
				//console.log('Expected IP=>' + remote + ', client IP=>' + client.remoteAddress)
				console.log("Authorized client (" + remote + ")> Rx bytes: " + ports[proxyKey].flow.rx_bytes + ", Tx bytes: " + ports[proxyKey].flow.tx_bytes)
			} else {
				// uninvited
				//console.log('Expected IP=>' + remote + ', client IP=>' + client.remoteAddress)
				console.log("Unauthorized client detected, closing socket")
				client.write("Unauthorized sir.<br><b>NONE SHALL PASS</b>", function() {
					client.end()
				})
			}
			var pipe = net.createConnection({
				host: destination,
				port: port
			})
			client.pipe(pipe)
			pipe.pipe(client)
		})
		ports[proxyKey].gateway.listen(ports[proxyKey].port)
		return ports[proxyKey].port
	} else {
		// tunnel already requested, resend port
		return getTunnelKey(remote, destination)
	}
}

var destroyGateway = function(remote) {
	ports.some(function(value, key) {
		if(value.remote == remote) {
			ports[key].remote = null
			ports[key].local = null
			// actually destroy the gateway
			ports[key].gateway.close()
			ports[key].gateway.unref()
			ports[key].gateway = null
		}
	})
}

var getPortList = function(callBack) {
	var list = []
	ports.forEach(function(value, key) {
		if (value.gateway != null) {
			item = {}
			item.whiteListIp = value.remote
			item.destinationIp = value.local
			item.destinationPort = value.port
			item.flow = value.flow
			list.push(item)
		}
	})
	callBack(list)
}

//exports
module.exports = {
	createGateway: createGateway,
	destroyGateway: destroyGateway,
	_gateways: getPortList
}