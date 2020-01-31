const fs                      = require('fs');
const sinon                   = require('sinon');
const moment                  = require('moment');
const assert                  = require('assert');
const proxyquire              = require('proxyquire');
const weatherApiFetchMock     = require('./weather-api-fetch-mock');
const { updateForecastDates } = require('./utils');

const fsStub = {
  promises: {
    readFile: sinon.stub(),
    writeFile: sinon.stub(),
    mkdir: sinon.stub(),
  },
  existsSync: sinon.stub(),
};

function fsStubReset() {
  fsStub.promises.readFile.reset();
  fsStub.promises.writeFile.reset();
  fsStub.promises.mkdir.reset();
  fsStub.existsSync.reset();
}

const {
  fetchCurrentWeather,
  fetchWeatherForecast,
  readCitiesFile,
  writeReportFile,
  createWeatherReportDetails,
  createCurrentWeatherReport,
  createForecastReport,
  getOneDayAverageWeather,
  convertCoordinate,
} = proxyquire(
  '../lib/weather', {
    'node-fetch': weatherApiFetchMock,
    'fs': fsStub,
  }
);

const data = {
  forecast: {
    tallinn: updateForecastDates(require('./forecast-tallinn.json')),
  },
  weather: {
    tallinn: require('./weather-tallinn.json'),
  },
  report: {
    tallinn: require('./report-tallinn.json'),
  },
};

/*
  1. Mõtle välja kõikvõimalikud testid, mis on vajalikud, et katta projekti nõudmised 
  (jätke I/O testid (failist lugemine, faili kirjutamine) hetkel välja.

  Clean Code, Edge cases, C.O.R.R.E.C.T ( Conformance, ordering, range, reference, existance, cardinality, time)

  NB! Sellel etapil võib sisendit (linn) olla hardcode-itud või parameetriga edasi antav

  NB! Sellel etapil vastus ei pea salvestuma faili, piisab kui returnitakse nt objekt vajaliku infoga
*/


