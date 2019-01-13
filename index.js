var Accessory, Service, Characteristic, UUIDGen;
var fritzAPI = require('./fritz-api.js');
const updateInterval = 5 * 1000;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  homebridge.registerPlatform('homebridge-fritz-devices', 'FritzDevices', FritzDevices, true);
}

class FritzDevices {
  constructor(log, config, api) {
    this.accessories = [];
    this.log = log;
    this.config = config;
    this.api = api;

    if (this.config === null || this.config === undefined || this.config.devices === undefined || this.config.fritzIP === undefined || this.config.fritzPassword === undefined) {
      throw new Error('Please configure homebridge-fritz-devices, see config-sample.json');
    }
    if (this.config.devices.length === 0) {
      throw new Error('No devices configured for the homebridge-fritz-devices plugin.');
    }
    if (this.config.fritzIP === '') {
      throw new Error('No Fritzbox IP configured for the homebridge-fritz-devices plugin.');
    }
    if (this.config.fritzPassword === '') {
      throw new Error('No Fritzbox Password configured for the homebridge-fritz-devices plugin.');
    }

    this.devices = [];
    for (let d of this.config.devices) {
      let m = cleanupMac(d.mac);
      if (m === undefined) {
        this.log('The given MAC address is not valid: ' + d.mac);
        continue;
      }
      this.devices.push({name: d.name, mac: m})
    }

    this.log('homebridge-fritz-devices init');
    // homebridge did finish startup, and restored existing accessories
    this.api.on('didFinishLaunching', () => {
      this.log.debug('didFinishLaunching');
      // Get list of devices from fritzbox
      for (let device of this.devices) {
        var exists = this.accessories.find(function(a) {
          return a.context.mac === device.mac;
        });
        if (exists === undefined) {
          this.addAccessory(device);
        }
      }
      setInterval(() => {
        this.checkFritzOccupancy();
      }, updateInterval);
    });
  }

  // checkFritzOccupancy gets a list of all the connected devices on the fritzbox and
  async checkFritzOccupancy() {
    this.log.debug('checking fritz devices');
    var fritzDevices = await fritzAPI.checkDevices(this.config.fritzIP, this.config.fritzPassword, this.config.fritzUsername);
    for (let accessory of this.accessories) {
      var foundDevice = fritzDevices.find(function(d) {
        return d.mac === accessory.context.mac;
      });
      if (foundDevice === undefined) {
        // TODO: instead of marking not found mac as not detected, return error when homekit tires to read it.
        this.log.debug('Device', accessory.context.mac, 'not found on fritzbox, setting detected to false.');
        continue;
      }
      accessory.getService(Service.OccupancySensor).getCharacteristic(Characteristic.OccupancyDetected).updateValue(foundDevice.connected);
    }
  }

  // homebridge interface: Function invoked when homebridge tries to restore cached accessory.
  configureAccessory(accessory) {
    var foundInConfig = this.devices.find(function(d) {
      return d.mac === accessory.context.mac;
    });

    if (foundInConfig === undefined) {
      this.api.unregisterPlatformAccessories('homebridge-fritz-devices', 'FritzDevices', [accessory]);
      this.log.debug('Accessory not found in configuration, removed from Homebridge:', accessory.displayName, accessory.context.mac);
      return;
    }

    accessory.on('identify', (paired, callback) => {
      this.log(accessory.displayName, accessory.context.mac, 'Identify pressed');
      callback();
    });
    this.accessories.push(accessory);
    this.log.debug('Found existing Accessory:', accessory.displayName, accessory.context.mac);
  }
  addAccessory(device) {
    var uuid = UUIDGen.generate(device.mac);
    var accessory = new Accessory(device.name, uuid);
    accessory.context.mac = device.mac;
    accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, 'Fritz Homebridge');
    accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, device.mac);
    accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, 'Yannick Weiss');
    accessory.getService(Service.AccessoryInformation).addCharacteristic(Characteristic.FirmwareRevision).updateValue('1.0.0');
    accessory.on('identify', (paired, callback) => {
      this.log(accessory.displayName, accessory.context.mac, 'Identify pressed');
      callback();
    });
    accessory.addService(Service.OccupancySensor, device.name)
    this.accessories.push(accessory);
    this.api.registerPlatformAccessories('homebridge-fritz-devices', 'FritzDevices', [accessory]);
    this.log('Added new Accessory:', device.name, device.mac);
  }
  updateAccessoriesReachability() {
    this.log.debug('Update Reachability');
  }
  removeAccessory() {
    this.log('Remove Accessory');
  }
}

function cleanupMac(mac) {
  var m = mac;
  m = m.replaceAll(':', '');
  m = m.trim();
  if (m.length !== 12) { // simple MAC validation
    return undefined;
  }
  m = m.toUpperCase();
  m = m.match(/.{1,2}/g).join(':');
  return m;
}

if (String.prototype.replaceAll === undefined) {
  // eslint-disable-next-line
  String.prototype.replaceAll = function(search, replacement) {
    var escapeRegExp = function(str) { // should be RegExp.escape
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    };
    return this.replace(new RegExp(escapeRegExp(search), 'g'), replacement);
  };
}
