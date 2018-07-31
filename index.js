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

const key = datastore.key(['IoTCore', 'intervalSec']);
datastore.upsert({
  key: key,
  data: { val: 3600 }
});

function toDownlinkData(v) {
  let s = v.toString(16);
  if (s.length > 16) return false;

  let prefix = '';
  for (let i = s.length; i < 16; i++) {
    prefix += '0';
  }

  return prefix + s;
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

exports.devices = (req, res) => {
  console.log(req.params[0]);
  console.log(req.body);

  const device = req.params[0].substr(1);
  if (!device) {
    res.sendStatus(400);
    return;
  }
  if (req.method != 'POST') {
    res.sendStatus(405);
    return;
  }
  if (!req.body.ack) {
    res.sendStatus(204);
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