describe('weather', function() {
  describe('fetchCurrentWeather', function() {
    it('should fetch data for a valid city', async function() {
      const results1 = await fetchCurrentWeather(['tallinn'], 'metric');
      assert.equal(results1.length, 1, 'Expected one result for Tallinn');

      const results2 = await fetchCurrentWeather(['tallinn', 'helsinki'], 'metric');
      assert.equal(results2.length, 2, 'Expected two results for Tallinn and Helsinki');
    });

    it('should reject when attempting to fetch with invalid city name', async function() {
      await assert.rejects(
        () => fetchCurrentWeather(['dallinn'], 'metric'),
        {message: 'Not Found'}
      );
    });

    it('should reject when attempting to fetch without city names', async function() {
      await assert.rejects(
        () => fetchCurrentWeather(undefined, 'metric'),
        {message: 'Missing city names'}
      );
    });

    it('should reject when attempting to fetch with empty city name list', async function() {
      await assert.rejects(
        () => fetchCurrentWeather([], 'metric'),
        {message: 'Missing city names'}
      );
    });

    it('should reject when attempting to fetch without units', async function() {
      await assert.rejects(
        () => fetchCurrentWeather(['tallinn']),
        {message: 'Invalid or missing units'}
      );
    });
  });

  describe('fetchWeatherForecast', function() {
    it('should fetch data for a valid city', async function() {
      const results1 = await fetchWeatherForecast(['tallinn'], 'metric');
      assert.equal(results1.length, 1, 'Expected one result for Tallinn');

      const results2 = await fetchWeatherForecast(['tallinn', 'helsinki'], 'metric');
      assert.equal(results2.length, 2, 'Expected two results for Tallinn and Helsinki');
    });

    it('should reject when attempting to fetch with invalid city name', async function() {
      await assert.rejects(
        () => fetchWeatherForecast(['dallinn'], 'metric'),
        {message: 'Not Found'}
      );
    });

    it('should reject when attempting to fetch without city names', async function() {
      await assert.rejects(
        () => fetchWeatherForecast(undefined, 'metric'),
        {message: 'Missing city names'}
      );
    });

    it('should reject when attempting to fetch with empty city name list', async function() {
      await assert.rejects(
        () => fetchWeatherForecast([], 'metric'),
        {message: 'Missing city names'}
      );
    });

    it('should reject when attempting to fetch without units', async function() {
      await assert.rejects(
        () => fetchWeatherForecast(['tallinn']),
        {message: 'Invalid or missing units'}
      );
    });

    it('should return forecasts for at least 3 days from tomorrow', async function() {
      const results = await fetchWeatherForecast(['tallinn'], 'metric');
      
      const today = moment().startOf('day');

      let hasTomorrow = false;
      let hasDayAfterTomorrow = false;
      let hasTwoDaysAfterTomorrow = false;

      for (var i = 0; i < results[0].list.length; i++) {
        const forecast = results[0].list[i];
        const forecastTime = moment(forecast.dt * 1000);

        if (forecastTime.isSame(moment(today).add(1, 'day'), 'day')) {
          hasTomorrow = true;
        } else if (forecastTime.isSame(moment(today).add(2, 'day'), 'day')) {
          hasDayAfterTomorrow = true;
        } else if (forecastTime.isSame(moment(today).add(3, 'day'), 'day')) {
          hasTwoDaysAfterTomorrow = true;
        }

        if (hasTomorrow && hasDayAfterTomorrow && hasTwoDaysAfterTomorrow) {
          break;
        }
      }
      
      assert.ok(hasTomorrow);
      assert.ok(hasDayAfterTomorrow);
      assert.ok(hasTwoDaysAfterTomorrow);
    });
  });

  describe('readCitiesFile', function() {
    afterEach(() => {
      fsStubReset();
    });

    it('should return an array of cities', async function() {
      fsStub.promises.readFile.returns(Promise.resolve('["Tallinn", "Helsinki", "Tokyo", "Tartu"]'));

      let result = await readCitiesFile('test/input.json');

      assert.deepStrictEqual(
        result,
        [
          'Tallinn',
          'Helsinki',
          'Tokyo',
          'Tartu',
        ]
      );
    });

    it('should throw an error when file is not specified', async function() {
      await assert.rejects(
        () => readCitiesFile(),
        { message: 'File not specified'}
      );
    });

    it('should throw an error when file is empty', async function() {
      fsStub.promises.readFile.returns(Promise.resolve(''));

      await assert.rejects(
        () => readCitiesFile('test/input-invalid-empty.json'),
        { message: 'Empty file'}
      );
    });

    it('should throw an error when file content is invalid JSON', async function() {
      fsStub.promises.readFile.returns(Promise.resolve('Tallinn, Helsinki, Tokyo, Tartu'));

      await assert.rejects(
        () => readCitiesFile('test/input-invalid-not-json.txt'),
        { message: 'Invalid JSON'}
      );
    });

    it('should throw an error when file content is not an array', async function() {
      fsStub.promises.readFile.returns(Promise.resolve(JSON.stringify(
        {
          "Tallinn": "Tallinn",
          "Helsinki": "Helsinki",
          "Tokyo": "Tokyo",
          "Tartu": "Tartu"
        }
      )));

      await assert.rejects(
        () => readCitiesFile('test/input-invalid-object.json'),
        { message: 'Not an array'}
      );
    });

    it('should throw an error when file content is not an array of strings', async function() {
      fsStub.promises.readFile
      .withArgs('test/input-invalid-not-json.txt')
      .returns(Promise.resolve('[1, 2, 3]'));

      fsStub.promises.readFile
      .withArgs('test/input-invalid-booleans.json')
      .returns(Promise.resolve('[1, 2, 3]'));

      await assert.rejects(
        () => readCitiesFile('test/input-invalid-numbers.json'),
        { message: 'Not an array of strings'}
      );

      await assert.rejects(
        () => readCitiesFile('test/input-invalid-booleans.json'),
        { message: 'Not an array of strings'}
      );
    });
  });

  describe('writeReportFile', function() {
    afterEach(() => {
      fsStubReset();
    });

    it('should write the report to a file', async function() {
      fsStub.existsSync.returns(true);

      await writeReportFile('test/test-report-tallinn.json', data.report.tallinn);

      const filenameUsed = fsStub.promises.writeFile.args[0][0];
      const dataWritten = fsStub.promises.writeFile.args[0][1];

      assert.equal(filenameUsed, 'test/test-report-tallinn.json');
      assert.deepStrictEqual(JSON.parse(dataWritten), data.report.tallinn);
      assert.ok(fsStub.promises.writeFile.calledOnce);
    });
  });

  describe('createWeatherReportDetails', function() {
    it('should return weather detail object that contains city, coordinates and temperatureUnit', function() {
      let result = createWeatherReportDetails(data.weather.tallinn, "metric");
      assert.deepStrictEqual(result, {city: "Tallinn", coordinates: "59.44,24.75", temperatureUnit: "Celsius"});
    })

    it('should throw an error when weatherData is undefined', function() {
      assert.throws(() => createWeatherReportDetails(undefined, "metric"));
    });



    it('should throw an error when weatherData is an empty object', function() {
      assert.throws(() => createWeatherReportDetails({}, "metric"));
    });

    it('should throw an error when weatherData and units are empty', function(){
      assert.throws(() => createWeatherReportDetails())
    })
  });

  describe('createCurrentWeatherReport', function() {
    it('should return weather object that contains temperature, humidity and pressure', function() {
      let result = createCurrentWeatherReport(data.weather.tallinn);
      assert.deepStrictEqual(
        result,
        {
          temperature: data.weather.tallinn.main.temp,
          humidity: data.weather.tallinn.main.humidity,
          pressure: data.weather.tallinn.main.pressure,
        }
      );
    });

    it('should throw an error if weatherData parameter is undefined', function() {
      assert.throws(() => createCurrentWeatherReport());
    });

    it('should throw an error when weatherData is an empty object', function() {
      assert.throws(() => createCurrentWeatherReport({}));
    });
  });

  describe('createForecastReport', function() {
    it('should throw an error when forecastData parameter is empty', function() {
      assert.throws(() => createForecastReport());
    });

    it('should throw an error when forecastData is an empty array', function() {
      assert.throws(() => createForecastReport([]));
    });

    it('should create a valid forecast report from valid data', function() {
      assert.deepStrictEqual(
        createForecastReport(data.forecast.tallinn),
        [
          {
            date: moment().add(1, 'day').format('YYYY-MM-DD'),
            weather: {
              humidity: 80,
              pressure: 985,
              temperature: 5.75
            }
          },
          {
            date: moment().add(2, 'day').format('YYYY-MM-DD'),
            weather: {
              humidity: 74,
              pressure: 1002,
              temperature: 1.64
            }
          },
          {
            date: moment().add(3, 'day').format('YYYY-MM-DD'),
            weather: {
              humidity: 73,
              pressure: 1011,
              temperature: 1.99
            }
          }
        ]
      )
    });
  });

  describe('getOneDayAverageWeather', function() {
    it('should calculate average properly', function() {
      const dayForecastData = [
        {
          dt: moment().startOf('day').valueOf() / 1000,
          main: {
            temp: 1,
            pressure: 500,
            humidity: 50,
          }
        },
        {
          dt: moment().startOf('day').add(3, 'hours').valueOf() / 1000,
          main: {
            temp: 2,
            pressure: 1000,
            humidity: 100,
          }
        },
        {
          dt: moment().startOf('day').add(6, 'hours').valueOf() / 1000,
          main: {
            temp: 3,
            pressure: 1500,
            humidity: 150,
          }
        },
      ];

      const oneDayAverage = getOneDayAverageWeather(dayForecastData, moment());

      assert.deepStrictEqual(
        oneDayAverage,
        {
          date: moment().format('YYYY-MM-DD'),
          weather: {
            temperature: 2,
            pressure: 1000,
            humidity: 100,
          }
        }
      );
    });
  });

  describe('convertCoordinate', function() {
    it('should return weather coordinates string in format lat, lon "59.44,24.75"', function() {
      let result = convertCoordinate(data.weather.tallinn.coord);
      assert.deepStrictEqual(result, "59.44,24.75");
      
    });
    
    it('should return weather coordinates string in format lat, lon "59.44,24.75"', function() {
      let result = convertCoordinate(data.weather.tallinn.coord);
      assert.deepStrictEqual(result, "59.44,24.75");
      
    });
  });
  
});