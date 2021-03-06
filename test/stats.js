const Buffer = require('safe-buffer').Buffer
const Client = require('bittorrent-tracker')
const commonTest = require('./common')
const fixtures = require('webtorrent-fixtures')
const get = require('simple-get')
const test = require('tape')

const peerId = Buffer.from('-WW0091-4ea5886ce160')
const unknownPeerId = Buffer.from('01234567890123456789')

function parseHtml (html) {
  const extractValue = new RegExp('[^v^h](\\d+)')
  const array = html.replace('torrents', '\n').split('\n').filter(function (line) {
    return line && line.trim().length > 0
  }).map(function (line) {
    const a = extractValue.exec(line)
    if (a) {
      return parseInt(a[1], 10)
    }
  })
  let i = 0
  return {
    torrents: array[i++],
    activeTorrents: array[i++],
    peersAll: array[i++],
    peersSeederOnly: array[i++],
    peersLeecherOnly: array[i++],
    peersSeederAndLeecher: array[i++],
    peersIPv4: array[i++],
    peersIPv6: array[i]
  }
}

function getEmptyStats (t, server, opts) {
  get.concat(opts, function (err, res, data) {
    t.error(err)

    const stats = typeof data.torrents !== 'undefined' ? data : parseHtml(data.toString())
    t.equal(res.statusCode, 200)
    t.equal(stats.torrents, 0)
    t.equal(stats.peersAll, 0)
    t.equal(stats.peersSeederOnly, 0)
    t.equal(stats.peersLeecherOnly, 0)
    t.equal(stats.peersSeederAndLeecher, 0)
    t.equal(stats.peersIPv4, 0)
    t.equal(stats.peersIPv6, 0)

    server.close(function () { t.pass('server closed') })
  })
}

test('server: get empty stats', function (t) {
  t.plan(10)

  commonTest.createServer(t, {}, function (server, announceUrl) {
    const opts = {
      url: announceUrl.replace('ws', 'http') + '/stats'
    }

    getEmptyStats(t, server, opts)
  })
})

test('server: get empty stats with json header', function (t) {
  t.plan(10)

  commonTest.createServer(t, {}, function (server, announceUrl) {
    const opts = {
      url: announceUrl.replace('ws', 'http') + '/stats',
      headers: {
        accept: 'application/json'
      },
      json: true
    }

    getEmptyStats(t, server, opts)
  })
})

test('server: get empty stats on stats.json', function (t) {
  t.plan(10)

  commonTest.createServer(t, {}, function (server, announceUrl) {
    const opts = {
      url: announceUrl.replace('ws', 'http') + '/stats.json',
      json: true
    }

    getEmptyStats(t, server, opts)
  })
})

test('server: get leecher stats.json', function (t) {
  t.plan(10)

  commonTest.createServer(t, {}, function (server, announceUrl) {
    // announce a torrent to the tracker
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId,
      port: 6881,
      wrtc: {}
    })

    commonTest.mockWebsocketTracker(client)
    client.on('error', function (err) { t.error(err) })
    client.on('warning', function (err) { t.error(err) })

    client.start()

    server.once('start', function () {
      const opts = {
        url: announceUrl.replace('ws', 'http') + '/stats.json',
        json: true
      }

      get.concat(opts, function (err, res, stats) {
        t.error(err)

        t.equal(res.statusCode, 200)
        t.equal(stats.torrents, 1)
        t.equal(stats.peersAll, 1)
        t.equal(stats.peersSeederOnly, 0)
        t.equal(stats.peersLeecherOnly, 1)
        t.equal(stats.peersSeederAndLeecher, 0)
        t.equal(stats.clients['WebTorrent']['0.91'], 1)

        client.destroy(function () { t.pass('client destroyed') })
        server.close(function () { t.pass('server closed') })
      })
    })
  })
})

test('server: get leecher stats.json (unknown peerId)', function (t) {
  t.plan(10)

  commonTest.createServer(t, {}, function (server, announceUrl) {
    // announce a torrent to the tracker
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: unknownPeerId,
      port: 6881,
      wrtc: {}
    })

    commonTest.mockWebsocketTracker(client)
    client.on('error', function (err) { t.error(err) })
    client.on('warning', function (err) { t.error(err) })

    client.start()

    server.once('start', function () {
      const opts = {
        url: announceUrl.replace('ws', 'http') + '/stats.json',
        json: true
      }

      get.concat(opts, function (err, res, stats) {
        t.error(err)

        t.equal(res.statusCode, 200)
        t.equal(stats.torrents, 1)
        t.equal(stats.peersAll, 1)
        t.equal(stats.peersSeederOnly, 0)
        t.equal(stats.peersLeecherOnly, 1)
        t.equal(stats.peersSeederAndLeecher, 0)
        t.equal(stats.clients['unknown']['01234567'], 1)

        client.destroy(function () { t.pass('client destroyed') })
        server.close(function () { t.pass('server closed') })
      })
    })
  })
})
