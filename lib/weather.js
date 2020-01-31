const fetch  = require('node-fetch');
const moment = require('moment');
const fs     = require('fs').promises;
const exists = require('fs').existsSync;
const path   = require('path');

const apiUrl = 'https://api.openweathermap.org/data/2.5';
const apiKey = '8fddd056bd69a3f348eccce3373b5862';

/**
 * Checks if the units is valid
 * 
 * @param {string} units - The type of units to be used by openweathermap API
 * 
 * @returns {boolean} - Is the units string valid
 */
function isValidUnits(units) {
  return (units === 'metric' || units === 'imperial');
}

/**
 * Fetches the current weather data from the API for specified cities
 * 
 * @param {string[]} cityNames - Names of the cities
 * 
 * @returns {Promise<Object[]>} - Weather data of cities
 */
async function fetchCurrentWeather(cityNames, units) {
  if (cityNames == null || cityNames.length < 1) {
    throw new Error('Missing city names');
  }

  if (!isValidUnits(units)) {
    throw new Error('Invalid or missing units');
  }

  const jsonPromises = cityNames.map((name) => {
    const url = `${apiUrl}/weather?q=${name}&units=${units}&appid=${apiKey}`;

    return fetch(url).then(res => {
      if (!res.ok) throw Error(res.statusText);

      return res.json();
    });
  });

  return Promise.all(jsonPromises);
}

/**
 * Fetches the weather forecast of the specified cities
 * 
 * @param {string[]} cityNames - Names of the cities
 * 
 * @returns {Promise<Object[]>} - Forecast data of cities
 */
async function fetchWeatherForecast(cityNames, units) {
  if (cityNames == null || cityNames.length < 1) {
    throw new Error('Missing city names');
  }

  if (!isValidUnits(units)) {
    throw new Error('Invalid or missing units');
  }

  const jsonPromises = cityNames.map((name) => {
    const url = `${apiUrl}/forecast?q=${name}&units=${units}&appid=${apiKey}`;

    return fetch(url).then(res => {
      if (!res.ok) throw Error(res.statusText);

      return res.json();
    });
  });

  return Promise.all(jsonPromises);
}

/**
 * Reads the list of cities from file.
 * 
 * @param {string} filename - Name of the cities list file to read
 * 
 * @returns {Promise<Array<string>>} - The list of cities
 */
async function readCitiesFile(filename) {
  if (!filename || typeof filename != 'string') {
    throw new Error('File not specified');
  }

  let rawdata = await fs.readFile(filename);

  if (rawdata.length == 0) {
    throw new Error('Empty file');
  }

  let data;

  try {
    data = JSON.parse(rawdata);
  } catch (e) {
    throw new Error('Invalid JSON');
  }

  if (!Array.isArray(data)) {
    throw new Error('Not an array');
  }

  for (item of data) {
    if (typeof item != 'string') {
      throw new Error('Not an array of strings');
    }
  }

  return data;
}

/**
 * Writes the weather report to file.
 * 
 * @param {string} filename - Name of the report file
 * @param {Object} report - Report to be written
 */
async function writeReportFile(filename, report) {
  const reportPath = path.dirname(filename);

  if (!exists(reportPath)) {
    await fs.mkdir(reportPath, {recursive: true});
  }
  
  await fs.writeFile(filename, JSON.stringify(report, null, '  '));
}

/**
 * 
 * @param {Object} weatherData - weatherData Json object
 * @param {String} units - unist metric, imperial, standard(Kelvin)
 * @returns {Object} - Weather report details (city, coordinate, units)
 */
function createWeatherReportDetails(weatherData, units) {
  const city = weatherData.name;

  const coordinates = convertCoordinate(weatherData.coord);

  let temperatureUnit = 'Kelvin';

  if (units === 'metric') {
    temperatureUnit = 'Celsius';
  } else if (units === 'imperial') {
    temperatureUnit = 'Fahrenheit';
  }

  return {
    city,
    coordinates,
    temperatureUnit,
  };
}

/**
 * Gets current weather for the city.
 * 
 * @param {Object} weatherData - Weather data from which to create the report
 * 
 * @returns {Object} - Current weather report
 */
function createCurrentWeatherReport(weatherData) {
  const {temp, humidity, pressure} = weatherData.main;

  return {
    temperature: temp,
    humidity,
    pressure,
  };
}


/**
 * Create a 3 days weather forecast report.
 * 
 * @param {Object} forecastData - Weather forecast data from which to create the report
 * 
 * @returns {Object[]} - Forecast report for the next 3 days
 */
function createForecastReport(forecastData) {
  const today = moment().startOf('day');
  const tomorrow = moment(today).add(1, 'day');
  const dayAfterTomorrow = moment(today).add(2, 'day');
  const twoDaysAfterTomorrow = moment(today).add(3, 'day');

  return [
    getOneDayAverageWeather(forecastData.list, tomorrow),
    getOneDayAverageWeather(forecastData.list, dayAfterTomorrow),
    getOneDayAverageWeather(forecastData.list, twoDaysAfterTomorrow),
  ];
}

/**
 * Gets average weather from API to one day.
 * 
 * @param {Object} cityName - Name of the city
 * @param {date} date - Date for forecast
 * 
 * @returns {Object} - Avareage weather for city in required date.
 */
function getOneDayAverageWeather(weatherList, date) {
  const oneDayWeatherList = weatherList.filter((item) => {
    return moment(item.dt * 1000).isSame(date, 'day');
  });

  const weather = {
    temperature: 0,
    humidity: 0,
    pressure: 0,
  };

  for (let i = 0; i < oneDayWeatherList.length; i++) {
    weather.temperature += oneDayWeatherList[i].main.temp;
    weather.humidity += oneDayWeatherList[i].main.humidity;
    weather.pressure += oneDayWeatherList[i].main.pressure;
  }

  weather.temperature = weather.temperature / oneDayWeatherList.length;
  weather.humidity = weather.humidity / oneDayWeatherList.length;
  weather.pressure = weather.pressure / oneDayWeatherList.length;

  weather.temperature = Math.round(weather.temperature * 100 + Number.EPSILON ) / 100;
  weather.humidity = Math.round(weather.humidity);
  weather.pressure = Math.round(weather.pressure);

  return {
    date: moment(date).format('YYYY-MM-DD'),
    weather
  };
}

/**
 * Convert city coordinate to string format lat, lon "59.44,24.75"
 * 
 * @param {Object} coord - Coordinate
 * @param {number} coord.lon - Longitude
 * @param {number} coord.lat - Latitude
 * 
 * @return {string} - converted coordinate
 */
function convertCoordinate(coord) {
  return `${coord.lat},${coord.lon}`;
}

module.exports = {
  fetchCurrentWeather,
  fetchWeatherForecast,
  readCitiesFile,
  writeReportFile,
  createWeatherReportDetails,
  createCurrentWeatherReport,
  createForecastReport,
  getOneDayAverageWeather,
  convertCoordinate,
}
