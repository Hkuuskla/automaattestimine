const {
    readCitiesFile,
    writeReportFile,
    fetchCurrentWeather,
    fetchWeatherForecast,
    createCurrentWeatherReport,
    createForecastReport,
    createWeatherReportDetails
} = require('./weather');

const args = process.argv.slice(2);

if (!args.length) {
    console.log('Usage:');
    console.log('  NPM START -- filename');
    process.exit();
}

let outputPath = './output';

if (args.length == 2) {
    outputPath = args[1];
}

(async function main() {
    const units = 'metric';
    const citiesFileName = args[0];
    const cityList = await readCitiesFile(citiesFileName);

    const weatherDataList = await fetchCurrentWeather(cityList, units);
    const forecastDataList = await fetchWeatherForecast(cityList, units);

    for (let city of cityList) {
        const cityWeatherData = weatherDataList.find((data) => data.name === city);
        const cityForecastData = forecastDataList.find((data) => data.city.name === city);

        const weatherReportDetails = createWeatherReportDetails(cityWeatherData, units);
        const currentWeatherReport = createCurrentWeatherReport(cityWeatherData);
        const forecastReport = createForecastReport(cityForecastData);
    
        const report = {
            weatherReportDetails,
            currentWeatherReport,
            forecastReport,
        };
    
        await writeReportFile(`${outputPath}/${city}.json`, report);
    }

})();
