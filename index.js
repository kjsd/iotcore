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
  const key = datastore.key(['DeviceInfo', id]);

  return datastore.get(key);
}

function saveInfo(id, data) {
  const key = datastore.key(['DeviceInfo', id]);

  return datastore.save({
    key: key,
    data: {
      name: data.name,
      interval: data.interval
    }
  });
}

function getLog(id) {
  const key = datastore.key(['DeviceLog', id]);

  return datastore.get(key);
}

function saveLog(id, data) {
  const keyInfo = datastore.key(['DeviceInfo', id]);
  const keyLog = datastore.key(['DeviceLog', id]);
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
          time: data.time,
          data: data.data,
          lat: data.lat,
          lng: data.lng
        }
      });

      return transaction.commit();
    }).then(() => {
      return getInfo(id);
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
    getLog(id).then(data => res.json(data)).catch(() => res.sendStatus(404));
    return;

  case 'POST':
    const promise = saveLog(id, req.body);

    if (!req.body.ack) {
      res.sendStatus(204);
      return;
    }

    promise.then(info => {
      const emptyData = '0000000000000000';
      let downlink = new Object();
      const data = toDownlinkData(info.interval);
      downlink[id] = {
        'downlinkData': (data ? data: emptyData)
      };

      res.json(downlink);
    }).catch(() => {
      let downlink = new Object();
      downlink[id] = {
        'downlinkData': toDownlinkData('0000000000000000')
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
  if (!id) {
    res.sendStatus(400);
    return;
  }

  switch (req.method) {
  case 'GET':
    getInfo(id).then(data => res.json(data)).catch(() => res.sendStatus(404));
    return;

  case 'POST':
    saveInfo(id, req.body).then(() => res.sendStatus(200))
      .catch(() => res.sendStatus(500));
    return;

  default:
    res.sendStatus(405);
    return;
  }
};
