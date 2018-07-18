/**
 * @file app.js
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

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

if (process.env.NODE_ENV == 'production') {
  app.use(require('compression')());
  app.use(require('express-minify')());
} else {
  process.env.BASE_URL = 'http://localhost:3000';
}

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

const toDownlinkData = function(v) {
  let s = v.toString(16);
  if (s.length > 16) return false;

  let prefix = '';
  for (let i = s.length; i < 16; i++) {
    prefix += '0';
  }

  return prefix + s;
};

let intervalSec = 3600;

app.get('/interval', (req, res) => {
  if (req.query.hasOwnProperty('set')) {
    const v = parseInt(req.query.set);
    if (!isNaN(v) && toDownlinkData(v)) {
      intervalSec = v;
    }
  }
  console.log(toDownlinkData(intervalSec));

  res.send(intervalSec.toString());
});

app.post('/:device', (req, res) => {
  console.log(req.params.device);
  console.log(req.body);

  if (!req.body.ack) {
    res.sendStatus(204);
    return;
  }

  const emptyData = '0000000000000000';
  let downlink = new Object();
  const data = toDownlinkData(intervalSec);
  downlink[req.params.device] = {
    'downlinkData': (data ? data: emptyData)
  };

  res.json(downlink);
});

const server = app.listen(process.env.PORT || '3000', function () {
  console.log('App listening on port %s', server.address().port);
});
