/**
 * @file index.js
*
 * @brief
 *
 * @author Kenji MINOURA / info@kandj.org
 *
 * Copyright (c) 2018 K&J Software Design, Corp. All rights reserved.
 *
 * @see <related_items>
 ***********************************************************************/
'use strict';

const Datastore = require('@google-cloud/datastore');
const datastore = new Datastore();

function toDownlinkData(v) {
  let s = v.toString(16);
  if (s.length > 16) return false;

  let prefix = '';
  for (let i = s.length; i < 16; i++) {
    prefix += '0';
  }

  return prefix + s;
}

function getInfo(device) {
  const promise = device ? datastore.get(datastore.key(['DeviceInfo', device])):
        datastore.runQuery(datastore.createQuery('DeviceInfo'));

  return promise.then(results => {
    return results[0];
  });
}

function saveInfo(data) {
  return datastore.save({
    key: datastore.key(['DeviceInfo', data.device]),
    data: {
      device: data.device,
      name: data.name,
      interval: data.interval
    }
  });
}

function getLogs(device) {
  return datastore.runQuery(datastore.createQuery(device)).then(results => {
    return results[0];
  });
}

function saveLog(data) {
  const keyInfo = datastore.key(['DeviceInfo', data.device]);
  const keyLog = datastore.key(data.device);
  const transaction = datastore.transaction();

  return transaction.run()
    .then(() => transaction.get(keyInfo))
    .then(results => {
      if (!results[0]) {
        transaction.save({
          key: keyInfo,
          data: {
            name: '__DEFAULT__',
            interval: 3600
          }
        });
      }

      transaction.save({
        key: keyLog,
        data: data
      });

      return transaction.commit();
    }).then(() => {
      return getInfo(data.device);
    }).catch(() => transaction.rollback());
}

exports.log = (req, res) => {
  console.log(req.params[0]);
  console.log(req.body);

  const id = req.params[0].substr(1);
  if (!id) {
    res.sendStatus(400);
    return;
  }

  switch (req.method) {
  case 'GET':
    getLogs(id).then(data => res.json(data)).catch(() => res.sendStatus(500));
    return;

  case 'POST':
    if (id != req.body.device) {
      res.sendStatus(400);
      return;
    }

    const promise = saveLog(req.body);

    if (!req.body.ack) {
      res.sendStatus(204);
      return;
    }

    const emptyData = '0000000000000000';
    let downlink = new Object();

    promise.then(info => {
      const data = toDownlinkData(info.interval);
      downlink[id] = {
        'downlinkData': (data ? data: emptyData)
      };
      res.json(downlink);
    }).catch(() => {
      downlink[id] = {
        'downlinkData': emptyData
      };
      res.json(downlink);
    });
    return;

  default:
    res.sendStatus(405);
    return;
  }
};

exports.info = (req, res) => {
  console.log(req.params[0]);
  console.log(req.body);

  const id = req.params[0].substr(1);

  switch (req.method) {
  case 'GET':
    getInfo(id).then(data => res.json(data)).catch(() => res.sendStatus(500));
    return;

  case 'POST':
    if (!req.body.device) {
      res.sendStatus(400);
      return;
    }
    saveInfo(req.body).then(() => res.sendStatus(200))
      .catch(() => res.sendStatus(500));
    return;

  case 'PUT':
    if (!id || (id != req.body.device)) {
      res.sendStatus(400);
      return;
    }
    
    saveInfo(req.body).then(() => res.sendStatus(200))
      .catch(() => res.sendStatus(500));

  default:
    res.sendStatus(405);
    return;
  }
};
