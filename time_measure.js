const puppeteer = require('puppeteer');

async function runSearch(page, query, url) {
    const startTime = Date.now();

    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });
    } catch (error) {
        console.error(`Ошибка при обращении к ${url}: ${error.message}`);
        return null; // Возвращаем null в случае ошибки
    }

    const endTime = Date.now();
    return endTime - startTime; // Возвращаем время выполнения
}

(async () => {
    const query = 'Biology';
    const totalRequests = 100;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Подготовка URL-ов
    const mitUrl = `https://ocw.mit.edu/search/?q=${query}`;
    const moodleUrl = `https://moodle.org/search/index.php?q=${query}`;
    const khanUrl = `https://www.khanacademy.org/search?page_search_query=${query}`;

    // Функция для выполнения запросов с задержкой
    const performRequests = async (url) => {
        const times = [];
        for (let i = 0; i < totalRequests; i++) {
            const time = await runSearch(page, query, url);
            if (time !== null) {
                times.push(time);
            }
            // Задержка между запросами
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 секунда
        }
        return times;
    };

    // Запросы MIT
    const mitTimes = await performRequests(mitUrl);
    const averageMITTime = mitTimes.reduce((a, b) => a + b, 0) / mitTimes.length;
    console.log(`Среднее время выполнения для MIT: ${averageMITTime ? averageMITTime.toFixed(2) : 'Ошибка'}`);

    // Запросы Moodle
    const moodleTimes = await performRequests(moodleUrl);
    const averageMoodleTime = moodleTimes.reduce((a, b) => a + b, 0) / moodleTimes.length;
    console.log(`Среднее время выполнения для Moodle: ${averageMoodleTime ? averageMoodleTime.toFixed(2) : 'Ошибка'}`);

    // Запросы Khan Academy
    const khanTimes = await performRequests(khanUrl);
    const averageKhanTime = khanTimes.reduce((a, b) => a + b, 0) / khanTimes.length;
    console.log(`Среднее время выполнения для Khan Academy: ${averageKhanTime ? averageKhanTime.toFixed(2) : 'Ошибка'}`);

    await browser.close();
})();
