# Notes

## Homebridge Gotchas
* If during testing your accessories are not removed, they are cached in `cachedAccessories`.
* Call the -U flag with an absolute path.
* You can store extra data in `accessory.context.XXX`
* Opposed to setValue() , updateValue() does not trigger the set event within homebridge, so you don't need to store a context and inspect it in the set event routine to avoid loops.
* updateValue() does not fire the set event.
* the "value" property of a Characteristic is really a "cached value", use on('get') and trigger it with getValue(callback, context, connectionID)
* identify does not have to be implemented.
* identify Characteristic cannot be hidden.
* optional Characteristic don't have to be added. Just configure set and get.
* The Service name is displayed in HomeKit Home App. But the accessory name is showed during pairing.

## TODO
* fritz-api should return errors or exceptions.


## Material and links
* [HomeKit Types](https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js)
* https://github.com/andig/homebridge-fritz
