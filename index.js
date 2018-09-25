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

function mergeInfo(device, data) {
  let v = {
    device: device,
    name: '__DEFAULT__',
    type: '__DEFAULT__',
    client: '__DEFAULT__',
    interval: 3600
  };
  if (data) {
    if (data.hasOwnProperty('name')) v.name = data.name;
    if (data.hasOwnProperty('type')) v.type = data.type;
    if (data.hasOwnProperty('client')) v.client = data.client;
    if (data.hasOwnProperty('interval')) v.interval = data.interval;
  }
  return v;
}

function getInfo(device) {
  const promise = datastore.get(datastore.key(['DeviceInfo', device]));

  return promise.then(results => results[0]);
}

function searchInfo(filter) {
  let query = datastore.createQuery('DeviceInfo');
  for (let k in filter) {
    query = query.filter(k, '=', filter[k]);
  }

  const promise = datastore.runQuery(query);

  return promise.then(results => results[0]);
}

function saveInfo(data) {
  const key = datastore.key(['DeviceInfo', data.device]);
  const transaction = datastore.transaction();

  return transaction.run()
    .then(() => transaction.get(key))
    .then(results => {
      transaction.save({
        key: key,
        data: mergeInfo(data.device, data)
      });
      return transaction.commit();
    }).catch(() => transaction.rollback());
}

function getLogs(device) {
  return datastore.runQuery(datastore.createQuery(device))
    .then(results => results[0]);
}

function saveLog(data) {
  const keyInfo = datastore.key(['DeviceInfo', data.device]);
  const keyLog = datastore.key(data.device);
  const transaction = datastore.transaction();

  return transaction.run()
    .then(() => transaction.get(keyInfo))
    .then(results => {
      console.log(results);
      if (!results[0] || !results[0].hasOwnProperty('device')) {
        transaction.save({
          key: keyInfo,
          data: mergeInfo(data.device, null)
        });
      }
      transaction.save({ key: keyLog, data: data });

      return transaction.commit();
    }).then(() => getInfo(data.device))
    .catch(() => transaction.rollback());
}

function reqGetLog(req, res) {
  const id = req.params[0].substr(1);
  if (!id) {
    res.sendStatus(400);
    return;
  }

  getLogs(id).then(data => {
    if (!data || (data.length == 0)) {
      res.sendStatus(404);
    } else {
      res.json(data);
    }
  }).catch(() => res.sendStatus(500));
}

function reqPostLog(req, res) {
  if (!req.body.device) {
    res.sendStatus(400);
    return;
  }
  const id = req.body.device;
  const promise = saveLog(req.body);

  if (!req.body.ack) {
    Promise.resolve(promise);
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
}

exports.log = (req, res) => {
  console.log(req.params);
  console.log(req.body);

  switch (req.method) {
  case 'GET':
    reqGetLog(req, res);
    return;
  case 'POST':
    reqPostLog(req, res);
    return;
  default:
    res.sendStatus(405);
    return;
  }
};

function reqGetInfo(req, res) {
  const id = req.params[0].substr(1);

  const promise = id ? getInfo(id): searchInfo(req.query);
  promise.then(data => {
    if (!data) {
      res.sendStatus(404);
    } else {
      res.json(data);
    }
  }).catch(() => res.sendStatus(500));
}

function reqPostInfo(req, res) {
  if (!req.body.device) {
    res.sendStatus(400);
    return;
  }
  saveInfo(req.body).then(() => res.sendStatus(200))
    .catch(() => res.sendStatus(500));
}

function reqPutInfo(req, res) {
  const id = req.params[0].substr(1);

  if (!id || (id != req.body.device)) {
    res.sendStatus(400);
    return;
  }
  
  saveInfo(req.body).then(() => res.sendStatus(200))
    .catch(() => res.sendStatus(500));
}

exports.info = (req, res) => {
  console.log(req.params);
  console.log(req.body);

  switch (req.method) {
  case 'GET':
    reqGetInfo(req, res);
    return;
  case 'POST':
    reqPostInfo(req, res);
    return;
  case 'PUT':
    reqPutInfo(req, res);
    return;
  default:
    res.sendStatus(405);
    return;
  }
};
