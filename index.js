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

function getDevices() {
}

function getDevice(id) {
  const key = datastore.key(['DeviceInfo', id]);

  return datastore.get(key);
}

exports.devices = (req, res) => {
  console.log(req.params[0]);
  console.log(req.body);

  const id = req.params[0].substr(1);

  switch (req.method) {
  case 'GET':
    const data = (id ? getDevice(id): getDevices());
    if (!data) {
      res.sendStatus(404);
      return;
    }

    res.json(data);
    return;

  case 'POST':
    if (!id) {
      res.sendStatus(400);
      return;
    }

    let saveAndReturn = (interval) => {
      saveDevice(device, req.body);

      if (!req.body.ack) {
        res.sendStatus(204);
        return;
      }

      const emptyData = '0000000000000000';
      let downlink = new Object();
      const data = toDownlinkData(interval);
      downlink[device] = {
        'downlinkData': (data ? data: emptyData)
      };

      res.json(downlink);
    };

    getDevice(device).then(results => {
      saveAndReturn(results[0].interval);
    }).catch(err => {
      saveAndReturn(3600);
    });
    return;

  default:
    res.sendStatus(405);
    return;
  }

  datastore.get(key, function(err, entity) {
    let intervalSec = entity.val;

    const emptyData = '0000000000000000';
    let downlink = new Object();
    const data = toDownlinkData(intervalSec);
    downlink[device] = {
      'downlinkData': (data ? data: emptyData)
    };

    res.json(downlink);
  });
};

exports.interval = (req, res) => {
  datastore.get(key, function(err, entity) {
    let intervalSec = entity.val;

    if (req.query.hasOwnProperty('set')) {
      const v = parseInt(req.query.set);
      if (!isNaN(v) && toDownlinkData(v)) {
        intervalSec = v;
        datastore.upsert({
          key: key,
          data: { val: intervalSec }
        });
      }
    }
    console.log(toDownlinkData(intervalSec));

    res.send(intervalSec.toString());
  });
};
