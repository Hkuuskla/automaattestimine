const http = require('http');
const {updateForecastDates} = require('./utils');

const host = 'api.openweathermap.org';

const data = {
  forecast: {
    tallinn: updateForecastDates(require('./forecast-tallinn.json')),
    helsinki: updateForecastDates(require('./forecast-helsinki.json')),
  },
  weather: {
    tallinn: require('./weather-tallinn.json'),
    helsinki: require('./weather-helsinki.json'),
  },
};

module.exports = (resource, options) => {
  const url = new URL(resource);
  const cityNameQuery = url.searchParams.get('q');
  const untis = url.searchParams.get('untis');

  let api = null;

  if (url.host !== host) {
    throw new Error(`Expected host ${host}, got ${url.host}`);
  }

  if (url.pathname === '/data/2.5/weather') {
    api = 'weather';
  } else if (url.pathname === '/data/2.5/forecast') {
    api = 'forecast';
  } else {
    throw new Error(`Unexpected api path ${url.pathname}`);
  }

  if (cityNameQuery in data[api]) {
    return response(data[api][cityNameQuery]);
  } else {
    return response({"cod": "404", "message": "city not found"}, 404);
  }
};

function response(data, httpStatusCode = 200) {
  const response = {
    ok: httpStatusCode < 400,
    status: httpStatusCode,
    statusText: http.STATUS_CODES[httpStatusCode],
    json: () => Promise.resolve(data),
  };

  return Promise.resolve(response);
}
