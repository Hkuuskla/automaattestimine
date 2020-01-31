const moment = require('moment');

module.exports = {
    updateForecastDates: (forecast) => {
      for (let i = 0; i < forecast.list.length; i++) {
        const date = moment().startOf('day').add(i * 3, 'hours');

        forecast.list[i].dt = date.valueOf() / 1000;
        forecast.list[i].dt_txt = date.utc().format('YYYY-MM-DD HH:mm:ss');
      }

      return forecast;
    },
}