const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const natural = require('natural'); // Импортируем библиотеку natural
const stemmer = natural.PorterStemmer; // Используем стеммер Портера

// Функция для чтения связанных терминов из файла
async function fetchRelatedTerms(query) {
    try {
        const data = await fs.readFile('related_terms.txt', 'utf-8');
        const lines = data.split('\n');
        const relatedTerms = [];

        for (const line of lines) {
            const [term, terms] = line.split(':');
            if (term && terms) {
                const termsArray = terms.split(',').map(t => t.trim());
                if (term.toLowerCase() === query.toLowerCase()) {
                    relatedTerms.push(...termsArray);
                }
            }
        }

        return [...new Set(relatedTerms)];
    } catch (error) {
        console.error(`Не удалось прочитать связанные термины для "${query}": ${error}`);
        return [];
    }
}

// Функция для стемминга слов
function stemWords(words) {
    return words.map(word => stemmer.stem(word.toLowerCase()));
}

// Общая функция поиска для платформы
async function runSearch(page, url, selector) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (error) {
        console.warn(`Navigation failed for "${url}". Error: ${error.message}`);
        return [];
    }

    try {
        await page.waitForSelector(selector, { timeout: 60000 });
    } catch (error) {
        console.warn(`Selector "${selector}" not found. Error: ${error.message}`);
        return [];
    }

    const results = await page.evaluate(selector => {
        let elements = document.querySelectorAll(selector);
        let searchResults = [];

        elements.forEach((element) => {
            let title = element.innerText.toLowerCase();
            let linkElement = element.closest('a');
            let link = linkElement ? linkElement.href : '';

            if (link) {
                searchResults.push({ title: title, link: link });
            }
        });

        return searchResults;
    }, selector);

    return results;
}

// Функция для поиска на Khan Academy
async function runSearchKhan(term, browser) {
    const page = await browser.newPage();
    try {
        const url = `https://www.khanacademy.org/search?page_search_query=${term}`;
        const selector = '._16owliz9 a._xne4a47';
        const results = await runSearch(page, url, selector);
        return results.map(result => result.title.toLowerCase());
    } finally {
        await page.close(); // Закрытие страницы
    }
}

// Функция для поиска на Moodle
// Функция для поиска на Moodle
async function runSearchMoodle(query, browser) {
    const page = await browser.newPage();

    try {
        await page.goto(`https://moodle.org/search/index.php?q=${query}`, {
            waitUntil: 'networkidle2',
            timeout: 60000,
        });

        await page.waitForSelector('.result-content', { timeout: 60000 });

        const results = await page.evaluate(() => {
            let elements = document.querySelectorAll('div.result-content');
            let searchResults = [];

            elements.forEach((element) => {
                let linkElement = element.querySelector('a');
                let title = linkElement ? linkElement.innerText.toLowerCase() : '';
                let link = linkElement ? linkElement.href : '';

                if (link) {
                    searchResults.push({
                        title: title,
                        link: link
                    });
                }
            });

            return searchResults;
        });

        return results;
    } catch (error) {
        console.error(`Ошибка при поиске на Moodle для запроса "${query}": ${error.message}`);
        return [];
    } finally {
        await page.close(); // Закрытие страницы
    }
}


// Функция для запуска тестов
async function runTests() {
    const queries = ['Biology'];

    const browser = await puppeteer.launch({ headless: true });
    //let averageKhanMatches = [];
    let averageMoodleMatches = [];

    for (let query of queries) {
        let totalMoodleMatches = 0;

        let relatedTerms = await fetchRelatedTerms(query);
        console.log("Количество связанных терминов для Biology = " + relatedTerms.length)

        console.log(relatedTerms);
        let totalKhanMatches = 0;


        // Стеммируем запрос
        const stemmedQuery = stemmer.stem(query.toLowerCase());


        for (let term of relatedTerms) {
            // Стеммируем связанные термины
            const stemmedTerms = stemWords([term]);
/*
            try {
                // Поиск на Khan Academy
                const khanResults = await runSearchKhan(term, browser);
                if (khanResults.length > 0) totalKhanMatches += 1; // Увеличиваем счетчик, если есть результаты
                khanResults.forEach(i => console.log("search result Khan Academy on " + term + " is " + stemmer.stem(i)));
            } catch (error) {
                console.error(`Ошибка при поиске на Khan Academy для термина "${term}": ${error.message}`);
            }*/

            try {
                // Поиск на Moodle
                console.log("search for " + term);
                const moodleResults = await runSearchMoodle(term, browser);
                console.log(moodleResults);
                if (moodleResults.length > 0)
                    {totalMoodleMatches ++; // Увеличиваем счетчик, если есть результаты
                console.log("result found");
                }
                console.log("total Matches = " + totalMoodleMatches);
            } catch (error) {
                console.error(`Ошибка при поиске на Moodle для термина "${term}": ${error.message}`);
            }

                    // Вывод среднего значения найденных терминов
            const averageTerms = (totalMoodleMatches) / relatedTerms.length;
            const intermediateSummary = `Average related terms for "${query}": ${averageTerms}\n`;
            await fs.appendFile('Moodle_averages.txt', intermediateSummary);

        }

        // Расчет процентов
        //const khanPercentage = (totalKhanMatches / relatedTerms.length) * 100 || 0;
        const moodlePercentage = (totalMoodleMatches / relatedTerms.length) * 100 || 0;

        //averageKhanMatches.push(khanPercentage);
        averageMoodleMatches.push(moodlePercentage);
    }

    await browser.close();

    // Финальные вычисления средних значений
    //const overallAverageKhan = averageKhanMatches.reduce((sum, avg) => sum + avg, 0) / averageKhanMatches.length || 0;
    const overallAverageMoodle = averageMoodleMatches.reduce((sum, avg) => sum + avg, 0) / averageMoodleMatches.length || 0;

    // Запись средних значений в файл
    //const summary = `Overall Average Percentage of Related Matches:\nKhan Academy: ${overallAverageKhan.toFixed(2)}%\nMoodle: ${overallAverageMoodle.toFixed(2)}%\n`;
    const summary = `Overall Average Percentage of Related Matches:\nKhan Academy: \nMoodle: ${overallAverageMoodle.toFixed(2)}%\n`;

    await fs.appendFile('averages_moodle.txt', summary);

    console.log(summary);
}

// Запуск тестов
runTests();
