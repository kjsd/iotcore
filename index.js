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

function getInfo(id) {
  if (!id) {
    return datastore.runQuery(datastore.createQuery('DeviceInfo'));
  }

  return datastore.get(datastore.key(['DeviceInfo', id])).then(results => {
    return results[0];
  });
}

function saveInfo(data) {
  return datastore.save({
    key: datastore.key(['DeviceInfo', data.id]),
    data: {
      id: data.id,
      name: data.name,
      interval: data.interval
    }
  });
}

function getLogs(id) {
  return datastore.runQuery(datastore.createQuery(id));
}

function saveLog(data) {
  const keyInfo = datastore.key(['DeviceInfo', data.id]);
  const keyLog = datastore.key(data.id);
  const transaction = datastore.transaction();

  const saveLogImpl = () => {
    return transaction.save({
      key: keyLog,
      data: {
        time: data.time,
        data: data.data,
        lat: data.lat,
        lng: data.lng
      }
    });
  };

  return transaction.run()
    .then(() => transaction.get(keyInfo))
    .then((err, entity) => {
      if (err) {
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
        data: {
          id: data.id,
          time: data.time,
          data: data.data,
          lat: data.lat,
          lng: data.lng
        }
      });

      return transaction.commit();
    }).then(() => {
      return getInfo(data.id);
    }).catch(() => transaction.rollback());
}

exports.log = (req, res) => {
  console.log(req.params[0]);
  console.log(req.body);

  const id = req.params[0].substr(1);

  switch (req.method) {
  case 'GET':
    getLogs(id).then(data => res.json(data)).catch(() => res.sendStatus(404));
    return;

  case 'POST':
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
    getInfo(id).then(data => res.json(data)).catch(() => res.sendStatus(404));
    return;

  case 'POST':
    saveInfo(req.body).then(() => res.sendStatus(200))
      .catch(() => res.sendStatus(500));
    return;

  case 'PUT':
    if (!id) {
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
