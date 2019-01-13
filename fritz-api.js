
var axios = require('axios');
var querystring = require('querystring');
var crypto = require('crypto');
var iconv = require('iconv-lite');

module.exports = {
  checkDevices: checkDevices,
};

async function checkDevices(ip, password, username) {
  if (username === undefined) { // fritz username is not required
    username = '';
  }

  var url = ip.replace('http://', '').replace('https://', '').trim();
  url = 'http://' + url;

  try {
    var challengeURL = `${url}/login_sid.lua?username=${username}`;
    var resp = await axios.get(challengeURL);
    var data = resp.data;
    var sid = extractSID(data);
    if (sid !== '0000000000000000') {
      console.log('We are still have a valid session, which we can use:', sid);
    }

    var challenge = extractChallenge(data);
    var str = `${challenge}-${password}`;
    // convert encoding to UTF-16LE
    var strBuffer = iconv.encode(str, 'utf16-le');
    var md5 = crypto.createHash('md5').update(strBuffer).digest('hex');
    var challengeResponse = `${challenge}-${md5}`;

    var sidURL = `${url}/login_sid.lua?username=${username}&response=${challengeResponse}`;
    resp = await axios.get(sidURL);
    sid = extractSID(resp.data);
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': url,
        'Pragma' : 'no-cache',
        'User-Agent': 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.8,de;q=0.6',
        'Accept-Encoding': 'gzip, deflate, sdch',
        'Connection': 'keep-alive',
	      'Cache-Control': 'no-cache',
      }
    }
    var body = {
      xhr: 1,
      sid: sid,
      lang: 'en',
      page: 'netDev',
      type: 'cleanup',
    };
    // By default, axios serializes JavaScript objects to JSON. Use querystring!
    resp = await axios.post(`${url}/data.lua`, querystring.stringify(body), config);
    var refinedDevices = [];
    var allDevices = resp.data.data.active.concat(resp.data.data.passive); // merging active and not active devices into one array.
    for (let active of allDevices) {
      if (active.mac === '') {
        continue;
      }
      // active.state can be globe_online=connected to internet, led_green=connected but not using internet, ""=offline
      var device = {
        mac: active.mac,
        ipv4: active.ipv4,
        name: active.name,
        connected: active.state !== '',
      }
      refinedDevices.push(device);
    }
    return refinedDevices;
  } catch(e) {
    console.log('got an error', e);
  }
}

function extractSID(xmlString) {
  var posStart = xmlString.indexOf('<SID>') + '<SID>'.length;
  var posEnd = xmlString.indexOf('</SID>');
  return xmlString.substr(posStart, posEnd - posStart);
}

function extractChallenge(xmlString) {
  var posStart = xmlString.indexOf('<Challenge>') + '<Challenge>'.length;
  var posEnd = xmlString.indexOf('</Challenge>');
  return xmlString.substr(posStart, posEnd - posStart);
}
